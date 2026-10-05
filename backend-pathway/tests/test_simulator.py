"""Fleet simulator behaviour (no Pathway runtime needed)."""

from connectors.fleet_simulator import FleetSimulator
from core.geo import remaining_route_km


def test_generates_requested_fleet_size():
    sim = FleetSimulator(fleet_size=250)
    assert len(sim.trucks) == 250
    assert len({r["truck_id"] for r in sim.registry()}) == 250


def test_trucks_progress_along_route():
    sim = FleetSimulator(fleet_size=1, speedup=60)
    t = sim.trucks["TRK-402"]
    before = remaining_route_km(t.route, t.position())
    readings = sim.tick(10)  # 10 real s x60 = 10 sim minutes at ~68 km/h ≈ 11 km
    after = remaining_route_km(t.route, t.position())
    assert 8 < before - after < 14
    assert readings[0]["speed_kmh"] > 0 and readings[0]["ts"] == sim.sim_now


def test_scenario_stop_and_relief_resume():
    sim = FleetSimulator(fleet_size=1, speedup=60,
                         scenario=[{"at_s": 0, "truck_id": "TRK-402", "action": "stop"},
                                   {"at_s": 0, "truck_id": "TRK-402", "action": "signal", "fault_code": "P0217"}])
    r = sim.tick(1)[0]
    assert r["speed_kmh"] == 0 and r["fault_code"] == "P0217" and r["incident"] == ""  # machine signal, no label
    sim.dispatch_relief("TRK-402", pickup_eta_min=30, transfer_min=0, speed_kmh=65)
    assert sim.tick(10)[0]["speed_kmh"] == 0      # 10 sim min: relief still en route
    assert sim.tick(30)[0]["speed_kmh"] > 0       # 30 more sim min: cargo moving again


def test_random_incidents_occur_and_clear():
    sim = FleetSimulator(fleet_size=50, speedup=3600, random_incidents_per_truck_hour=1.0)
    stopped = sum(r["speed_kmh"] == 0 for r in sim.tick(1))
    assert stopped > 10  # ~63% expected after one sim hour
