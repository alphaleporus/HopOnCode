"""
Fleet simulator: a stand-in for real telematics.

Emits the same telemetry a phone app or GPS device would POST to
/telemetry, so the pipeline cannot tell simulated and real trucks apart.

- Any fleet size: base demo trucks plus generated trucks between Indian cities
- Simulated clock with speed-up (SIM_SPEEDUP), so multi-hour trips play out in minutes
- Scripted scenario (data/scenarios/*.json) plus random incidents
- Relief dispatch: after an executed decision, the cargo resumes once the relief truck arrives
"""

import json
import math
import random
import threading
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

import pathway as pw

from core.geo import haversine_km

CITIES = {
    "Mumbai": [72.8777, 19.0760], "Pune": [73.8567, 18.5204], "Delhi": [77.1025, 28.7041],
    "Bangalore": [77.5946, 12.9716], "Hyderabad": [78.4867, 17.3850], "Chennai": [80.2707, 13.0827],
    "Kolkata": [88.3639, 22.5726], "Ahmedabad": [72.5714, 23.0225], "Jaipur": [75.7873, 26.9124],
    "Lucknow": [80.9462, 26.8467], "Nagpur": [79.0882, 21.1458], "Surat": [72.8311, 21.1702],
    "Indore": [75.8577, 22.7196], "Bhubaneswar": [85.8245, 20.2961], "Visakhapatnam": [83.2185, 17.6868],
}

BASE_FLEET = [
    {"truck_id": "TRK-402", "driver": "Priya Sharma", "contract_id": "CNT-2024-001", "cargo_value": 10000000,
     "cruise_kmh": 68, "trip_elapsed_min": 30,
     "route": [[73.8567, 18.5204], [73.5000, 18.7000], [73.2000, 18.9000], [72.8777, 19.0760]]},
    {"truck_id": "TRK-305", "driver": "Rajesh Kumar", "contract_id": "CNT-2024-002", "cargo_value": 7000000,
     "cruise_kmh": 72, "trip_elapsed_min": 60,
     "route": [[77.5946, 12.9716], [77.8000, 13.5000], [78.0000, 15.0000], [78.4867, 17.3850]]},
    {"truck_id": "TRK-518", "driver": "Amit Patel", "contract_id": "CNT-2024-003", "cargo_value": 8000000,
     "cruise_kmh": 65, "trip_elapsed_min": 45,
     "route": [[88.3639, 22.5726], [87.5000, 22.0000], [86.5000, 21.5000], [85.8245, 20.2961]]},
]

RANDOM_INCIDENTS = ["breakdown", "flat_tyre", "traffic", "accident", "weather", "checkpoint", ""]
# How each incident shows up in machine data (no driver input):
#   breakdown/flat tyre -> DTC from the tracker, accident -> crash sensor,
#   weather/checkpoint -> external feed label (weather API / geofence), traffic/"" -> nothing (unexplained stop)
SIGNALS = {"breakdown": {"fault_code": "P0217"}, "flat_tyre": {"fault_code": "C0750"},
           "accident": {"harsh_event": True}, "weather": {"incident": "weather"},
           "checkpoint": {"incident": "checkpoint", "engine_on": True}, "traffic": {"engine_on": True}}
# Incident duration ranges (sim minutes) used when random incidents clear on their own
RANDOM_DURATION_MIN = {"breakdown": (90, 300), "accident": (120, 360), "flat_tyre": (30, 90),
                       "traffic": (15, 60), "weather": (45, 180), "checkpoint": (20, 60), "": (10, 40)}


@dataclass
class SimTruck:
    truck_id: str
    driver: str
    contract_id: str
    cargo_value: float
    cruise_kmh: float
    route: List[List[float]]
    seg: int = 0
    seg_progress_km: float = 0.0
    trip_started_at: int = 0
    stopped: bool = False
    incident: str = ""          # label from an external feed (geofence / weather / TMS), not the driver
    fault_code: str = ""        # engine / vehicle DTC from the tracker
    harsh_event: bool = False   # crash sensor
    engine_on: bool = False     # ignition while stopped (queues/jams idle; breakdowns don't)
    silent: bool = False        # tracker not reporting (power cut, no network, tampering)
    resume_at: Optional[int] = None         # sim time the stop ends (None = until relief/resume)
    relief_speed_kmh: Optional[float] = None

    def position(self) -> List[float]:
        a, b = self.route[self.seg], self.route[min(self.seg + 1, len(self.route) - 1)]
        seg_len = haversine_km(a, b)
        t = 0.0 if seg_len == 0 else min(1.0, self.seg_progress_km / seg_len)
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]


class FleetSimulator:
    def __init__(self, fleet_size: int = 3, speedup: float = 1.0, scenario: Optional[List[Dict]] = None,
                 random_incidents_per_truck_hour: float = 0.0, seed: int = 42,
                 contract_sla_hours: Optional[Dict[str, float]] = None):
        self.seed, self.fleet_size = seed, fleet_size
        self._base_scenario = list(scenario or [])
        self.rng = random.Random(seed)
        self.speedup = speedup
        self.random_rate = random_incidents_per_truck_hour
        self.start_wall = time.time()
        self.sim_now = int(self.start_wall)
        self.lock = threading.Lock()
        self.scenario = sorted(scenario or [], key=lambda e: e["at_s"])
        self.trucks: Dict[str, SimTruck] = {}
        self.contract_sla_hours = contract_sla_hours or {s["contract_id"]: 9.0 for s in BASE_FLEET}
        self._build_fleet(fleet_size)

    # ---- fleet -----------------------------------------------------------------------------
    def _build_fleet(self, fleet_size: int):
        for spec in BASE_FLEET[:fleet_size]:
            self._add(spec)
        # Only city pairs some contract can serve: trip time at ~60 km/h within 75% of its SLA,
        # so generated trucks are on time unless something actually goes wrong
        lanes = []
        for o in CITIES:
            for d in CITIES:
                if o == d:
                    continue
                hours = haversine_km(CITIES[o], CITIES[d]) * 1.05 / 60.0
                fits = [cid for cid, sla in self.contract_sla_hours.items() if hours <= 0.75 * sla]
                if fits:
                    lanes.append((o, d, hours, fits))
        i = 0
        while len(self.trucks) < fleet_size:
            o, d, hours, fits = self.rng.choice(lanes)
            contract_id = self.rng.choice(fits)
            start, end = CITIES[o], CITIES[d]
            # 4-point route with a little lateral wobble so trucks don't overlap exactly
            route = [start]
            for f in (1 / 3, 2 / 3):
                route.append([start[0] + (end[0] - start[0]) * f + self.rng.uniform(-0.15, 0.15),
                              start[1] + (end[1] - start[1]) * f + self.rng.uniform(-0.15, 0.15)])
            route.append(end)
            self._add({"truck_id": f"TRK-{1000 + i}", "driver": f"Driver {1000 + i}",
                       "contract_id": contract_id,
                       "cargo_value": self.rng.choice([1500000, 2500000, 4000000, 10000000]),
                       "cruise_kmh": self.rng.uniform(55, 72),
                       "trip_elapsed_min": self.rng.uniform(0, hours * 60 * 0.5), "route": route})
            i += 1

    def _add(self, spec: Dict):
        t = SimTruck(truck_id=spec["truck_id"], driver=spec["driver"], contract_id=spec["contract_id"],
                     cargo_value=spec["cargo_value"], cruise_kmh=spec["cruise_kmh"], route=spec["route"])
        # Trucks start already en route, consistent with their elapsed trip time
        self._advance(t, spec["cruise_kmh"] * spec["trip_elapsed_min"] / 60.0)
        t.trip_started_at = self.sim_now - int(spec["trip_elapsed_min"] * 60)
        self.trucks[t.truck_id] = t

    def registry(self) -> List[Dict]:
        return [{"truck_id": t.truck_id, "driver": t.driver, "contract_id": t.contract_id,
                 "cargo_value": float(t.cargo_value), "route": json.dumps(t.route),
                 "nominal_cruise_kmh": float(t.cruise_kmh)} for t in self.trucks.values()]

    # ---- movement --------------------------------------------------------------------------
    def _advance(self, t: SimTruck, km: float) -> bool:
        """Move km along the route. Returns True when the destination is reached."""
        while km > 0 and t.seg < len(t.route) - 1:
            seg_len = haversine_km(t.route[t.seg], t.route[t.seg + 1])
            left = seg_len - t.seg_progress_km
            if km < left:
                t.seg_progress_km += km
                return False
            km -= left
            t.seg += 1
            t.seg_progress_km = 0.0
        return t.seg >= len(t.route) - 1

    def tick(self, real_dt: float) -> List[Dict]:
        """Advance the simulation by real_dt wall seconds and return telemetry readings."""
        with self.lock:
            sim_dt = real_dt * self.speedup
            self.sim_now += int(round(sim_dt))
            self._run_scenario()
            readings = []
            for t in self.trucks.values():
                self._maybe_random_incident(t, sim_dt)
                if t.silent:
                    continue  # tracker offline: no reading at all
                if t.stopped and t.resume_at is not None and self.sim_now >= t.resume_at:
                    self._clear(t)
                speed = 0.0
                if not t.stopped:
                    speed = t.relief_speed_kmh or t.cruise_kmh
                    speed *= self.rng.uniform(0.93, 1.05)  # GPS speed jitter
                    if self._advance(t, speed * sim_dt / 3600.0):
                        self._new_trip(t)
                lon, lat = t.position()
                readings.append({
                    "truck_id": t.truck_id, "ts": self.sim_now, "lat": lat, "lon": lon,
                    "speed_kmh": round(speed, 1), "incident": t.incident if t.stopped else "",
                    "fault_code": t.fault_code if t.stopped else "", "harsh_event": t.harsh_event and t.stopped,
                    "ignition": 1 if (not t.stopped or t.engine_on) else 0,
                    "trip_started_at": t.trip_started_at,
                })
            return readings

    @staticmethod
    def _clear(t: SimTruck):
        t.stopped, t.incident, t.fault_code, t.harsh_event, t.resume_at = False, "", "", False, None
        t.engine_on = False

    @staticmethod
    def _apply_signals(t: SimTruck, kind: str):
        sig = SIGNALS.get(kind, {})
        t.incident = sig.get("incident", "")
        t.fault_code = sig.get("fault_code", "")
        t.harsh_event = sig.get("harsh_event", False)
        t.engine_on = sig.get("engine_on", False)

    def _new_trip(self, t: SimTruck):
        """Delivered: turn around for the next job so the demo runs forever."""
        t.route = list(reversed(t.route))
        t.seg, t.seg_progress_km = 0, 0.0
        t.trip_started_at = self.sim_now
        t.relief_speed_kmh = None

    def _maybe_random_incident(self, t: SimTruck, sim_dt: float):
        if self.random_rate <= 0 or t.stopped:
            return
        if self.rng.random() < 1 - math.exp(-self.random_rate * sim_dt / 3600.0):
            kind = self.rng.choice(RANDOM_INCIDENTS)
            lo, hi = RANDOM_DURATION_MIN[kind]
            t.stopped = True
            self._apply_signals(t, kind)
            t.resume_at = self.sim_now + int(self.rng.uniform(lo, hi) * 60)

    def _run_scenario(self):
        elapsed_real = time.time() - self.start_wall
        while self.scenario and self.scenario[0]["at_s"] <= elapsed_real:
            ev = self.scenario.pop(0)
            t = self.trucks.get(ev["truck_id"])
            if not t:
                continue
            if ev["action"] == "stop":
                t.stopped, t.resume_at = True, None
                print(f"🎬 Scenario: {t.truck_id} stopped (no signal yet)")
            elif ev["action"] == "signal":
                # Machine data from the tracker: DTC and/or crash sensor
                t.fault_code = ev.get("fault_code", t.fault_code)
                t.harsh_event = ev.get("harsh_event", t.harsh_event)
                print(f"🎬 Scenario: {t.truck_id} telematics fault_code={t.fault_code or '-'} harsh={t.harsh_event}")
            elif ev["action"] == "label":
                # External system label (TMS event, geofence, weather feed, dispatcher)
                t.incident = ev["incident"]
                print(f"🎬 Scenario: {t.truck_id} labelled '{t.incident}'")
            elif ev["action"] == "resume":
                self._clear(t)
            elif ev["action"] == "silent":
                t.silent = True
                print(f"🎬 Scenario: {t.truck_id} tracker went silent")
            elif ev["action"] == "reconnect":
                t.silent = False
                print(f"🎬 Scenario: {t.truck_id} tracker back online")

    # ---- demo controls (presentation only; disable with DEMO_CONTROLS=false) -----------------
    # Trucks (and the machine signal to send) that produce a clear relief recommendation under the
    # sample contracts: TRK-402 engine fault on a just-in-time contract; TRK-305 crash on a vaccine
    # load, where the longer stop pushes the cargo past its cold-chain limit.
    DEMO_BREAKDOWNS = {"TRK-402": {"fault_code": "P0217"}, "TRK-305": {"harsh_event": True}}

    def trigger_breakdown(self) -> Optional[str]:
        """Stop a moving truck now and send its machine signal 4 s later, so the alert plays out live."""
        with self.lock:
            moving = [tid for tid, t in self.trucks.items() if not t.stopped and not t.silent]
            preferred = [tid for tid in self.DEMO_BREAKDOWNS if tid in moving]
            truck_id = (preferred or moving or [None])[0]
            if truck_id is None:
                return None
            now = time.time() - self.start_wall
            signal = self.DEMO_BREAKDOWNS.get(truck_id, {"fault_code": "P0217"})
            self.scenario += [{"at_s": now, "truck_id": truck_id, "action": "stop"},
                              {"at_s": now + 4, "truck_id": truck_id, "action": "signal", **signal}]
            self.scenario.sort(key=lambda e: e["at_s"])
            return truck_id

    def reset(self):
        """Put every truck back at its starting point and replay the scripted scenario from now.

        The simulated clock keeps moving forward, so the pipeline sees normal, in-order readings.
        """
        with self.lock:
            self.rng = random.Random(self.seed)
            self.trucks = {}
            self._build_fleet(self.fleet_size)
            self.start_wall = time.time()
            self.scenario = sorted(self._base_scenario, key=lambda e: e["at_s"])

    # ---- control from the decision layer ----------------------------------------------------
    def dispatch_relief(self, truck_id: str, pickup_eta_min: float, transfer_min: float, speed_kmh: float):
        """Relief carrier takes over: cargo resumes after pickup + transfer, at the relief speed."""
        with self.lock:
            t = self.trucks.get(truck_id)
            if t and t.stopped:
                t.resume_at = self.sim_now + int((pickup_eta_min + transfer_min) * 60)
                t.relief_speed_kmh = speed_kmh


class TelemetrySubject(pw.io.python.ConnectorSubject):
    def __init__(self, sim: FleetSimulator, tick_seconds: float = 1.0):
        super().__init__()
        self.sim = sim
        self.tick_seconds = tick_seconds

    def run(self):
        last = time.time()
        while True:
            time.sleep(self.tick_seconds)
            now = time.time()
            for r in self.sim.tick(now - last):
                self.next(**r)
            last = now
            self.commit()


class RegistrySubject(pw.io.python.ConnectorSubject):
    """Static truck metadata (driver, contract, route). Emitted once."""

    def __init__(self, sim: FleetSimulator):
        super().__init__()
        self.sim = sim

    def run(self):
        for row in self.sim.registry():
            self.next(**row)
        self.commit()
        # Keep the source open so the pipeline stays in streaming mode
        while True:
            time.sleep(3600)
