"""
Build FleetFusion's demo fleet from a real, open dataset.

Source: "Delivery truck trips data" by Ram Thiagu, Kaggle, CC BY-SA 3.0
        https://www.kaggle.com/datasets/ramakrishnanthiyagu/delivery-truck-trips-data
        6,880 real Indian truck trips (2020), mostly automotive supply chain.

What we take from it (reliable fields only):
  - real lanes: origin/destination coordinates, distance, trip frequency, vehicle type, cargo
  - the shipper's own on-time / delayed flag (baseline for "without FleetFusion")
What we do NOT take: timestamps (actual_eta is when the trip was closed in their system, not true
arrival), driver names/phones, vehicle plates, customer names (replaced by anonymous sector labels).

Outputs (safe to commit; derived data is shared under CC BY-SA 3.0 with attribution):
  data/fleet/lanes.json       road-snapped lanes (OSRM over OpenStreetMap)
  data/fleet/fleet.json       demo trucks assigned to lanes
  data/fleet/stats.json       dataset statistics used for impact baselines
  data/contracts/GEN-*.json   one contract per lane (penalty rates are illustrative assumptions)

Usage:
  python scripts/build_fleet_dataset.py "data/external/Delivery truck trip data.xlsx" [--lanes 16]
"""

import argparse
import json
import math
import os
import random
import string
import time
import urllib.request

import pandas as pd

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OSRM = "https://router.project-osrm.org/route/v1/driving"

# Anonymised sectors (never show real customer names as if they were our customers)
SECTOR_KEYWORDS = [
    ("Automotive", ["leyland", "daimler", "ford", "tvs", "lucas", "srichakra", "mahindra", "maruti", "hyundai",
                    "tata", "bosch", "wabco", "auto"]),
    ("Engineering & construction", ["larsen", "l&t", "engineering", "construction"]),
    ("Telecom equipment", ["ericsson", "nokia", "telecom"]),
    ("Industrial equipment", ["otis", "elevator", "industrial", "abb", "siemens"]),
]

# Contract terms by sector: (penalty ₹/hour, cap ₹, grace minutes). ILLUSTRATIVE: real SLA data is not public.
SECTOR_TERMS = {
    "Automotive": (20000, 100000, 15),                # line-side just-in-time supply
    "Engineering & construction": (6000, 40000, 30),
    "Telecom equipment": (8000, 50000, 30),
    "Industrial equipment": (5000, 30000, 30),
    "Manufacturing": (6000, 40000, 30),
}

# Declared cargo value by vehicle size (₹). ILLUSTRATIVE.
CARGO_BY_VEHICLE = [("40 ft", 6000000), ("32 ft", 4000000), ("28 ft", 3000000), ("24", 2500000),
                    ("19 ft", 1500000)]

# Relief carrier quotes: FTL ₹45–85/km (published Indian rate guides) with an emergency premium.
BASE_RATE_PER_KM = 55
RELIEF_PROVIDERS = [  # (name, rate multiplier, pickup minutes, reliability, speed km/h)
    ("Highway Freight Co", 1.00, 60, 0.93, 48),
    ("SwiftLink Logistics", 1.20, 40, 0.96, 52),
    ("ExpressRelief Carriers", 1.45, 25, 0.90, 52),
]


def sector_of(customer: str) -> str:
    name = (customer or "").lower()
    for sector, words in SECTOR_KEYWORDS:
        if any(w in name for w in words):
            return sector
    return "Manufacturing"


def place_label(raw: str) -> str:
    """City-level label without company/plant names."""
    parts = [p.strip() for p in str(raw).split(",") if p.strip()]
    company_like = any(w in parts[0].upper() for w in (
        "LTD", "PLANT", "HUB", "LIMITED", "TVS", "LEYLAND", "INDIA", "PVT", "INDUSTRIES", "ENGINEERING",
        "COATING", "MOTORS", "LOGISTICS", "WAREHOUSE", "CORPORATION", "COMPANY", "ENTERPRISES", "WORKS",
        "AUTO", "TECH", "SEZ", "PARK", "&"))
    if len(parts) >= 3 and not company_like:
        return f"{parts[0].title()}, {parts[-2].title()}"
    return parts[-2].title() if len(parts) >= 2 else parts[0].title()


def cargo_value(vehicle: str) -> int:
    v = (vehicle or "").lower()
    for key, value in CARGO_BY_VEHICLE:
        if key in v:
            return value
    return 2500000


def osrm_route(o, d):
    """Road geometry [[lon, lat], ...] and road km; None if OSRM is unreachable."""
    url = f"{OSRM}/{o[1]},{o[0]};{d[1]},{d[0]}?overview=simplified&geometries=geojson"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "FleetFusion-demo"}),
                                    timeout=15) as r:
            body = json.loads(r.read())
        if body.get("code") == "Ok":
            route = body["routes"][0]
            return route["geometry"]["coordinates"], route["distance"] / 1000
    except Exception as e:
        print(f"  OSRM failed ({e}); using straight line")
    return None


def thin(coords, max_points=80):
    if len(coords) <= max_points:
        return coords
    step = math.ceil(len(coords) / max_points)
    return coords[::step] + [coords[-1]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--lanes", type=int, default=16)
    ap.add_argument("--trucks-per-lane", type=int, default=1)
    args = ap.parse_args()

    df = pd.read_excel(args.xlsx)
    total = len(df)
    delayed = int((df["delay"] == "R").sum())
    ontime = int((df["ontime"] == "G").sum())

    def ll(s):
        a, b = str(s).split(",")
        return float(a), float(b)

    df[["olat", "olon"]] = df["Org_lat_lon"].map(ll).tolist()
    df[["dlat", "dlon"]] = df["Des_lat_lon"].map(ll).tolist()
    km = df["TRANSPORTATION_DISTANCE_IN_KM"]
    lanes_df = df[km.between(60, 700)
                  & (((df.olat - df.dlat).abs() + (df.olon - df.dlon).abs()) > 0.3)
                  & df.olat.between(8, 20) & df.olon.between(74, 81)
                  & df.dlat.between(8, 20) & df.dlon.between(74, 81)]

    grouped = (lanes_df.groupby(["Origin_Location", "Destination_Location"])
               .agg(trips=("BookingID", "count"), km=("TRANSPORTATION_DISTANCE_IN_KM", "median"),
                    olat=("olat", "median"), olon=("olon", "median"), dlat=("dlat", "median"),
                    dlon=("dlon", "median"),
                    delayed=("delay", lambda x: (x == "R").sum()),
                    customer=("customerNameCode", lambda x: x.mode()[0]),
                    vehicle=("vehicleType", lambda x: x.mode()[0] if x.notna().any() else "32 FT Multi-Axle 14MT - HCV"),
                    material=("Material Shipped", lambda x: x.mode()[0] if x.notna().any() else "AUTO PARTS"))
               .sort_values("trips", ascending=False).reset_index())
    # Skip lanes whose two ends anonymise to the same place (e.g. two plants in one city)
    grouped = grouped[grouped.apply(lambda r: place_label(r.Origin_Location) != place_label(r.Destination_Location),
                                    axis=1)].reset_index(drop=True)

    # Stable anonymous customer labels per sector
    labels, counters = {}, {}
    for cust in grouped["customer"]:
        if cust not in labels:
            sec = sector_of(cust)
            counters[sec] = counters.get(sec, 0) + 1
            labels[cust] = f"{sec} customer {string.ascii_uppercase[counters[sec] - 1]}"

    lanes, contracts, rejected = [], [], []
    for _, row in grouped.iterrows():
        if len(lanes) >= args.lanes:
            break
        label = f"{place_label(row.Origin_Location)} → {place_label(row.Destination_Location)}"
        routed = osrm_route((row.olat, row.olon), (row.dlat, row.dlon))
        time.sleep(1.1)  # be polite to the public OSRM demo server
        if not routed:
            continue
        geometry, road_km = routed
        # Data quality: the dataset's coordinates must agree with its own stated distance
        ratio = road_km / float(row.km)
        if not 0.7 <= ratio <= 1.45:
            rejected.append({"lane": label, "dataset_km": float(row.km), "road_km": round(road_km, 1)})
            print(f"  rejected {label}: coordinates give {road_km:.0f} km vs {row.km:.0f} km stated")
            continue
        lane_id = f"L{len(lanes) + 1:02d}"
        print(f"{lane_id}: {label} ({row.trips} trips, {road_km:.0f} km)")
        sector = sector_of(row.customer)
        lanes.append({
            "lane_id": lane_id,
            "origin": place_label(row.Origin_Location),
            "destination": place_label(row.Destination_Location),
            "trips_in_dataset": int(row.trips),
            "delayed_share_in_dataset": round(float(row.delayed) / float(row.trips), 3),
            "dataset_km": float(row.km),
            "road_km": round(road_km, 1),
            "road_snapped": True,
            "vehicle_type": row.vehicle,
            "cargo": str(row.material).strip().title(),
            "sector": sector,
            "customer": labels[row.customer],
            "route": [[round(c[0], 5), round(c[1], 5)] for c in thin(geometry)],
        })

        rate, cap, grace = SECTOR_TERMS[sector]
        # Delivery window: just-in-time automotive supply runs tight (≈45 km/h + 1 h buffer); other
        # freight gets a looser window (≈40 km/h + 2 h loading buffer). ILLUSTRATIVE contract terms.
        if sector == "Automotive":
            sla = math.ceil((road_km / 45 + 1) * 2) / 2
        else:
            sla = math.ceil((road_km / 40 + 2) * 2) / 2
        offers = []
        for name, mult, pickup, rel, speed in RELIEF_PROVIDERS:
            price = max(6000, round(road_km * 0.6 * BASE_RATE_PER_KM * mult * 1.3, -2))
            offers.append({"provider": name, "cost": price, "pickup_eta_minutes": pickup,
                           "reliability": rel, "speed_kmh": speed})
        contracts.append({
            "contract_id": f"GEN-{lane_id}",
            "client": labels[row.customer],
            "route": f"{lanes[-1]['origin']} to {lanes[-1]['destination']}",
            "currency": "INR",
            "cargo_value": cargo_value(row.vehicle),
            "cargo": {"type": f"{lanes[-1]['cargo']} ({sector.lower()})"},
            "sla_hours": sla,
            "grace_minutes": grace,
            "penalty_per_hour": rate,
            "max_penalty": cap,
            "force_majeure": ["weather", "natural_disaster", "government_closure"],
            "source": "Generated from real lane distance (Kaggle 'Delivery truck trips data', CC BY-SA 3.0). "
                      "Penalty rates and cargo values are illustrative; relief prices use published ₹45-85/km rates.",
            "terms": (f"FREIGHT SERVICE AGREEMENT\n\nClient: {labels[row.customer]}\nLane: {lanes[-1]['origin']} to "
                      f"{lanes[-1]['destination']} ({road_km:.0f} km)\nDelivery window: {sla} hours from dispatch "
                      f"({grace} minute grace)\n\nPENALTY: Rs {rate:,} per hour of delay, capped at Rs {cap:,}.\n\n"
                      "FORCE MAJEURE: weather, natural disasters and government-mandated closures exempt from penalties."),
            "spot_market_alternatives": offers,
        })

    # Demo trucks: one per lane, staggered along the route so the map is populated from the start
    rng = random.Random(7)
    trucks = []
    for n, lane in enumerate(lanes):
        for k in range(args.trucks_per_lane):
            v = lane["vehicle_type"].lower()
            cruise = 45 if ("trailer" in v or "40 ft" in v) else 52
            trucks.append({
                "truck_id": f"TRK-{101 + len(trucks)}",
                "lane_id": lane["lane_id"],
                "contract_id": f"GEN-{lane['lane_id']}",
                "vehicle_type": lane["vehicle_type"],
                "cargo_value": cargo_value(lane["vehicle_type"]),
                "cruise_kmh": cruise,
                "start_progress": round(rng.uniform(0.05, 0.55), 2),
            })

    out_fleet = os.path.join(HERE, "data", "fleet")
    os.makedirs(out_fleet, exist_ok=True)
    json.dump(lanes, open(os.path.join(out_fleet, "lanes.json"), "w"), indent=1, ensure_ascii=False)
    json.dump(trucks, open(os.path.join(out_fleet, "fleet.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({
        "source": "Delivery truck trips data (Ram Thiagu, Kaggle), CC BY-SA 3.0",
        "url": "https://www.kaggle.com/datasets/ramakrishnanthiyagu/delivery-truck-trips-data",
        "trips_total": total,
        "trips_flagged_delayed": delayed,
        "trips_flagged_ontime": ontime,
        "delayed_share": round(delayed / total, 3),
        "lanes_selected": len(lanes),
        "selection": "South India, 60-700 km, origin != destination, most frequent lanes",
        "lanes_rejected_bad_coordinates": rejected,
        "notes": "Timestamps are not used: actual_eta reflects system closure, not true arrival.",
    }, open(os.path.join(out_fleet, "stats.json"), "w"), indent=1)
    for c in contracts:
        json.dump(c, open(os.path.join(HERE, "data", "contracts", f"{c['contract_id']}.json"), "w"), indent=2,
                  ensure_ascii=False)
    print(f"\nWrote {len(lanes)} lanes, {len(trucks)} trucks, {len(contracts)} contracts. "
          f"Dataset: {delayed}/{total} trips flagged delayed ({delayed / total:.0%}).")


if __name__ == "__main__":
    main()
