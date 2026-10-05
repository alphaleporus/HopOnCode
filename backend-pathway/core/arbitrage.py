"""
Arbitrage engine: decide whether paying for a relief carrier beats absorbing
the delay, for one truck, at one instant.

Every option is scored by expected cost to the carrier:

    WAIT     : sla_penalty(wait lateness) + spoilage(total transit)
    RELIEF_i : offer cost
               + reliability_i       * exposure if the relief delivers as quoted
               + (1 - reliability_i) * exposure of WAIT (relief fails, we are back to waiting)

The cheapest option wins. Net savings = WAIT cost - best cost. Numbers are fully
deterministic; the LLM only explains the result, it never decides it.
"""

from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

from . import incidents
from .config import DecisionConfig
from .geo import remaining_route_km
from .models import Contract, SpotOffer
from .money import fmt
from .penalty import is_force_majeure, sla_penalty, spoilage_loss

EXECUTE, CONSIDER, MONITOR, NONE = "EXECUTE", "CONSIDER", "MONITOR", "NONE"


@dataclass(frozen=True)
class TruckSnapshot:
    truck_id: str
    lon: float
    lat: float
    speed_kmh: float
    cruise_kmh: float
    now: int                    # event time (epoch seconds)
    trip_started_at: int
    stopped_since: int          # 0 if moving
    incident: str
    route: List[List[float]]
    nominal_cruise_kmh: float = 60.0


@dataclass
class Option:
    kind: str                   # "wait" | "relief"
    label: str
    provider: str
    direct_cost: float
    sla_penalty: float
    spoilage_loss: float
    expected_cost: float
    arrival_hours: float        # from now
    lateness_hours: float
    reliability: float
    co2_kg: float
    extra_co2_kg: float
    handover_hours: float = 0.0  # relief: pickup + transfer time before cargo moves again
    speed_kmh: float = 0.0       # projected speed for the remaining leg


def _r(x: float, nd: int = 2) -> float:
    return round(float(x), nd)


def _wait_option(contract: Contract, cfg: DecisionConfig, remaining_km: float, drive_kmh: float,
                 stop_h: float, deadline_left_h: float, elapsed_h: float, force_majeure: bool) -> Option:
    arrival = stop_h + remaining_km / drive_kmh
    lateness = max(0.0, arrival - deadline_left_h)
    penalty = 0.0 if force_majeure else sla_penalty(contract, lateness)
    spoil = spoilage_loss(contract, elapsed_h + arrival)
    return Option(
        kind="wait", label="Wait for recovery" if stop_h > 0 else "Continue on route", provider="",
        direct_cost=0.0, sla_penalty=penalty, spoilage_loss=spoil, expected_cost=penalty + spoil,
        arrival_hours=arrival, lateness_hours=lateness, reliability=1.0,
        co2_kg=remaining_km * cfg.co2_kg_per_km, extra_co2_kg=0.0,
        handover_hours=stop_h, speed_kmh=drive_kmh,
    )


def _relief_option(contract: Contract, cfg: DecisionConfig, offer: SpotOffer, remaining_km: float,
                   deadline_left_h: float, elapsed_h: float, force_majeure: bool, wait: Option) -> Option:
    handover_h = (offer.pickup_eta_min + offer.transfer_min) / 60.0
    arrival = handover_h + remaining_km / max(offer.speed_kmh, cfg.min_cruise_kmh)
    lateness = max(0.0, arrival - deadline_left_h)
    penalty = 0.0 if force_majeure else sla_penalty(contract, lateness)
    spoil = spoilage_loss(contract, elapsed_h + arrival)
    r = offer.reliability
    expected = offer.cost + r * (penalty + spoil) + (1 - r) * wait.expected_cost
    deadhead_km = offer.pickup_eta_min / 60.0 * offer.speed_kmh
    return Option(
        kind="relief", label=f"Relief truck via {offer.provider}", provider=offer.provider,
        direct_cost=offer.cost, sla_penalty=penalty, spoilage_loss=spoil, expected_cost=expected,
        arrival_hours=arrival, lateness_hours=lateness, reliability=r,
        co2_kg=(deadhead_km + remaining_km) * cfg.co2_kg_per_km,
        extra_co2_kg=deadhead_km * cfg.co2_kg_per_km,
        handover_hours=handover_h, speed_kmh=offer.speed_kmh,
    )


def assess(snapshot: TruckSnapshot, contract: Contract, cfg: Optional[DecisionConfig] = None) -> Dict:
    """Assess one truck against its contract. Returns a JSON-serializable dict."""
    cfg = cfg or DecisionConfig()
    s = snapshot

    remaining_km = remaining_route_km(s.route, [s.lon, s.lat])
    elapsed_h = max(0.0, (s.now - s.trip_started_at) / 3600.0) if s.trip_started_at else 0.0
    deadline_left_h = contract.sla_hours - elapsed_h

    stopped = s.speed_kmh < cfg.stop_speed_kmh
    stopped_min = (s.now - s.stopped_since) / 60.0 if stopped and s.stopped_since else 0.0
    incident = incidents.normalize(s.incident) if stopped else ""
    stop_h = incidents.expected_remaining_stop_hours(incident, stopped_min) if stopped else 0.0
    force_majeure = is_force_majeure(contract, incident)

    # Projected driving speed once moving: learned cruise speed, else contract-agnostic nominal
    drive_kmh = max(s.cruise_kmh or s.nominal_cruise_kmh, cfg.min_cruise_kmh)
    if not stopped:
        # Currently slow (e.g. traffic): assume we recover toward cruise speed, but not instantly
        drive_kmh = max(cfg.min_cruise_kmh, (drive_kmh + max(s.speed_kmh, cfg.min_cruise_kmh)) / 2)

    wait = _wait_option(contract, cfg, remaining_km, drive_kmh, stop_h, deadline_left_h, elapsed_h,
                        force_majeure)
    options = [wait]
    # Transshipment only makes sense for a stationary truck with somewhere left to go
    if stopped and remaining_km > 1.0:
        options += [_relief_option(contract, cfg, o, remaining_km, deadline_left_h, elapsed_h,
                                   force_majeure, wait) for o in contract.spot_offers]

    best = min(options, key=lambda o: o.expected_cost)
    net_savings = wait.expected_cost - best.expected_cost
    slack_h = deadline_left_h - wait.arrival_hours

    # Status: financial exposure first, then operational risk
    if wait.expected_cost > 0:
        status = "critical"
    elif stopped or s.speed_kmh < cfg.slow_speed_kmh or slack_h < cfg.at_risk_slack_hours:
        status = "delayed"
    else:
        status = "on-time"

    confidence = 0.0
    if best.kind == "relief":
        margin = net_savings / wait.expected_cost if wait.expected_cost else 0.0
        confidence = incidents.certainty(incident) * best.reliability * (0.7 + 0.3 * min(1.0, margin / 0.3))
        big_enough = net_savings >= max(cfg.min_savings_abs, cfg.min_savings_ratio * wait.expected_cost)
        recommendation = EXECUTE if big_enough and confidence >= cfg.min_confidence else CONSIDER
    elif status != "on-time":
        recommendation = MONITOR
    else:
        recommendation = NONE

    incident_id = f"{s.truck_id}:{s.stopped_since}" if stopped and s.stopped_since else ""

    result = {
        "truck_id": s.truck_id,
        "status": status,
        "stopped": stopped,
        "stopped_minutes": _r(stopped_min, 1),
        "incident": incident,
        "incident_id": incident_id,
        "force_majeure": force_majeure,
        "remaining_km": _r(remaining_km, 1),
        "eta_hours": _r(wait.arrival_hours),
        "deadline_hours_left": _r(deadline_left_h),
        "slack_hours": _r(slack_h),
        "lateness_hours": _r(wait.lateness_hours),
        "exposure": _r(wait.expected_cost),
        "sla_penalty": _r(wait.sla_penalty),
        "spoilage_loss": _r(wait.spoilage_loss),
        "currency": contract.currency,
        "options": [{k: (_r(v) if isinstance(v, float) else v) for k, v in asdict(o).items()} for o in options],
        "best": best.label,
        "best_provider": best.provider,
        "recommendation": recommendation,
        "net_savings": _r(net_savings),
        "confidence": _r(confidence),
    }
    result["summary"] = summarize(result, contract)
    return result


def summarize(a: Dict, contract: Contract) -> str:
    """Deterministic one-paragraph explanation (also the LLM fallback)."""
    def m(x):
        return fmt(x, a["currency"])

    if a["recommendation"] in (EXECUTE, CONSIDER):
        best = next(o for o in a["options"] if o["label"] == a["best"])
        parts = [
            f"{a['truck_id']} is stopped ({a['incident'] or 'unexplained stop'}) with "
            f"{a['remaining_km']:.0f} km to go; waiting projects {a['lateness_hours']:.1f} h late "
            f"and {m(a['exposure'])} exposure for {contract.client}.",
            f"{best['label']} arrives in {best['arrival_hours']:.1f} h for {m(best['direct_cost'])} "
            f"(reliability {best['reliability']:.0%}), expected cost {m(best['expected_cost'])}.",
            f"Net expected saving {m(a['net_savings'])}.",
        ]
        if a["spoilage_loss"] > 0:
            parts.append(f"Avoids spoilage risk of {m(a['spoilage_loss'])} on perishable cargo.")
        return " ".join(parts)
    if a["force_majeure"]:
        return f"{a['truck_id']} delayed by {a['incident']}: force majeure under the contract, no SLA penalty."
    if a["status"] == "critical":
        return (f"{a['truck_id']} projects {m(a['exposure'])} exposure but no relief option is cheaper; "
                f"monitoring.")
    if a["status"] == "delayed":
        return f"{a['truck_id']} is at risk: {a['slack_hours']:.1f} h of slack, {a['remaining_km']:.0f} km left."
    return f"{a['truck_id']} on schedule with {a['slack_hours']:.1f} h of slack."
