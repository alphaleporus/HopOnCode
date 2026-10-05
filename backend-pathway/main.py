"""
FleetFusion backend: one process running the Pathway streaming pipeline and
the realtime WebSocket hub.

Environment (see .env.example):
    FLEET_SIZE               simulated trucks (default 3; try 500+ for load tests)
    SIM_SPEEDUP              simulated seconds per real second (default 1)
    SCENARIO                 scripted demo file, or "none" (default data/scenarios/demo.json)
    RANDOM_INCIDENT_RATE     random incidents per truck per simulated hour (default 0)
    ENABLE_SIMULATOR         "false" to run on real telemetry only
    ENABLE_HTTP_INGEST       "true" to accept POST /telemetry and /trucks (default true)
    INGEST_HOST/INGEST_PORT  HTTP ingest bind address (default 0.0.0.0:8090)
    WEBSOCKET_HOST/PORT      realtime hub bind address (default localhost:8765)
    PATHWAY_THREADS          Pathway worker threads (horizontal scaling within a node)
    LLM_*                    see llm/llm_client.py
"""

import json
import os

import pathway as pw
from dotenv import load_dotenv

from connectors.command_connector import CommandSubject
from connectors.fleet_simulator import FleetSimulator, RegistrySubject, TelemetrySubject
from core.config import DecisionConfig
from core.models import contract_from_json
from llm.explainer import build_explainer
from llm.llm_client import LLMClient
from pipeline.graph import CommandSchema, RegistrySchema, Sources, TelemetrySchema, build
from realtime.hub import RealtimeHub

load_dotenv()


def env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes")


def http_ingest(schema, route: str, webserver):
    table, writer = pw.io.http.rest_connector(
        webserver=webserver, route=route, schema=schema, autocommit_duration_ms=200,
        delete_completed_queries=False,
    )
    writer(table.select(query_id=table.id, result=pw.apply_with_type(lambda _: {"ok": True}, dict,
                                                                       table.truck_id)))
    return table


def main():
    cfg = DecisionConfig.from_env()
    print("=" * 60)
    print("🚀 FleetFusion - streaming decision engine")
    print("=" * 60)

    # ---- Inputs --------------------------------------------------------------------------
    telemetry_parts, registry_parts = [], []
    sim = None
    if env_bool("ENABLE_SIMULATOR", True):
        scenario_path = os.getenv("SCENARIO", "data/scenarios/demo.json")
        scenario = json.load(open(scenario_path)) if scenario_path != "none" and os.path.exists(scenario_path) else []
        contracts_dir = os.getenv("CONTRACTS_DIR", "data/contracts")
        sla = {}
        for name in os.listdir(contracts_dir):
            if name.endswith(".json"):
                try:
                    c = contract_from_json(open(os.path.join(contracts_dir, name)).read())
                    sla[c.contract_id] = c.sla_hours
                except Exception as e:
                    print(f"⚠️  Skipping contract {name}: {e}")
        sim = FleetSimulator(
            contract_sla_hours=sla,
            fleet_size=int(os.getenv("FLEET_SIZE", "3")),
            speedup=float(os.getenv("SIM_SPEEDUP", "1")),
            scenario=scenario,
            random_incidents_per_truck_hour=float(os.getenv("RANDOM_INCIDENT_RATE", "0")),
        )
        telemetry_parts.append(pw.io.python.read(TelemetrySubject(sim), schema=TelemetrySchema,
                                                 autocommit_duration_ms=500, name="sim_telemetry"))
        registry_parts.append(pw.io.python.read(RegistrySubject(sim), schema=RegistrySchema,
                                                name="sim_registry"))
        print(f"🚚 Simulator: {len(sim.trucks)} trucks, speed-up x{sim.speedup}, "
              f"{len(scenario)} scripted events, {sim.random_rate}/truck-hour random incidents")

    if env_bool("ENABLE_HTTP_INGEST", True):
        host, port = os.getenv("INGEST_HOST", "0.0.0.0"), int(os.getenv("INGEST_PORT", "8090"))
        webserver = pw.io.http.PathwayWebserver(host=host, port=port)
        telemetry_parts.append(http_ingest(TelemetrySchema, "/telemetry", webserver))
        registry_parts.append(http_ingest(RegistrySchema, "/trucks", webserver))
        print(f"🌐 HTTP ingest: POST http://{host}:{port}/telemetry and /trucks")

    if not telemetry_parts:
        raise SystemExit("No telemetry source enabled (ENABLE_SIMULATOR / ENABLE_HTTP_INGEST)")

    telemetry = telemetry_parts[0].concat_reindex(*telemetry_parts[1:]) if len(telemetry_parts) > 1 \
        else telemetry_parts[0]
    registry = registry_parts[0].concat_reindex(*registry_parts[1:]) if len(registry_parts) > 1 \
        else registry_parts[0]

    command_subject = CommandSubject()
    commands = pw.io.python.read(command_subject, schema=CommandSchema, autocommit_duration_ms=100,
                                 name="commands")

    # ---- LLM (optional) ------------------------------------------------------------------
    llm = LLMClient()
    explainer = None
    if llm.is_available():
        explainer = build_explainer(llm)
        print(f"🧠 LLM explanations: {llm.model} @ {llm.base_url}")
    else:
        print("🧠 LLM not reachable - using deterministic explanations")

    # ---- Graph ---------------------------------------------------------------------------
    out = build(Sources(telemetry=telemetry, registry=registry, commands=commands,
                        contracts_dir=os.getenv("CONTRACTS_DIR", "data/contracts")), cfg, explainer)

    # ---- Outputs -------------------------------------------------------------------------
    def on_command(cmd: dict):
        option = cmd.pop("_option", None)
        command_subject.push(cmd)
        if sim and cmd["action"] == "execute" and option:
            handover_min = option["handover_hours"] * 60
            sim.dispatch_relief(cmd["truck_id"], pickup_eta_min=handover_min, transfer_min=0,
                                speed_kmh=option["speed_kmh"])
        print(f"🎯 {cmd['action']} {cmd['truck_id']} {cmd.get('label') or cmd['provider'] or '-'} "
              f"(net saving {cmd['net_savings']:,.0f})")

    hub = RealtimeHub(host=os.getenv("WEBSOCKET_HOST", "localhost"), port=int(os.getenv("WEBSOCKET_PORT", "8765")),
                      on_command=on_command)
    hub.ai_available = explainer is not None
    if sim and env_bool("DEMO_CONTROLS", True):
        hub.on_demo = lambda action: sim.reset() if action == "reset" else sim.trigger_breakdown()
    for name, table in [("fleet", out.fleet), ("fleet_kpis", out.fleet_kpis), ("impact", out.impact),
                        ("explanations", out.explanations)]:
        if table is not None:
            on_change, on_time_end = hub.subscriber(name)
            pw.io.subscribe(table, on_change=on_change, on_time_end=on_time_end, name=f"hub_{name}")

    # Append-only audit trail of every operator decision
    os.makedirs("output", exist_ok=True)
    pw.io.jsonlines.write(out.commands, "output/decisions.jsonl")

    hub.start()
    print("=" * 60)
    pw.run(monitoring_level=pw.MonitoringLevel.NONE)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n🛑 Stopped")
