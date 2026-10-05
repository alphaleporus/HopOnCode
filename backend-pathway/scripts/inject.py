"""
Cause an incident on a simulated truck, from the backend (demo safety net).

The incident reaches FleetFusion the realistic way: the truck's tracker reports it to Traccar
(fault code, crash alarm, ignition off, or silence), Traccar forwards it, FleetFusion reacts.

    python scripts/inject.py list
    python scripts/inject.py breakdown            # picks the most valuable moving truck
    python scripts/inject.py accident TRK-107
    python scripts/inject.py tracker_offline TRK-103

Types: breakdown, flat_tyre, traffic, checkpoint, accident, tracker_offline
"""

import json
import os
import sys
import urllib.request

BASE = f"http://127.0.0.1:{os.getenv('DEVICE_CONTROL_PORT', '9099')}"


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return
    if sys.argv[1] == "list":
        for d in json.loads(urllib.request.urlopen(f"{BASE}/", timeout=5).read()):
            print(f"{d['truck_id']:9} {d['incident'] or 'moving':16} {d['sector']:28} {d['lane']}")
        return
    body = {"type": sys.argv[1]}
    if len(sys.argv) > 2:
        body["truck_id"] = sys.argv[2]
    req = urllib.request.Request(f"{BASE}/inject", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        result = json.loads(urllib.request.urlopen(req, timeout=5).read())
        print(f"Injected {body['type']} on {result['truck_id']}" if result.get("truck_id") else "No moving truck available")
    except urllib.error.HTTPError as e:
        print(json.loads(e.read()).get("error"))


if __name__ == "__main__":
    main()
