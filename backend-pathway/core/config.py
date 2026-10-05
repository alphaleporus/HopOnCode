"""
Tunable thresholds for status classification and recommendations.
All values can be overridden with environment variables.
"""

import os
from dataclasses import dataclass


def _f(name: str, default: float) -> float:
    return float(os.getenv(name, default))


@dataclass(frozen=True)
class DecisionConfig:
    stop_speed_kmh: float = 5.0          # below this a truck counts as stopped
    slow_speed_kmh: float = 40.0         # below this (while moving) a truck counts as slow
    min_cruise_kmh: float = 20.0         # floor for projected driving speed
    at_risk_slack_hours: float = 0.25    # on-time but less slack than this -> "delayed" (at risk)
    min_savings_abs: float = 100.0       # EXECUTE needs at least this saving...
    min_savings_ratio: float = 0.05      # ...and at least this share of the do-nothing cost
    min_confidence: float = 0.6          # below this an otherwise good option is only CONSIDER
    co2_kg_per_km: float = 0.9           # heavy truck emission factor (diesel, laden)

    @staticmethod
    def from_env() -> "DecisionConfig":
        return DecisionConfig(
            stop_speed_kmh=_f("FF_STOP_SPEED_KMH", 5.0),
            slow_speed_kmh=_f("FF_SLOW_SPEED_KMH", 40.0),
            min_cruise_kmh=_f("FF_MIN_CRUISE_KMH", 20.0),
            at_risk_slack_hours=_f("FF_AT_RISK_SLACK_HOURS", 0.25),
            min_savings_abs=_f("FF_MIN_SAVINGS_ABS", 100.0),
            min_savings_ratio=_f("FF_MIN_SAVINGS_RATIO", 0.05),
            min_confidence=_f("FF_MIN_CONFIDENCE", 0.6),
            co2_kg_per_km=_f("FF_CO2_KG_PER_KM", 0.9),
        )
