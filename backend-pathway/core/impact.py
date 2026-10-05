"""
Impact: what FleetFusion changes, measured on identical incidents.

For thousands of sampled incidents on the real lanes and contracts, the same incident (same truck,
place, contract, and the same true duration that nobody knows in advance) is handled two ways:

  TODAY (without FleetFusion)
    The stop is noticed after `discovery_delay_min` (driver call, missed check-in), carriers are phoned
    for `manual_sourcing_min`, and for serious stops (breakdown, accident) the cheapest quote is booked.
    Everything else waits it out.
  WITH FLEETFUSION
    The tracker signal is seen after `ff_detection_min`; the engine's recommendation is executed when it
    says EXECUTE, otherwise the truck waits.

Both are scored on the realised outcome (true stop duration, relief success drawn from the carrier's
reliability): penalties + spoilage + relief spend, late deliveries, extra CO2. Results are then scaled to
a fleet using transparent, adjustable assumptions.
"""

import random
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

from .arbitrage import EXECUTE, TruckSnapshot, assess
from .config import DecisionConfig
from .geo import point_at_fraction, route_length_km
from .models import Contract, SpotOffer
from .penalty import is_force_majeure, sla_penalty, spoilage_loss

# Incident mix and true duration ranges (minutes). Same mix as the simulated trackers.
INCIDENT_MIX = {
    "breakdown": (0.25, (120, 300)),
    "flat_tyre": (0.20, (30, 90)),
    "traffic": (0.30, (15, 60)),
    "checkpoint": (0.15, (20, 60)),
    "accident": (0.05, (120, 360)),
    "weather": (0.05, (60, 180)),
}
# What a stopped truck reports, i.e. what FleetFusion's engine sees (traffic/checkpoint: engine idling)
SEEN_AS = {"traffic": "idling", "checkpoint": "idling"}
SERIOUS = {"breakdown", "accident"}


@dataclass
class ImpactAssumptions:
    trucks: int = 100
    incidents_per_100_trips: float = 8.0   # ASSUMPTION: disruptive stops (not routine halts) per 100 trips
    km_per_truck_day: float = 300.0        # published range for Indian trucks: 200–400 km/day
    working_days_per_month: int = 26
    discovery_delay_min: float = 60.0      # today: time until someone notices a stop
    manual_sourcing_min: float = 45.0      # today: phoning carriers for a replacement
    ff_detection_min: float = 3.0          # FleetFusion: tracker signal → recommendation
    samples: int = 2000
    seed: int = 7


@dataclass
class Outcome:
    penalty: float = 0.0
    spoilage: float = 0.0
    relief_spend: float = 0.0
    late: int = 0
    reliefs: int = 0
    extra_co2_kg: float = 0.0

    @property
    def total(self) -> float:
        return self.penalty + self.spoilage + self.relief_spend


def _realise(contract: Contract, cfg: DecisionConfig, rng: random.Random, incident: str, true_stop_h: float,
             remaining_km: float, drive_kmh: float, elapsed_h: float, decide_h: float,
             offer: Optional[SpotOffer], out: Outcome):
    """Score one incident under one decision against what actually happened."""
    wait_arrival = true_stop_h + remaining_km / drive_kmh  # hours from incident start
    arrival = wait_arrival
    if offer is not None:
        out.relief_spend += offer.cost
        out.reliefs += 1
        out.extra_co2_kg += offer.pickup_eta_min / 60 * offer.speed_kmh * cfg.co2_kg_per_km
        if rng.random() < offer.reliability:
            relief_arrival = decide_h + (offer.pickup_eta_min + offer.transfer_min) / 60 + remaining_km / offer.speed_kmh
            # Cargo goes with whichever moves first (if the truck is fixed sooner, it carries on)
            arrival = min(relief_arrival, wait_arrival)
    lateness = max(0.0, elapsed_h + arrival - contract.sla_hours)
    if lateness > contract.grace_minutes / 60:
        out.late += 1
    if not is_force_majeure(contract, incident):
        out.penalty += sla_penalty(contract, lateness)
    out.spoilage += spoilage_loss(contract, elapsed_h + arrival)


def simulate(lanes: List[Dict], contracts: Dict[str, Contract], a: ImpactAssumptions,
             cfg: Optional[DecisionConfig] = None) -> Dict:
    """Run the paired comparison. `lanes` need lane_id, route, road_km, trips_in_dataset."""
    cfg = cfg or DecisionConfig()
    rng = random.Random(a.seed)
    kinds = list(INCIDENT_MIX)
    weights = [INCIDENT_MIX[k][0] for k in kinds]
    lane_weights = [l.get("trips_in_dataset", 1) for l in lanes]
    today, ff = Outcome(), Outcome()
    now = 1_800_000_000

    for _ in range(a.samples):
        lane = rng.choices(lanes, weights=lane_weights)[0]
        contract = contracts[f"GEN-{lane['lane_id']}"]
        route = lane["route"]
        total_km = route_length_km(route)
        progress = rng.uniform(0.1, 0.9)
        cruise = rng.uniform(45, 52)
        elapsed_h = progress * total_km / cruise
        remaining_km = (1 - progress) * total_km
        kind = rng.choices(kinds, weights=weights)[0]
        lo, hi = INCIDENT_MIX[kind][1]
        true_stop_h = rng.uniform(lo, hi) / 60
        pos = point_at_fraction(route, progress)
        # One shared random stream per incident so relief success is drawn identically for both sides
        seed = rng.random()

        # --- today: late discovery, phone the cheapest carrier for serious stops ---
        decide_today = (a.discovery_delay_min + a.manual_sourcing_min) / 60
        offer_today = None
        if kind in SERIOUS and contract.spot_offers and decide_today < true_stop_h:
            offer_today = min(contract.spot_offers, key=lambda o: o.cost)
        _realise(contract, cfg, random.Random(seed), kind, true_stop_h, remaining_km, cruise, elapsed_h,
                 decide_today, offer_today, today)

        # --- FleetFusion: early signal, expected-cost optimal choice ---
        decide_ff = a.ff_detection_min / 60
        offer_ff = None
        if decide_ff < true_stop_h:
            snap = TruckSnapshot(truck_id="SIM", lon=pos[0], lat=pos[1], speed_kmh=0.0, cruise_kmh=cruise,
                                 now=now, trip_started_at=now - int(elapsed_h * 3600),
                                 stopped_since=now - int(decide_ff * 3600), incident=SEEN_AS.get(kind, kind),
                                 route=route)
            decision = assess(snap, contract, cfg)
            if decision["recommendation"] == EXECUTE:
                offer_ff = next(o for o in contract.spot_offers if o.provider == decision["best_provider"])
        _realise(contract, cfg, random.Random(seed), kind, true_stop_h, remaining_km, cruise, elapsed_h,
                 decide_ff, offer_ff, ff)

    n = a.samples
    avg_km = sum(l["road_km"] * w for l, w in zip(lanes, lane_weights)) / sum(lane_weights)
    trips_per_month = a.trucks * a.km_per_truck_day * a.working_days_per_month / avg_km
    incidents_per_month = trips_per_month * a.incidents_per_100_trips / 100

    def per_incident(o: Outcome) -> Dict:
        return {"penalty": o.penalty / n, "spoilage": o.spoilage / n, "relief_spend": o.relief_spend / n,
                "total_cost": o.total / n, "late_share": o.late / n, "relief_share": o.reliefs / n,
                "extra_co2_kg": o.extra_co2_kg / n}

    t, f = per_incident(today), per_incident(ff)
    saving = t["total_cost"] - f["total_cost"]
    return {
        "assumptions": asdict(a),
        "per_incident": {"today": {k: round(v, 3) for k, v in t.items()},
                         "fleetfusion": {k: round(v, 3) for k, v in f.items()}},
        "saving_per_incident": round(saving, 2),
        "cost_reduction_pct": round(100 * saving / t["total_cost"], 1) if t["total_cost"] else 0.0,
        "monthly": {
            "trips": round(trips_per_month),
            "incidents": round(incidents_per_month, 1),
            "cost_today": round(t["total_cost"] * incidents_per_month),
            "cost_with_ff": round(f["total_cost"] * incidents_per_month),
            "saving": round(saving * incidents_per_month),
            "late_deliveries_avoided": round((t["late_share"] - f["late_share"]) * incidents_per_month, 1),
            "extra_co2_kg": round((f["extra_co2_kg"] - t["extra_co2_kg"]) * incidents_per_month),
        },
        "yearly_saving": round(saving * incidents_per_month * 12),
        "avg_lane_km": round(avg_km, 1),
    }
