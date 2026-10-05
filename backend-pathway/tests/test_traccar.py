"""Traccar integration: payload mapping (shapes captured from a real Traccar 6.16 server)."""

from connectors.traccar import event_summary, position_to_reading
from core.incidents import infer_incident

FAULT_POSITION = {
    "position": {"fixTime": "2026-10-05T15:11:24.000+00:00", "latitude": 12.85, "longitude": 79.96, "speed": 0.0,
                 "attributes": {"ignition": False, "alarm": "fault", "dtcs": "P0217", "motion": False}},
    "device": {"name": "TRK-101", "uniqueId": "TRK-101", "status": "online"},
}


def test_position_maps_to_reading_with_unit_conversion():
    moving = {"position": {"fixTime": "2026-10-05T15:10:24.000+00:00", "latitude": 12.84, "longitude": 79.95,
                           "speed": 30.0, "attributes": {"ignition": True}},
              "device": {"uniqueId": "TRK-101"}}
    r = position_to_reading(moving)
    assert r["truck_id"] == "TRK-101" and r["speed_kmh"] == 55.6  # 30 knots
    assert r["ignition"] == 1 and r["fault_code"] == "" and not r["harsh_event"]


def test_fault_position_infers_breakdown_without_driver():
    r = position_to_reading(FAULT_POSITION)
    assert r["fault_code"] == "P0217" and r["ignition"] == 0
    assert infer_incident(r["incident"], r["fault_code"], r["harsh_event"], r["ignition"]) == "breakdown"


def test_crash_alarm_means_accident():
    payload = {**FAULT_POSITION, "position": {**FAULT_POSITION["position"],
                                              "attributes": {"alarm": "accident", "ignition": False}}}
    r = position_to_reading(payload)
    assert r["harsh_event"] and infer_incident("", r["fault_code"], r["harsh_event"], r["ignition"]) == "accident"


def test_incomplete_payload_is_ignored():
    assert position_to_reading({"position": {"latitude": 1.0}, "device": {}}) is None


def test_event_summary():
    ev = event_summary({"event": {"type": "alarm", "attributes": {"alarm": "fault"},
                                  "eventTime": "2026-10-05T15:11:24.000+00:00"},
                        "device": {"uniqueId": "TRK-101"}})
    assert ev == {"truck_id": "TRK-101", "type": "alarm", "detail": "fault", "time": "2026-10-05T15:11:24.000+00:00"}
