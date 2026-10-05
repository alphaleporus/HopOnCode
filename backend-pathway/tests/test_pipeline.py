"""End-to-end Pathway graph test on static tables (no simulator, no network)."""

import json

import pathway as pw

from core.config import DecisionConfig
from pipeline.graph import CommandSchema, RegistrySchema, Sources, TelemetrySchema, build, load_contracts

ROUTE = json.dumps([[73.8567, 18.5204], [73.5, 18.7], [73.2, 18.9], [72.8777, 19.0760]])
T0 = 1_700_000_000


def _rows(table):
    keys, cols = pw.debug.table_to_dicts(table)
    return [{c: cols[c][k] for c in cols} for k in keys]


def _run(commands, extra_telemetry=()):
    pw.internals.parse_graph.G.clear()
    telemetry = pw.debug.table_from_rows(TelemetrySchema, [
        # A: cruising, on schedule
        ("A", T0, 18.6, 73.7, 68.0, "", False, -1, "", T0 - 1800),
        # B: moving, then stops; the tracker later reports an engine fault
        ("B", T0, 18.65, 73.6, 66.0, "", False, -1, "", T0 - 1800),
        ("B", T0 + 60, 18.65, 73.6, 0.0, "", False, -1, "", T0 - 1800),
        # Engine fault code from the tracker, no driver report
        ("B", T0 + 120, 18.65, 73.6, 0.0, "P0217", False, -1, "", T0 - 1800),
        *extra_telemetry,
    ])
    registry = pw.debug.table_from_rows(RegistrySchema, [
        ("A", "Ann", "CNT-2024-001", 120000.0, ROUTE, 68.0),
        ("B", "Bob", "CNT-2024-001", 120000.0, ROUTE, 66.0),
    ])
    cmds = pw.debug.table_from_rows(CommandSchema, commands) if commands else \
        pw.Table.empty(**CommandSchema.typehints())
    out = build(Sources(telemetry, registry, cmds, "data/contracts"), DecisionConfig(),
                contracts=load_contracts("data/contracts", streaming=False))
    fleet = {r["truck_id"]: r["decision"].value for r in _rows(out.fleet)}
    kpis = _rows(out.fleet_kpis)[0]
    impact = _rows(out.impact)
    return fleet, kpis, impact


def test_pipeline_flags_breakdown_and_recommends_relief():
    fleet, kpis, impact = _run([])
    assert fleet["A"]["status"] == "on-time"
    b = fleet["B"]
    assert b["status"] == "critical" and b["recommendation"] == "EXECUTE"
    assert b["incident"] == "breakdown" and b["incident_id"] == f"B:{T0 + 60}"
    assert kpis["trucks"] == 2 and kpis["critical"] == 1 and kpis["exposure_paise"] == round(b["exposure"] * 100)
    assert impact == []


def test_executed_command_resolves_incident_and_counts_impact():
    cmd = ("B", f"B:{T0 + 60}", "execute", T0 + 130, "QuickFreight India", 12000.0, 25000.0, 39000.0, 40.0, "")
    fleet, kpis, impact = _run([cmd])
    assert fleet["B"]["status"] == "resolved" and fleet["B"]["resolved"]
    assert kpis["resolved"] == 1 and kpis["critical"] == 0
    assert impact[0]["decisions"] == 1 and impact[0]["net_savings"] == 25000.0


def test_command_for_old_incident_does_not_resolve_new_one():
    stale = ("B", "B:123", "execute", T0, "X", 12000.0, 25000.0, 39000.0, 40.0, "")
    fleet, _, _ = _run([stale])
    assert fleet["B"]["status"] == "critical"


def test_dispatcher_classification_overrides_inferred_incident():
    classify = ("B", f"B:{T0 + 60}", "classify", T0 + 130, "", 0.0, 0.0, 0.0, 0.0, "flat_tyre")
    fleet, _, _ = _run([classify])
    assert fleet["B"]["incident"] == "flat_tyre" and fleet["B"]["incident_source"] == "dispatcher"


def test_weak_ignition_signal_does_not_downgrade_fault_code():
    later_idle = ("B", T0 + 180, 18.65, 73.6, 0.0, "", False, 1, "", T0 - 1800)
    fleet, _, _ = _run([], extra_telemetry=[later_idle])
    assert fleet["B"]["incident"] == "breakdown"


def test_money_kpi_correct_under_live_updates():
    """Regression: float sums over in-place updates returned 0 in Pathway 0.33."""
    import threading, time

    class Tel(pw.io.python.ConnectorSubject):
        def run(self):
            for i, (spd, fc) in enumerate([(66.0, ""), (0.0, ""), (0.0, "P0217"), (0.0, "")]):
                self.next(truck_id="B", ts=T0 + 60 * i, lat=18.65, lon=73.6, speed_kmh=spd, fault_code=fc,
                          harsh_event=False, ignition=-1, incident="", trip_started_at=T0 - 1800)
                self.commit()
                time.sleep(0.3)

    class Reg(pw.io.python.ConnectorSubject):
        def run(self):
            self.next(truck_id="B", driver="Bob", contract_id="CNT-2024-001", cargo_value=1.0, route=ROUTE,
                      nominal_cruise_kmh=66.0)
            self.commit()

    class NoCmd(pw.io.python.ConnectorSubject):
        def run(self):
            pass

    pw.internals.parse_graph.G.clear()
    out = build(Sources(pw.io.python.read(Tel(), schema=TelemetrySchema, autocommit_duration_ms=50),
                        pw.io.python.read(Reg(), schema=RegistrySchema),
                        pw.io.python.read(NoCmd(), schema=CommandSchema), "data/contracts"),
                DecisionConfig(), contracts=load_contracts("data/contracts", streaming=False))
    seen = []
    pw.io.subscribe(out.fleet_kpis, lambda key, row, time, is_addition: is_addition and seen.append(row))
    pw.run(monitoring_level=pw.MonitoringLevel.NONE)
    assert seen[-1]["critical"] == 1 and seen[-1]["exposure_paise"] > 0
