"""
Print FleetFusion's impact (with vs without) on the real lanes, plus a sensitivity grid.

    python scripts/impact_report.py [--trucks 100]
"""

import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.impact import ImpactAssumptions, simulate  # noqa: E402
from core.models import contract_from_json  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load():
    lanes = json.load(open(os.path.join(HERE, "data/fleet/lanes.json")))
    contracts = {c.contract_id: c for c in (contract_from_json(open(p).read())
                                            for p in glob.glob(os.path.join(HERE, "data/contracts/GEN-*.json")))}
    return lanes, contracts


def lakh(x: float) -> str:
    return f"₹{x / 1e5:,.1f} L"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trucks", type=int, default=100)
    args = ap.parse_args()
    lanes, contracts = load()
    base = simulate(lanes, contracts, ImpactAssumptions(trucks=args.trucks))
    t, f = base["per_incident"]["today"], base["per_incident"]["fleetfusion"]
    m = base["monthly"]
    print(f"Fleet: {args.trucks} trucks on {len(lanes)} real lanes (avg {base['avg_lane_km']} km), "
          f"{m['trips']} trips and {m['incidents']} incidents per month\n")
    print(f"{'Per incident':28}{'Today':>12}{'FleetFusion':>14}")
    for key, label in [("penalty", "Contract penalties"), ("relief_spend", "Relief spend"),
                       ("total_cost", "Total cost"), ("late_share", "Ends in late delivery"),
                       ("relief_share", "Relief booked")]:
        fmt = (lambda v: f"{v:.0%}") if "share" in key else (lambda v: f"₹{v:,.0f}")
        print(f"{label:28}{fmt(t[key]):>12}{fmt(f[key]):>14}")
    print(f"\nSaving: ₹{base['saving_per_incident']:,.0f} per incident ({base['cost_reduction_pct']}% lower cost), "
          f"{lakh(m['saving'])}/month, ₹{base['yearly_saving'] / 1e7:.2f} Cr/year; "
          f"{m['late_deliveries_avoided']} late deliveries avoided/month; CO₂ {m['extra_co2_kg']:+,} kg/month\n")

    print("Monthly saving by assumption (rows: incidents per 100 trips, cols: minutes until a stop is noticed today)")
    delays = [30, 60, 120]
    print(f"{'':>10}" + "".join(f"{d:>12} min" for d in delays))
    for rate in [4, 8, 12]:
        row = [simulate(lanes, contracts, ImpactAssumptions(trucks=args.trucks, incidents_per_100_trips=rate,
                                                            discovery_delay_min=d, samples=1500))["monthly"]["saving"]
               for d in delays]
        print(f"{rate:>7}/100" + "".join(f"{lakh(v):>16}" for v in row))


if __name__ == "__main__":
    main()
