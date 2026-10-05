"""Currency formatting (Indian digit grouping for INR: ₹1,25,000)."""


def _indian_grouping(n: int) -> str:
    s = str(n)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join(groups) + "," + tail


def fmt(amount: float, currency: str = "INR") -> str:
    sign = "-" if amount < 0 else ""
    n = int(round(abs(amount)))
    if currency == "INR":
        return f"{sign}₹{_indian_grouping(n)}"
    if currency == "USD":
        return f"{sign}${n:,}"
    return f"{sign}{currency} {n:,}"
