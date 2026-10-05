"""
Incident model: how long is a stopped truck likely to stay stopped?

Known incident types (reported by the driver app or telematics fault codes)
use a typical-duration profile. Unexplained stops use the Lindy heuristic:
a stop that has already lasted t is expected to last about t more, floored
at a base duration. Both are deliberately simple, explainable, and tunable
per fleet from historical data.
"""

from typing import Dict, Optional

# Typical total duration (minutes) and how certain we are about it (0..1)
INCIDENT_PROFILES: Dict[str, Dict[str, float]] = {
    "breakdown": {"typical_min": 180, "certainty": 0.9},
    "accident": {"typical_min": 240, "certainty": 0.85},
    "flat_tyre": {"typical_min": 60, "certainty": 0.9},
    "traffic": {"typical_min": 45, "certainty": 0.7},
    "weather": {"typical_min": 120, "certainty": 0.6},
    "checkpoint": {"typical_min": 40, "certainty": 0.75},
    # Basic AIS-140 tier: stopped with the engine running usually means a queue/jam, not a breakdown
    "idling": {"typical_min": 30, "certainty": 0.65},
}

UNKNOWN_STOP_BASE_MIN = 20.0
UNKNOWN_STOP_CERTAINTY = 0.6


def infer_incident(reported: Optional[str], fault_code: Optional[str], harsh_event: bool,
                   ignition: int = -1) -> str:
    """Classify a stop from machine signals only: no driver input required.

    Precedence: crash sensor > engine/vehicle fault code > label from an
    integrated system (TMS event, geofence, weather feed) > ignition state.
    `ignition` is 1 (on), 0 (off) or -1 (unknown); basic AIS-140 trackers report it.
    Engine-on while stopped reads as idling in a queue; anything else stays ""
    and is handled as an unexplained stop. (Dispatcher overrides are applied later,
    in the pipeline, and win over all of these.)
    """
    if harsh_event:
        return "accident"
    code = (fault_code or "").strip().upper()
    if code:
        # OBD-II / J1939 style: C-codes are chassis (tyre pressure, brakes); P/B/U imply the truck can't continue
        return "flat_tyre" if code.startswith("C07") else "breakdown"
    label = normalize(reported)
    if label:
        return label
    return "idling" if ignition == 1 else ""


def normalize(incident: Optional[str]) -> str:
    return (incident or "").strip().lower().replace(" ", "_")


def expected_remaining_stop_hours(incident: Optional[str], stopped_minutes: float) -> float:
    """Expected additional stop time (hours) for a truck stopped `stopped_minutes` so far."""
    kind = normalize(incident)
    profile = INCIDENT_PROFILES.get(kind)
    if profile:
        typical = profile["typical_min"]
        # Past the typical duration, assume a quarter of it still remains
        remaining = max(typical - stopped_minutes, typical * 0.25)
    else:
        remaining = max(UNKNOWN_STOP_BASE_MIN, stopped_minutes)
    return remaining / 60.0


def certainty(incident: Optional[str]) -> float:
    profile = INCIDENT_PROFILES.get(normalize(incident))
    return profile["certainty"] if profile else UNKNOWN_STOP_CERTAINTY
