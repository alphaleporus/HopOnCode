"""
Domain models for contracts and spot-market relief offers.
"""

import json
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Optional, Tuple


@dataclass(frozen=True)
class SpotOffer:
    """A relief carrier that can take over the cargo of a stranded truck."""
    provider: str
    cost: float                 # quoted price for pickup + delivery
    pickup_eta_min: float       # time for the relief vehicle to reach the stranded truck
    reliability: float          # historical probability the provider delivers as quoted (0..1)
    speed_kmh: float = 60.0     # expected average speed for the remaining leg
    transfer_min: float = 30.0  # cargo transshipment time at the breakdown site

    @staticmethod
    def from_dict(d: dict) -> "SpotOffer":
        return SpotOffer(
            provider=str(d["provider"]),
            cost=float(d["cost"]),
            pickup_eta_min=float(d.get("pickup_eta_minutes", d.get("eta_minutes", 60))),
            reliability=max(0.0, min(1.0, float(d.get("reliability", 0.9)))),
            speed_kmh=float(d.get("speed_kmh", 60.0)),
            transfer_min=float(d.get("transfer_minutes", 30.0)),
        )


@dataclass(frozen=True)
class Contract:
    contract_id: str
    client: str
    cargo_value: float
    sla_hours: float                    # delivery window measured from trip start
    penalty_per_hour: float
    max_penalty: float
    grace_minutes: float = 0.0
    currency: str = "USD"
    # Perishable cargo: total transit beyond this loses `spoilage_loss_fraction` of cargo value
    perishable_max_transit_hours: Optional[float] = None
    spoilage_loss_fraction: float = 0.0
    # Incident types that exempt the carrier from SLA penalties (force majeure)
    force_majeure: Tuple[str, ...] = ()
    spot_offers: Tuple[SpotOffer, ...] = field(default_factory=tuple)

    @staticmethod
    def from_dict(d: dict) -> "Contract":
        cargo = d.get("cargo", {}) or {}
        return Contract(
            contract_id=str(d["contract_id"]),
            client=str(d.get("client", "")),
            cargo_value=float(d.get("cargo_value", cargo.get("value", 0))),
            sla_hours=float(d.get("sla_hours", d.get("delivery_deadline_hours", 0))),
            penalty_per_hour=float(d.get("penalty_per_hour", 0)),
            max_penalty=float(d.get("max_penalty", float("inf"))),
            grace_minutes=float(d.get("grace_minutes", 0)),
            currency=str(d.get("currency", "USD")),
            perishable_max_transit_hours=(
                float(cargo["max_transit_hours"]) if cargo.get("max_transit_hours") is not None else None
            ),
            spoilage_loss_fraction=float(cargo.get("spoilage_loss_fraction", 0.0)),
            force_majeure=tuple(str(x).lower() for x in d.get("force_majeure", [])),
            spot_offers=tuple(SpotOffer.from_dict(o) for o in d.get("spot_market_alternatives", [])),
        )


@lru_cache(maxsize=4096)
def contract_from_json(raw: str) -> Contract:
    """Parse (and memoize) a contract JSON document.

    The streaming pipeline passes the same document on every telemetry tick,
    so caching on the raw text avoids re-parsing per update.
    """
    return Contract.from_dict(json.loads(raw))
