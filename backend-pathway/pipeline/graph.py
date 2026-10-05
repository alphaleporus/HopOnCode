"""
FleetFusion streaming graph (Pathway).

    telemetry (simulator ∪ HTTP /telemetry)
        └─ groupby truck → stateful fold (O(1) state per truck)
             ⋈ registry (simulator ∪ HTTP /trucks)
             ⋈ contracts (data/contracts/*.json, hot-reloaded)
                 └─ assess() UDF → per-truck decision
                      ⟕ latest operator command (execute / dismiss)
                          ├─ fleet table ─────────────▶ realtime hub
                          ├─ fleet KPIs ──────────────▶ realtime hub
                          └─ new actionable incidents → LLM explanation (async, cached)
    commands ─▶ impact KPIs (savings, penalties avoided, CO2) + audit log
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional

import pathway as pw

from core.arbitrage import CONSIDER, EXECUTE, TruckSnapshot, assess
from core.config import DecisionConfig
from core.telemetry import TruckState, fold


class TelemetrySchema(pw.Schema):
    truck_id: str
    ts: int
    lat: float
    lon: float
    speed_kmh: float
    incident: str = pw.column_definition(default_value="")
    trip_started_at: int = pw.column_definition(default_value=0)


class RegistrySchema(pw.Schema):
    truck_id: str
    driver: str
    contract_id: str
    cargo_value: float
    route: str  # JSON [[lon, lat], ...]
    nominal_cruise_kmh: float = pw.column_definition(default_value=60.0)


class CommandSchema(pw.Schema):
    truck_id: str
    incident_id: str
    action: str  # "execute" | "dismiss"
    ts: int
    provider: str
    cost: float
    net_savings: float
    penalty_avoided: float
    extra_co2_kg: float


@dataclass
class Sources:
    telemetry: pw.Table
    registry: pw.Table
    commands: pw.Table
    contracts_dir: str


@dataclass
class Outputs:
    fleet: pw.Table
    fleet_kpis: pw.Table
    impact: pw.Table
    explanations: Optional[pw.Table]
    commands: pw.Table


@lru_cache(maxsize=65536)
def _route(raw: str):
    return json.loads(raw)


def _parse_contract(data: bytes) -> str:
    """Validate a contract file; returns '' for unreadable files so one bad file can't crash the stream."""
    try:
        doc = json.loads(data.decode("utf-8"))
        return json.dumps(doc) if doc.get("contract_id") else ""
    except Exception as e:
        print(f"⚠️  Skipping invalid contract file: {e}")
        return ""


def load_contracts(contracts_dir: str, streaming: bool = True) -> pw.Table:
    files = pw.io.fs.read(contracts_dir, format="binary", mode="streaming" if streaming else "static",
                          with_metadata=True)
    parsed = files.select(raw=pw.apply_with_type(_parse_contract, str, pw.this.data)).filter(pw.this.raw != "")
    parsed = parsed.select(
        pw.this.raw,
        contract_id=pw.apply_with_type(lambda r: json.loads(r)["contract_id"], str, pw.this.raw),
    )
    # Files can be edited or deleted (retractions), so pick by value rather than arrival order.
    # Two files declaring the same contract_id is a data error; max() just makes it deterministic.
    contracts = parsed.groupby(pw.this.contract_id).reduce(pw.this.contract_id, raw=pw.reducers.max(pw.this.raw))
    return contracts.with_columns(
        terms=pw.apply_with_type(lambda r: json.loads(r).get("terms", ""), str, pw.this.raw))


def build(sources: Sources, cfg: DecisionConfig, explainer=None, contracts: Optional[pw.Table] = None) -> Outputs:
    stop_kmh = cfg.stop_speed_kmh

    @pw.reducers.stateful_single
    def truck_state(state, ts, lat, lon, speed, incident, trip_started_at):
        return fold(state, ts, lat, lon, speed, incident, trip_started_at, stop_kmh)

    @pw.udf
    def assess_udf(truck_id: str, st: Any, route: str, contract_raw: str, nominal_kmh: float) -> pw.Json:
        from core.models import contract_from_json
        s = TruckState(*st)
        snap = TruckSnapshot(
            truck_id=truck_id, lon=s.lon, lat=s.lat, speed_kmh=s.speed_kmh, cruise_kmh=s.cruise_kmh,
            now=s.ts, trip_started_at=s.trip_started_at, stopped_since=s.stopped_since,
            incident=s.incident, route=_route(route), nominal_cruise_kmh=nominal_kmh,
        )
        out = assess(snap, contract_from_json(contract_raw), cfg)
        out.update(lon=s.lon, lat=s.lat, speed_kmh=s.speed_kmh, ts=s.ts, readings=s.readings)
        return pw.Json(out)

    @pw.udf
    def finalize(assessment: pw.Json, cmd_incident: Optional[str], cmd_action: Optional[str],
                 cmd_provider: Optional[str]) -> pw.Json:
        """Overlay the operator's latest decision on the live assessment."""
        a = dict(assessment.value)
        applies = bool(cmd_incident) and cmd_incident == a.get("incident_id")
        a["resolved"] = applies and cmd_action == "execute"
        a["dismissed"] = applies and cmd_action == "dismiss"
        if a["resolved"]:
            a["status"] = "resolved"
            a["recommendation"] = "RESOLVED"
            a["summary"] = f"{a['truck_id']}: relief via {cmd_provider} dispatched; cargo resumes on handover."
        return pw.Json(a)

    # 1. Per-truck telemetry state, O(1) memory per truck
    state = sources.telemetry.groupby(pw.this.truck_id).reduce(
        pw.this.truck_id,
        st=truck_state(pw.this.ts, pw.this.lat, pw.this.lon, pw.this.speed_kmh, pw.this.incident,
                       pw.this.trip_started_at),
    )

    # 2. Latest registry entry per truck (HTTP re-registration overrides)
    registry = sources.registry.groupby(pw.this.truck_id).reduce(
        pw.this.truck_id,
        driver=pw.reducers.latest(pw.this.driver),
        contract_id=pw.reducers.latest(pw.this.contract_id),
        cargo_value=pw.reducers.latest(pw.this.cargo_value),
        route=pw.reducers.latest(pw.this.route),
        nominal_cruise_kmh=pw.reducers.latest(pw.this.nominal_cruise_kmh),
    )

    contracts = contracts if contracts is not None else load_contracts(sources.contracts_dir)

    # 3. Join live state with truck metadata and contract terms, then assess
    tracked = state.join(registry, state.truck_id == registry.truck_id).select(
        state.truck_id, state.st, registry.driver, registry.contract_id, registry.cargo_value,
        registry.route, registry.nominal_cruise_kmh)
    tracked = tracked.join(contracts, tracked.contract_id == contracts.contract_id).select(
        *pw.left, contract_raw=pw.right.raw, terms=pw.right.terms)
    assessed = tracked.select(
        pw.this.truck_id, pw.this.driver, pw.this.contract_id, pw.this.cargo_value, pw.this.route,
        pw.this.terms,
        assessment=assess_udf(pw.this.truck_id, pw.this.st, pw.this.route, pw.this.contract_raw,
                              pw.this.nominal_cruise_kmh),
    )

    # 4. Overlay operator decisions
    latest_cmd = sources.commands.groupby(pw.this.truck_id).reduce(
        pw.this.truck_id,
        incident_id=pw.reducers.latest(pw.this.incident_id),
        action=pw.reducers.latest(pw.this.action),
        provider=pw.reducers.latest(pw.this.provider),
    )
    fleet = assessed.join_left(latest_cmd, assessed.truck_id == latest_cmd.truck_id).select(
        assessed.truck_id, assessed.driver, assessed.contract_id, assessed.cargo_value, assessed.route,
        assessed.terms,
        decision=finalize(assessed.assessment, latest_cmd.incident_id, latest_cmd.action, latest_cmd.provider),
    )
    fleet = fleet.with_columns(
        status=pw.this.decision["status"].as_str(unwrap=True),
        recommendation=pw.this.decision["recommendation"].as_str(unwrap=True),
        exposure=pw.this.decision["exposure"].as_float(unwrap=True),
        incident_id=pw.this.decision["incident_id"].as_str(unwrap=True),
    )

    # 5. Fleet-wide KPIs (incremental)
    def count_if(cond):
        return pw.reducers.sum(pw.if_else(cond, 1, 0))

    fleet_kpis = fleet.reduce(
        trucks=pw.reducers.count(),
        on_time=count_if(pw.this.status == "on-time"),
        delayed=count_if(pw.this.status == "delayed"),
        critical=count_if(pw.this.status == "critical"),
        resolved=count_if(pw.this.status == "resolved"),
        actionable=count_if((pw.this.recommendation == EXECUTE) | (pw.this.recommendation == CONSIDER)),
        exposure=pw.reducers.sum(pw.if_else(pw.this.status == "critical", pw.this.exposure, 0.0)),
        cargo_value=pw.reducers.sum(pw.this.cargo_value),
    )

    # 6. Impact of executed decisions
    executed = sources.commands.filter(pw.this.action == "execute")
    impact = executed.reduce(
        decisions=pw.reducers.count(),
        net_savings=pw.reducers.sum(pw.this.net_savings),
        penalties_avoided=pw.reducers.sum(pw.this.penalty_avoided),
        relief_spend=pw.reducers.sum(pw.this.cost),
        extra_co2_kg=pw.reducers.sum(pw.this.extra_co2_kg),
    )

    # 7. LLM explanation once per (incident, chosen option), never per tick
    explanations = None
    if explainer is not None:
        actionable = fleet.filter(
            (pw.this.recommendation == EXECUTE) | (pw.this.recommendation == CONSIDER)
        ).select(
            pw.this.truck_id,
            pw.this.incident_id,
            pw.this.terms,
            key=pw.this.incident_id + "|" + pw.this.decision["best"].as_str(unwrap=True),
            summary=pw.this.decision["summary"].as_str(unwrap=True),
            options_json=pw.apply_with_type(lambda d: json.dumps(d.value["options"]), str, pw.this.decision),
        )
        first_seen = actionable.deduplicate(
            value=pw.this.key, instance=pw.this.truck_id, acceptor=lambda new, old: new != old)
        explanations = first_seen.select(
            pw.this.truck_id, pw.this.incident_id, pw.this.key,
            explanation=explainer(pw.this.key, pw.this.summary, pw.this.options_json, pw.this.terms),
        )

    return Outputs(fleet=fleet, fleet_kpis=fleet_kpis, impact=impact, explanations=explanations,
                   commands=sources.commands)
