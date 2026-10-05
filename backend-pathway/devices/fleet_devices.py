"""
Fleet of simulated GPS trackers on real lanes, reporting to a real telematics platform.

Stands in for physical trucks: each "device" drives a road-snapped lane from the dataset
(data/fleet/*.json) and reports to Traccar exactly like a hardware tracker or the Traccar Client
app would (OsmAnd HTTP protocol). FleetFusion never talks to this program for telemetry: it only
sees what Traccar forwards. Incidents arise on their own and surface only as machine signals
(engine fault codes, crash alarm, ignition state, or the tracker going silent).

It also plays the order system: it registers each trip with FleetFusion (POST /trucks) and listens
for FleetFusion's decision webhook, so an approved relief truck actually takes over the cargo.

    python devices/fleet_devices.py                 # 30x time compression, incidents on
    python scripts/inject.py breakdown TRK-104      # cause an incident on demand (demo safety net)

Environment:
    TRACCAR_DEVICE_URL   default http://localhost:5055
    FLEETFUSION_API      default http://localhost:8090
    DEVICE_CONTROL_PORT  default 9099 (inject + decision webhook)
    SIM_SPEEDUP          default 30 (simulated seconds per real second)
    INCIDENT_RATE        incidents per truck per simulated hour, default 0.12
    FLEET_FILE / LANES_FILE  override data files
"""

import json
import math
import os
import random
import socketserver
import sys
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.geo import haversine_km  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KMH_TO_KNOTS = 1 / 1.852


class FastHTTPServer(ThreadingHTTPServer):
    """ThreadingHTTPServer tuned for bursty integrations.

    - no reverse-DNS lookup in server_bind (can hang for a long time on macOS)
    - a deep accept queue: the default of 5 drops connections when Traccar forwards a burst of
      positions and events every second, which shows up as every truck going "signal lost"
    """

    request_queue_size = 1024
    daemon_threads = True

    def server_bind(self):
        socketserver.TCPServer.server_bind(self)
        self.server_name, self.server_port = self.server_address[:2]

# How each incident looks in machine data, how long it lasts (sim minutes), and how likely it is
INCIDENTS = {
    "breakdown": {"weight": 0.25, "minutes": (120, 300), "fault_code": "P0217", "ignition": 0, "signal_after_min": 3},
    "flat_tyre": {"weight": 0.20, "minutes": (30, 90), "fault_code": "C0750", "ignition": 0, "signal_after_min": 2},
    "traffic": {"weight": 0.30, "minutes": (15, 60), "ignition": 1},
    "checkpoint": {"weight": 0.15, "minutes": (20, 60), "ignition": 1},
    "accident": {"weight": 0.05, "minutes": (120, 360), "alarm": "accident", "ignition": 0},
    "tracker_offline": {"weight": 0.05, "minutes": (60, 120), "silent": True},
}


@dataclass
class Device:
    truck_id: str
    lane: Dict
    contract_id: str
    cargo_value: float
    vehicle_type: str
    cruise_kmh: float
    route: List[List[float]] = field(default_factory=list)
    seg: int = 0
    seg_km: float = 0.0
    trip_started_at: int = 0
    incident: Optional[str] = None
    incident_started: int = 0
    resume_at: int = 0
    relief_speed: Optional[float] = None

    def position(self):
        a, b = self.route[self.seg], self.route[min(self.seg + 1, len(self.route) - 1)]
        seg_len = haversine_km(a, b)
        t = 0.0 if seg_len == 0 else min(1.0, self.seg_km / seg_len)
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

    def bearing(self):
        a, b = self.route[self.seg], self.route[min(self.seg + 1, len(self.route) - 1)]
        y = math.sin(math.radians(b[0] - a[0])) * math.cos(math.radians(b[1]))
        x = (math.cos(math.radians(a[1])) * math.sin(math.radians(b[1]))
             - math.sin(math.radians(a[1])) * math.cos(math.radians(b[1])) * math.cos(math.radians(b[0] - a[0])))
        return (math.degrees(math.atan2(y, x)) + 360) % 360

    def advance(self, km: float) -> bool:
        while km > 0 and self.seg < len(self.route) - 1:
            seg_len = haversine_km(self.route[self.seg], self.route[self.seg + 1])
            left = seg_len - self.seg_km
            if km < left:
                self.seg_km += km
                return False
            km -= left
            self.seg += 1
            self.seg_km = 0.0
        return self.seg >= len(self.route) - 1


class DeviceFleet:
    def __init__(self, speedup: float, incident_rate: float, traccar_url: str, api_url: str, seed: int = 11):
        self.speedup, self.incident_rate = speedup, incident_rate
        self.traccar_url, self.api_url = traccar_url.rstrip("/"), api_url.rstrip("/")
        self.rng = random.Random(seed)
        # The simulated clock runs ahead of real time; persist it so a restart continues forward instead of
        # jumping back (FleetFusion correctly ignores readings older than the newest one it has seen).
        self.clock_file = os.getenv("SIM_CLOCK_FILE", os.path.join(HERE, "output", ".device_clock"))
        try:
            saved = int(open(self.clock_file).read().strip())
        except (OSError, ValueError):
            saved = 0
        self.sim_now = max(int(time.time()), saved)
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="report")
        lanes = {l["lane_id"]: l for l in json.load(open(os.getenv("LANES_FILE", os.path.join(HERE, "data/fleet/lanes.json"))))}
        self.devices: Dict[str, Device] = {}
        for spec in json.load(open(os.getenv("FLEET_FILE", os.path.join(HERE, "data/fleet/fleet.json")))):
            lane = lanes[spec["lane_id"]]
            d = Device(truck_id=spec["truck_id"], lane=lane, contract_id=spec["contract_id"],
                       cargo_value=spec["cargo_value"], vehicle_type=spec["vehicle_type"],
                       cruise_kmh=spec["cruise_kmh"], route=[list(p) for p in lane["route"]])
            done_km = lane["road_km"] * spec["start_progress"]
            d.advance(done_km)
            d.trip_started_at = self.sim_now - int(done_km / d.cruise_kmh * 3600)
            self.devices[d.truck_id] = d
        for d in self.devices.values():  # register trips without blocking start-up
            threading.Thread(target=self.register_trip, args=(d,), daemon=True).start()

    # ---- order system side ---------------------------------------------------------------
    def register_trip(self, d: Device):
        body = {"truck_id": d.truck_id, "driver": d.vehicle_type, "contract_id": d.contract_id,
                "cargo_value": float(d.cargo_value), "route": json.dumps(d.route),
                "nominal_cruise_kmh": float(d.cruise_kmh), "trip_started_at": d.trip_started_at}
        try:
            req = urllib.request.Request(f"{self.api_url}/trucks", data=json.dumps(body).encode(), method="POST",
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=5).read()
        except Exception as e:
            print(f"⚠️  Could not register {d.truck_id} with FleetFusion: {e}")

    def on_decision(self, payload: Dict):
        """FleetFusion decision webhook: an approved relief truck takes over after the handover."""
        if payload.get("action") != "execute" or not payload.get("option"):
            return
        with self.lock:
            d = self.devices.get(payload["truck_id"])
            if d and d.incident:
                d.resume_at = self.sim_now + int(payload["option"]["handover_hours"] * 3600)
                d.relief_speed = payload["option"]["speed_kmh"]
                print(f"🚚 Relief accepted for {d.truck_id}: cargo moves again in "
                      f"{payload['option']['handover_hours']:.1f} sim-hours")

    # ---- incidents -----------------------------------------------------------------------
    def start_incident(self, d: Device, kind: str):
        lo, hi = INCIDENTS[kind]["minutes"]
        d.incident, d.incident_started = kind, self.sim_now
        d.resume_at = self.sim_now + int(self.rng.uniform(lo, hi) * 60)
        print(f"⚠️  {d.truck_id} incident: {kind} (on {d.lane['origin']} → {d.lane['destination']})")

    def inject(self, kind: str, truck_id: Optional[str] = None) -> Optional[str]:
        if kind not in INCIDENTS:
            raise ValueError(f"unknown incident '{kind}'; choose from {', '.join(INCIDENTS)}")
        with self.lock:
            if truck_id is None:
                moving = [d for d in self.devices.values() if not d.incident]
                if not moving:
                    return None
                # Prefer a just-in-time (automotive) truck on a short lane: least slack, so a stop really
                # threatens the deadline. Long lanes carry a bigger time buffer and usually just need monitoring.
                truck_id = min(moving, key=lambda d: (d.lane["sector"] != "Automotive", d.lane["road_km"])).truck_id
            d = self.devices[truck_id]
            self.start_incident(d, kind)
            return truck_id

    # ---- simulation ----------------------------------------------------------------------
    def tick(self, real_dt: float):
        reports = []
        with self.lock:
            sim_dt = real_dt * self.speedup
            self.sim_now += int(round(sim_dt))
            try:
                with open(self.clock_file, "w") as f:
                    f.write(str(self.sim_now))
            except OSError:
                pass
            for d in self.devices.values():
                if d.incident and self.sim_now >= d.resume_at:
                    d.incident = None
                if not d.incident and self.incident_rate > 0 and \
                        self.rng.random() < 1 - math.exp(-self.incident_rate * sim_dt / 3600):
                    kinds = list(INCIDENTS)
                    self.start_incident(d, self.rng.choices(kinds, weights=[INCIDENTS[k]["weight"] for k in kinds])[0])

                spec = INCIDENTS.get(d.incident or "", {})
                if spec.get("silent"):
                    continue  # tracker offline: nothing reaches Traccar
                params = {"id": d.truck_id, "timestamp": self.sim_now}
                if d.incident:
                    params.update(speed=0, ignition=str(bool(spec.get("ignition"))).lower())
                    minutes_in = (self.sim_now - d.incident_started) / 60
                    if spec.get("fault_code") and minutes_in >= spec.get("signal_after_min", 0):
                        params.update(dtcs=spec["fault_code"], alarm="fault")
                    if spec.get("alarm"):
                        params["alarm"] = spec["alarm"]
                else:
                    speed = (d.relief_speed or d.cruise_kmh) * self.rng.uniform(0.9, 1.06)
                    if d.advance(speed * sim_dt / 3600):
                        self.new_trip(d)
                    params.update(speed=round(speed * KMH_TO_KNOTS, 1), ignition="true")
                lon, lat = d.position()
                params.update(lat=round(lat, 6), lon=round(lon, 6), bearing=round(d.bearing()))
                reports.append(params)
        # Send in parallel; a slow or failed report never holds up the rest of the fleet
        failed = list(self.pool.map(self._send, reports))
        if any(failed):
            print(f"⚠️  {sum(failed)}/{len(reports)} Traccar reports failed this tick (will report again next tick)")

    def _send(self, params: Dict) -> bool:
        try:
            urllib.request.urlopen(f"{self.traccar_url}/?{urllib.parse.urlencode(params)}", timeout=2).read()
            return False
        except Exception:
            return True

    def new_trip(self, d: Device):
        """Delivered: next job runs the lane in reverse."""
        d.route = list(reversed(d.route))
        d.seg, d.seg_km, d.relief_speed = 0, 0.0, None
        d.trip_started_at = self.sim_now
        threading.Thread(target=self.register_trip, args=(d,), daemon=True).start()

    def status(self):
        with self.lock:
            return [{"truck_id": d.truck_id, "lane": f"{d.lane['origin']} → {d.lane['destination']}",
                     "incident": d.incident, "sector": d.lane["sector"]} for d in self.devices.values()]


def serve_control(fleet: DeviceFleet, port: int):
    class Handler(BaseHTTPRequestHandler):
        def _reply(self, code, body):
            data = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            self._reply(200, fleet.status())

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            if self.path == "/inject":
                try:
                    tid = fleet.inject(body.get("type", "breakdown"), body.get("truck_id"))
                    self._reply(200, {"truck_id": tid})
                except (ValueError, KeyError) as e:
                    self._reply(400, {"error": str(e)})
            elif self.path == "/decisions":
                fleet.on_decision(body)
                self._reply(200, {"ok": True})
            else:
                self._reply(404, {"error": "not found"})

        def log_message(self, *args):
            pass

    FastHTTPServer(("127.0.0.1", port), Handler).serve_forever()


def main():
    fleet = DeviceFleet(
        speedup=float(os.getenv("SIM_SPEEDUP", "30")),
        incident_rate=float(os.getenv("INCIDENT_RATE", "0.12")),
        traccar_url=os.getenv("TRACCAR_DEVICE_URL", "http://localhost:5055"),
        api_url=os.getenv("FLEETFUSION_API", "http://localhost:8090"),
    )
    port = int(os.getenv("DEVICE_CONTROL_PORT", "9099"))
    threading.Thread(target=serve_control, args=(fleet, port), daemon=True).start()
    print(f"📡 {len(fleet.devices)} trackers reporting to {fleet.traccar_url} at {fleet.speedup:g}x; "
          f"control on http://127.0.0.1:{port}")
    last = last_sync = time.time()
    while True:
        time.sleep(1)
        now = time.time()
        fleet.tick(now - last)
        last = now
        # Order-system sync: re-send active trips periodically so FleetFusion recovers after a restart
        if now - last_sync > 30:
            last_sync = now
            for d in list(fleet.devices.values()):
                threading.Thread(target=fleet.register_trip, args=(d,), daemon=True).start()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n🛑 Devices stopped")
