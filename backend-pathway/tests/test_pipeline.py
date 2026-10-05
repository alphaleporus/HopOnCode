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


def _run(commands):
    pw.internals.parse_graph.G.clear()
    telemetry = pw.debug.table_from_rows(TelemetrySchema, [
        # A: cruising, on schedule
        ("A", T0, 18.6, 73.7, 68.0, "", T0 - 1800),
        # B: moving, then breaks down (driver reports it)
        ("B", T0, 18.65, 73.6, 66.0, "", T0 - 1800),
        ("B", T0 + 60, 18.65, 73.6, 0.0, "", T0 - 1800),
        ("B", T0 + 120, 18.65, 73.6, 0.0, "breakdown", T0 - 1800),
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
    assert kpis["trucks"] == 2 and kpis["critical"] == 1 and kpis["exposure"] == b["exposure"]
    assert impact == []


def test_executed_command_resolves_incident_and_counts_impact():
    cmd = ("B", f"B:{T0 + 60}", "execute", T0 + 130, "QuickFreight India", 800.0, 900.0, 1800.0, 40.0)
    fleet, kpis, impact = _run([cmd])
    assert fleet["B"]["status"] == "resolved" and fleet["B"]["resolved"]
    assert kpis["resolved"] == 1 and kpis["critical"] == 0
    assert impact[0]["decisions"] == 1 and impact[0]["net_savings"] == 900.0


def test_command_for_old_incident_does_not_resolve_new_one():
    stale = ("B", "B:123", "execute", T0, "X", 800.0, 900.0, 1800.0, 40.0)
    fleet, _, _ = _run([stale])
    assert fleet["B"]["status"] == "critical"
