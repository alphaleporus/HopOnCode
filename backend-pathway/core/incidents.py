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
}

UNKNOWN_STOP_BASE_MIN = 20.0
UNKNOWN_STOP_CERTAINTY = 0.6


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
