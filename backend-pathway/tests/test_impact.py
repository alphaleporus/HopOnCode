"""Impact comparison: paired, deterministic, and never rewards FleetFusion for free."""

import glob
import json

from core.impact import ImpactAssumptions, simulate
from core.models import contract_from_json

LANES = json.load(open("data/fleet/lanes.json"))
CONTRACTS = {c.contract_id: c for c in (contract_from_json(open(p).read()) for p in glob.glob("data/contracts/GEN-*.json"))}


def run(**kw):
    return simulate(LANES, CONTRACTS, ImpactAssumptions(samples=600, **kw))


def test_deterministic_for_a_seed():
    assert run()["saving_per_incident"] == run()["saving_per_incident"]


def test_fleetfusion_cheaper_and_fewer_late_deliveries():
    r = run()
    t, f = r["per_incident"]["today"], r["per_incident"]["fleetfusion"]
    assert f["total_cost"] < t["total_cost"] and f["late_share"] <= t["late_share"]


def test_saving_shrinks_when_today_reacts_instantly():
    slow = run(discovery_delay_min=120)["saving_per_incident"]
    fast = run(discovery_delay_min=0, manual_sourcing_min=0)["saving_per_incident"]
    assert fast < slow


def test_monthly_saving_scales_with_fleet_size():
    small, big = run(trucks=50)["monthly"]["saving"], run(trucks=200)["monthly"]["saving"]
    assert abs(big - 4 * small) <= 4  # rounding only
