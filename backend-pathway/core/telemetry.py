"""
Per-truck telemetry state, folded one reading at a time.

Used as a Pathway stateful reducer, so memory per truck is O(1) no matter
how long the stream runs (no unbounded history like a plain groupby).
The state is a plain tuple so Pathway can store it natively.
"""

from typing import NamedTuple, Optional


class TruckState(NamedTuple):
    ts: int                 # event time of latest reading (epoch seconds)
    lat: float
    lon: float
    speed_kmh: float
    cruise_kmh: float       # EMA of speed while moving
    stopped_since: int      # event time the current stop began, 0 if moving
    incident: str           # reported incident type for the current stop ("" if none)
    trip_started_at: int    # event time the current trip was dispatched
    readings: int


CRUISE_EMA_ALPHA = 0.2


def fold(
        state: Optional[tuple],
        ts: int,
        lat: float,
        lon: float,
        speed_kmh: float,
        incident: str,
        trip_started_at: int,
        stop_speed_kmh: float = 5.0,
) -> tuple:
    """Return the new state after one telemetry reading."""
    incident = (incident or "").strip().lower()

    if state is None:
        moving = speed_kmh >= stop_speed_kmh
        return tuple(TruckState(
            ts=ts, lat=lat, lon=lon, speed_kmh=speed_kmh,
            cruise_kmh=speed_kmh if moving else 0.0,
            stopped_since=0 if moving else ts,
            incident="" if moving else incident,
            trip_started_at=trip_started_at,
            readings=1,
        ))

    prev = TruckState(*state)
    if ts < prev.ts:
        # Late / out-of-order reading: keep the newer state
        return state

    moving = speed_kmh >= stop_speed_kmh
    if moving:
        cruise = speed_kmh if prev.cruise_kmh == 0 else (
                CRUISE_EMA_ALPHA * speed_kmh + (1 - CRUISE_EMA_ALPHA) * prev.cruise_kmh)
        stopped_since, current_incident = 0, ""
    else:
        cruise = prev.cruise_kmh
        stopped_since = prev.stopped_since or ts
        # A report sticks for the whole stop; a new report replaces it
        current_incident = incident or prev.incident

    return tuple(TruckState(
        ts=ts, lat=lat, lon=lon, speed_kmh=speed_kmh, cruise_kmh=cruise,
        stopped_since=stopped_since, incident=current_incident,
        trip_started_at=trip_started_at or prev.trip_started_at,
        readings=prev.readings + 1,
    ))
