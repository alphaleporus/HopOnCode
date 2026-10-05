"""
Geospatial helpers. Coordinates are [lon, lat] (GeoJSON order) throughout.
"""

import math
from typing import List, Sequence, Tuple

EARTH_RADIUS_KM = 6371.0088


def haversine_km(a: Sequence[float], b: Sequence[float]) -> float:
    """Great-circle distance in km between two [lon, lat] points."""
    lon1, lat1 = math.radians(a[0]), math.radians(a[1])
    lon2, lat2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(h)))


def route_length_km(route: Sequence[Sequence[float]]) -> float:
    return sum(haversine_km(route[i], route[i + 1]) for i in range(len(route) - 1))


def _project_on_segment(p, a, b) -> Tuple[float, List[float]]:
    """Project p onto segment a-b using a local equirectangular approximation.

    Returns (t, projected_point) with t clamped to [0, 1].
    """
    kx = math.cos(math.radians((a[1] + b[1]) / 2))
    ax, ay = a[0] * kx, a[1]
    bx, by = b[0] * kx, b[1]
    px, py = p[0] * kx, p[1]
    dx, dy = bx - ax, by - ay
    seg_sq = dx * dx + dy * dy
    t = 0.0 if seg_sq == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_sq))
    return t, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]


def remaining_route_km(route: Sequence[Sequence[float]], position: Sequence[float]) -> float:
    """Distance left along the route from the point on it closest to `position`.

    Snapping to the route keeps the estimate stable under GPS noise and
    off-route readings; the off-route gap itself is added so a truck that
    has strayed is not reported as closer than it is.
    """
    if not route:
        return 0.0
    if len(route) == 1:
        return haversine_km(position, route[0])

    best = None  # (offroute_km, segment_index, projected_point)
    for i in range(len(route) - 1):
        _, proj = _project_on_segment(position, route[i], route[i + 1])
        off = haversine_km(position, proj)
        if best is None or off < best[0]:
            best = (off, i, proj)

    off, i, proj = best
    remaining = haversine_km(proj, route[i + 1])
    remaining += sum(haversine_km(route[j], route[j + 1]) for j in range(i + 1, len(route) - 1))
    return remaining + off


def point_at_fraction(route: Sequence[Sequence[float]], fraction: float) -> List[float]:
    """Point `fraction` (0..1) of the way along the route, by distance."""
    if len(route) < 2:
        return list(route[0]) if route else [0.0, 0.0]
    target = route_length_km(route) * max(0.0, min(1.0, fraction))
    for i in range(len(route) - 1):
        seg = haversine_km(route[i], route[i + 1])
        if target <= seg or i == len(route) - 2:
            t = 0.0 if seg == 0 else min(1.0, target / seg)
            a, b = route[i], route[i + 1]
            return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
        target -= seg
    return list(route[-1])
