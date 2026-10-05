"""
Financial exposure of a delivery: SLA penalties and perishable spoilage.
"""

from .models import Contract


def sla_penalty(contract: Contract, lateness_hours: float) -> float:
    """Contractual penalty for arriving `lateness_hours` after the deadline."""
    billable = max(0.0, lateness_hours - contract.grace_minutes / 60.0)
    return min(billable * contract.penalty_per_hour, contract.max_penalty)


def spoilage_loss(contract: Contract, total_transit_hours: float) -> float:
    """Expected cargo value lost if perishable cargo exceeds its safe transit time."""
    limit = contract.perishable_max_transit_hours
    if limit is None or total_transit_hours <= limit:
        return 0.0
    return contract.cargo_value * contract.spoilage_loss_fraction


def is_force_majeure(contract: Contract, incident: str) -> bool:
    return bool(incident) and incident in contract.force_majeure
