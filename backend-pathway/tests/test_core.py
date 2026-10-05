"""Unit tests for the pure decision core (geo, penalties, telemetry fold, arbitrage)."""

import pytest

from core.arbitrage import CONSIDER, EXECUTE, MONITOR, NONE, TruckSnapshot, assess
from core.config import DecisionConfig
from core.geo import haversine_km, remaining_route_km, route_length_km
from core.models import Contract, SpotOffer
from core.penalty import sla_penalty, spoilage_loss
from core.telemetry import TruckState, fold

ROUTE = [[73.8567, 18.5204], [73.5, 18.7], [73.2, 18.9], [72.8777, 19.0760]]  # Pune -> Mumbai, ~120 km
NOW = 1_700_000_000


def contract(**over):
    base = dict(
        contract_id="C1", client="Acme", cargo_value=2_000_000, sla_hours=3, penalty_per_hour=24000,
        max_penalty=120000, grace_minutes=15, force_majeure=("weather",), currency="INR",
        spot_offers=(SpotOffer("Cheap", 16000, 45, 0.95, 60), SpotOffer("Fast", 19000, 30, 0.98, 65)),
    )
    base.update(over)
    return Contract(**base)


def snap(speed=0.0, stopped_for_s=60, incident="breakdown", elapsed_h=0.5, lon=73.6, lat=18.65, cruise=66):
    return TruckSnapshot(
        truck_id="T1", lon=lon, lat=lat, speed_kmh=speed, cruise_kmh=cruise, now=NOW,
        trip_started_at=NOW - int(elapsed_h * 3600),
        stopped_since=NOW - stopped_for_s if speed < 5 else 0, incident=incident, route=ROUTE,
    )


# ---- geo -------------------------------------------------------------------------------------
def test_haversine_known_distance():
    assert haversine_km([72.8777, 19.0760], [73.8567, 18.5204]) == pytest.approx(119, abs=3)  # Mumbai-Pune


def test_remaining_distance_decreases_along_route():
    total = route_length_km(ROUTE)
    assert remaining_route_km(ROUTE, ROUTE[0]) == pytest.approx(total, rel=1e-6)
    assert remaining_route_km(ROUTE, ROUTE[-1]) == pytest.approx(0, abs=1e-6)
    mid = remaining_route_km(ROUTE, ROUTE[2])
    assert 0 < mid < total


def test_off_route_position_adds_gap():
    # East of Pune while the route heads west: projection clamps to the start, gap is added
    behind = [ROUTE[0][0] + 0.2, ROUTE[0][1]]
    gap = haversine_km(behind, ROUTE[0])
    assert remaining_route_km(ROUTE, behind) == pytest.approx(route_length_km(ROUTE) + gap, rel=1e-6)


# ---- penalties -------------------------------------------------------------------------------
def test_sla_penalty_grace_and_cap():
    c = contract()
    assert sla_penalty(c, 0.2) == 0                          # within 15 min grace
    assert sla_penalty(c, 1.25) == pytest.approx(24000)      # 1 billable hour
    assert sla_penalty(c, 100) == 120000                     # capped


def test_spoilage_only_for_perishables_beyond_limit():
    assert spoilage_loss(contract(), 50) == 0
    cold = contract(perishable_max_transit_hours=10, spoilage_loss_fraction=0.4)
    assert spoilage_loss(cold, 9.9) == 0
    assert spoilage_loss(cold, 10.1) == pytest.approx(800_000)


def test_contract_from_dict_supports_legacy_fields():
    c = Contract.from_dict({"contract_id": "X", "delivery_deadline_hours": 4, "penalty_per_hour": 10,
                            "spot_market_alternatives": [{"provider": "P", "cost": 5, "eta_minutes": 20}]})
    assert c.sla_hours == 4 and c.spot_offers[0].pickup_eta_min == 20


# ---- telemetry fold --------------------------------------------------------------------------
def test_fold_tracks_stop_incident_and_cruise():
    s = fold(None, 100, 1, 1, 60.0, "", 50)
    s = fold(s, 101, 1, 1, 70.0, "", 50)
    assert TruckState(*s).cruise_kmh == pytest.approx(62.0)  # EMA alpha 0.2
    s = fold(s, 102, 1, 1, 0.0, "", 50)
    s = fold(s, 103, 1, 1, 0.0, "Breakdown", 50)
    s = fold(s, 104, 1, 1, 0.0, "", 50)                       # report sticks for the stop
    st = TruckState(*s)
    assert st.stopped_since == 102 and st.incident == "breakdown" and st.cruise_kmh == pytest.approx(62.0)
    s = fold(s, 105, 1, 1, 50.0, "", 50)                      # moving again clears the incident
    assert TruckState(*s).stopped_since == 0 and TruckState(*s).incident == ""


def test_fold_ignores_out_of_order_readings():
    s = fold(None, 200, 1, 1, 60.0, "", 0)
    assert fold(s, 150, 9, 9, 0.0, "accident", 0) == s


# ---- arbitrage -------------------------------------------------------------------------------
def test_moving_truck_with_slack_is_on_time():
    a = assess(snap(speed=68, incident=""), contract())
    assert a["status"] == "on-time" and a["recommendation"] == NONE
    assert len(a["options"]) == 1  # no relief offered to a moving truck


def test_short_unexplained_stop_is_delayed_not_critical():
    a = assess(snap(stopped_for_s=60, incident=""), contract())
    assert a["status"] == "delayed" and a["recommendation"] == MONITOR and a["exposure"] == 0


def test_breakdown_triggers_execute_with_positive_savings():
    a = assess(snap(), contract())
    assert a["status"] == "critical" and a["recommendation"] == EXECUTE
    wait = a["options"][0]
    best = next(o for o in a["options"] if o["label"] == a["best"])
    assert a["net_savings"] == pytest.approx(wait["expected_cost"] - best["expected_cost"], abs=0.02)
    assert a["net_savings"] > 0 and best["kind"] == "relief"


def test_best_option_minimizes_expected_cost_not_price():
    # With no grace, the faster (pricier) relief avoids more penalty and wins
    a = assess(snap(), contract(grace_minutes=0))
    relief = [o for o in a["options"] if o["kind"] == "relief"]
    assert a["best"] == min(relief, key=lambda o: o["expected_cost"])["label"]
    assert a["best_provider"] == "Fast"


def test_unreliable_provider_loses_value():
    reliable = assess(snap(), contract(spot_offers=(SpotOffer("P", 16000, 45, 0.99, 60),)))
    flaky = assess(snap(), contract(spot_offers=(SpotOffer("P", 16000, 45, 0.5, 60),)))
    assert flaky["net_savings"] < reliable["net_savings"]


def test_force_majeure_removes_penalty():
    a = assess(snap(incident="weather"), contract())
    assert a["force_majeure"] and a["sla_penalty"] == 0 and a["recommendation"] != EXECUTE


def test_perishable_cargo_drives_relief_even_with_small_penalty():
    cold = contract(penalty_per_hour=200, max_penalty=1000, sla_hours=3,
                    perishable_max_transit_hours=4, spoilage_loss_fraction=0.4)
    a = assess(snap(), cold)
    assert a["spoilage_loss"] == pytest.approx(800_000)
    assert a["recommendation"] == EXECUTE and a["net_savings"] > 600_000


def test_relief_not_worth_it_when_cheap_to_wait():
    cheap_sla = contract(penalty_per_hour=1000, max_penalty=4000)
    a = assess(snap(), cheap_sla)
    assert a["status"] == "critical" and a["recommendation"] == MONITOR and a["net_savings"] == 0


def test_marginal_savings_only_consider():
    cfg = DecisionConfig(min_savings_abs=200_000)
    a = assess(snap(), contract(), cfg)
    assert a["recommendation"] == CONSIDER


def test_output_is_json_serializable():
    import json
    json.dumps(assess(snap(), contract()))


# ---- driver-free incident inference ---------------------------------------------------------
def test_infer_incident_from_machine_signals():
    from core.incidents import infer_incident
    assert infer_incident("", "P0217", False) == "breakdown"      # engine DTC
    assert infer_incident("", "C0750", False) == "flat_tyre"      # tyre-pressure DTC
    assert infer_incident("", "", True) == "accident"             # crash sensor wins
    assert infer_incident("weather", "", False) == "weather"      # external feed label
    assert infer_incident("", "", False) == ""                    # unexplained stop


def test_inr_formatting():
    from core.money import fmt
    assert fmt(125000) == "₹1,25,000" and fmt(10000000) == "₹1,00,00,000" and fmt(950) == "₹950"
