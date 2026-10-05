from core.arbitrage import EXECUTE
from realtime.hub import RealtimeHub


def _hub_with_open_decision():
    sent = []
    hub = RealtimeHub(on_command=sent.append)
    option = {"label": "Relief: QuickFreight", "provider": "QuickFreight", "direct_cost": 9000.0,
              "sla_penalty": 0.0, "spoilage_loss": 0.0, "extra_co2_kg": 12.0}
    wait = {"label": "Wait", "sla_penalty": 20000.0, "spoilage_loss": 0.0}
    hub.fleet.rows["k"] = {"contract_id": "GEN-L01", "decision": {
        "truck_id": "TRK-101", "incident_id": "TRK-101:1000", "recommendation": EXECUTE, "resolved": False,
        "best": option["label"], "options": [wait, option], "ts": 1000, "net_savings": 11000.0,
        "incident": "breakdown", "exposure": 20000.0, "currency": "INR"}}
    return hub, sent


def test_double_approval_books_relief_once():
    hub, sent = _hub_with_open_decision()
    first = hub._handle_command({"type": "execute_arbitrage", "truckId": "TRK-101"})
    # Second click (or second dashboard tab) before the pipeline marks the incident resolved
    second = hub._handle_command({"type": "execute_arbitrage", "truckId": "TRK-101"})
    assert first["type"] == "arbitrage_executed"
    assert second["type"] == "error"
    assert len(sent) == 1 and len(hub.decisions) == 1
