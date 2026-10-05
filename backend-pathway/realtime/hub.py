"""
Realtime hub: Pathway output → WebSocket clients, operator commands → Pathway.

Replaces the old "write JSONL, tail the files" bridge. Pathway pushes row
changes in-process (pw.io.subscribe); the hub keeps the latest view, derives
human-readable events from state transitions, and broadcasts a coalesced
snapshot at a fixed rate, so client traffic stays bounded no matter how fast
telemetry arrives.

Message contract (backward compatible with the existing frontend):
    server → client  initial_state | state_update   {trucks, events, arbitrage, opportunities, metrics}
                     arbitrage_executed | arbitrage_dismissed | error | pong
    client → server  execute_arbitrage {truckId} | dismiss_arbitrage {truckId}
                     classify_incident {truckId, incident} | set_ai {enabled} | ping
"""

import asyncio
import json
import os
import threading
import time
from collections import deque
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Callable, Dict, List, Optional

import websockets

from core.money import fmt

EXECUTE, CONSIDER = "EXECUTE", "CONSIDER"
# Incident types a dispatcher may assign ("" = clear back to unexplained)
CLASSIFIABLE = {"breakdown", "accident", "flat_tyre", "traffic", "weather", "checkpoint", "idling", ""}


def _plain(v):
    """Unwrap pw.Json and drop pw.PENDING placeholders."""
    if hasattr(v, "value") and type(v).__name__ == "Json":
        return v.value
    if type(v).__name__ in ("Pending", "_Pending"):
        return None
    return v


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


class _TableView:
    """Latest rows of a Pathway table, applied atomically per Pathway timestamp."""

    def __init__(self):
        self.rows: Dict = {}
        self._pending: List = []

    def on_change(self, key, row, time, is_addition):
        self._pending.append((key, row, is_addition))

    def commit(self) -> bool:
        if not self._pending:
            return False
        # Retractions first, then insertions, so an update (−old, +new) never loses the row
        for key, _, add in self._pending:
            if not add:
                self.rows.pop(key, None)
        for key, row, add in self._pending:
            if add:
                self.rows[key] = {k: _plain(v) for k, v in row.items()}
        self._pending.clear()
        return True


class RealtimeHub:
    def __init__(self, host: str = "localhost", port: int = 8765, broadcast_hz: float = 2.0,
                 max_events: int = 50, on_command: Optional[Callable[[dict], None]] = None):
        self.host, self.port = host, port
        self.interval = 1.0 / broadcast_hz
        self.on_command = on_command
        self.lock = threading.RLock()
        self.fleet = _TableView()
        self.fleet_kpis = _TableView()
        self.impact = _TableView()
        self.explanations = _TableView()
        self.events: deque = deque(maxlen=max_events)
        self.decisions: deque = deque(maxlen=200)  # operator decisions, newest first (full log: output/decisions.jsonl)
        self._prev: Dict[str, Dict] = {}   # truck_id -> last seen decision (for event derivation)
        self._dirty = False
        self._clients = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._started = time.time()
        self._updates = 0
        # Signal-lost detection runs on the wall clock: a silent tracker produces no events at all
        self.signal_lost_s = float(os.getenv("SIGNAL_LOST_SECONDS", "30"))
        self._last_seen: Dict[str, tuple] = {}  # truck_id -> (readings, wall time the count last changed)
        self._lost: set = set()
        # AI is optional: explanations shown only if a model is reachable AND the operator leaves it on
        self.ai_available = False
        self.ai_enabled = True

    # ---- Pathway callbacks (Pathway worker threads) ---------------------------------------
    def subscriber(self, view: str):
        tv: _TableView = getattr(self, view)

        def on_change(key, row, time, is_addition):
            with self.lock:
                tv.on_change(key, row, time, is_addition)

        def on_time_end(time):
            with self.lock:
                if tv.commit():
                    self._dirty = True
                    if view == "fleet":
                        self._derive_events()

        return on_change, on_time_end

    def _derive_events(self):
        for row in self.fleet.rows.values():
            d = row["decision"]
            tid = d["truck_id"]
            prev = self._prev.get(tid)
            self._updates += 1
            seen = self._last_seen.get(tid)
            if seen is None or seen[0] != d.get("readings"):
                self._last_seen[tid] = (d.get("readings"), time.time())
            if prev is None:
                self._prev[tid] = d
                if d["status"] != "on-time":
                    self._event_for_status(d, row)
                continue
            if d.get("incident") and d["incident"] != prev.get("incident") \
                    and d.get("incident_source") != "dispatcher":  # dispatcher changes are logged when made
                self._event("sensor", f"📟 {tid} telematics signal → {d['incident'].replace('_', ' ')}", "warning")
            if d["status"] != prev["status"]:
                self._event_for_status(d, row)
            if d["recommendation"] == EXECUTE and prev.get("recommendation") != EXECUTE:
                self._event("arbitrage", f"💎 ARBITRAGE OPPORTUNITY - {tid}: {d['best']} saves "
                                         f"{self._money(d['net_savings'], d)} (confidence {d['confidence']:.0%})",
                            "critical")
            self._prev[tid] = d

    def _event_for_status(self, d: Dict, row: Dict):
        tid, status = d["truck_id"], d["status"]
        if status == "critical":
            why = d["incident"].replace("_", " ") if d["incident"] else "stopped"
            self._event("alert", f"⚠️ {tid} CRITICAL - {why}, {d['lateness_hours']:.1f} h late, "
                                 f"{self._money(d['exposure'], d)} exposure", "critical")
        elif status == "delayed":
            why = f"stopped {d['stopped_minutes']:.0f} min" if d["stopped"] else f"{d['slack_hours']:.1f} h slack"
            self._event("alert", f"🟡 {tid} DELAYED - {why}", "warning")
        elif status == "resolved":
            self._event("system", f"✅ {tid} RESOLVED - relief dispatched", "info")
        elif status == "on-time":
            self._event("system", f"🟢 {tid} back on schedule", "info")

    def _event(self, etype: str, message: str, severity: str):
        self.events.appendleft({"id": f"evt-{time.time_ns()}", "timestamp": _iso(time.time()),
                                "type": etype, "message": message, "severity": severity})

    @staticmethod
    def _money(x: float, d: Dict) -> str:
        return fmt(x, d.get("currency", "INR"))

    # ---- Snapshot ---------------------------------------------------------------------------
    def _explanation_for(self, incident_id: str) -> Optional[str]:
        if not (self.ai_available and self.ai_enabled):
            return None
        for row in self.explanations.rows.values():
            if row.get("incident_id") == incident_id and isinstance(row.get("explanation"), str) \
                    and row["explanation"].strip():
                return row["explanation"].strip()
        return None

    def _silence_s(self, tid: str) -> float:
        seen = self._last_seen.get(tid)
        return time.time() - seen[1] if seen else 0.0

    def _truck_json(self, row: Dict) -> Dict:
        d = row["decision"]
        route = json.loads(row["route"])
        lost = d["truck_id"] in self._lost
        silent_min = self._silence_s(d["truck_id"]) / 60
        return {
            "id": d["truck_id"], "driver": row["driver"], "cargoValue": row["cargo_value"],
            "status": "signal-lost" if lost else d["status"], "velocity": round(d["speed_kmh"], 1),
            "stopped": d["stopped"], "stoppedMinutes": d["stopped_minutes"], "incidentId": d["incident_id"],
            "incidentSource": d.get("incident_source", ""), "silentMinutes": round(silent_min, 1) if lost else 0,
            "position": [d["lon"], d["lat"]], "destination": route[-1], "route": route,
            "contractId": row["contract_id"], "eta": _iso(d["ts"] + d["eta_hours"] * 3600),
            "etaHours": d["eta_hours"], "slackHours": d["slack_hours"], "remainingKm": d["remaining_km"],
            "latenessHours": d["lateness_hours"], "exposure": d["exposure"], "incident": d["incident"],
            "recommendation": "CHECK_TRACKER" if lost else d["recommendation"],
            "summary": (f"No data from {d['truck_id']}'s tracker for "
                        f"{f'{silent_min:.0f} min' if silent_min >= 1 else f'{silent_min * 60:.0f} s'}; last known position shown. "
                        f"Contact the carrier's dispatcher.") if lost else d["summary"],
        }

    def _opportunity_json(self, row: Dict) -> Dict:
        d = row["decision"]
        best = next(o for o in d["options"] if o["label"] == d["best"])
        return {
            "truckId": d["truck_id"], "incidentId": d["incident_id"], "contractId": row["contract_id"],
            "projectedPenalty": d["exposure"], "solutionType": d["best"], "solutionCost": best["direct_cost"],
            "netSavings": d["net_savings"], "details": self._explanation_for(d["incident_id"]) or d["summary"],
            "recommendation": d["recommendation"], "confidence": d["confidence"], "currency": d["currency"],
            "etaHours": best["arrival_hours"], "extraCo2Kg": best["extra_co2_kg"],
            "spoilageAvoided": max(0.0, d["spoilage_loss"] - best["spoilage_loss"]),
            "options": d["options"], "llmExplained": self._explanation_for(d["incident_id"]) is not None,
        }

    def snapshot(self) -> Dict:
        with self.lock:
            rows = sorted(self.fleet.rows.values(), key=lambda r: r["decision"]["truck_id"])
            opportunities = sorted(
                (self._opportunity_json(r) for r in rows
                 if r["decision"]["recommendation"] in (EXECUTE, CONSIDER) and not r["decision"]["dismissed"]
                 and r["decision"]["truck_id"] not in self._lost),
                key=lambda o: -o["netSavings"])
            kpis = next(iter(self.fleet_kpis.rows.values()), {})
            impact = next(iter(self.impact.rows.values()), {})
            uptime = time.time() - self._started
            return {
                "trucks": [self._truck_json(r) for r in rows],
                "events": list(self.events)[:20],
                "arbitrage": next((o for o in opportunities if o["recommendation"] == EXECUTE), None),
                "opportunities": opportunities,
                "decisions": list(self.decisions)[:50],
                "metrics": {
                    "trucks": kpis.get("trucks", 0), "onTime": kpis.get("on_time", 0),
                    "delayed": kpis.get("delayed", 0), "critical": kpis.get("critical", 0),
                    "resolved": kpis.get("resolved", 0), "actionable": kpis.get("actionable", 0),
                    "exposure": round(kpis.get("exposure_paise", 0) / 100, 2),
                    "cargoValue": kpis.get("cargo_value_paise", 0) / 100,
                    "decisions": impact.get("decisions", 0),
                    "netSavings": round(impact.get("net_savings", 0.0), 2),
                    "penaltiesAvoided": round(impact.get("penalties_avoided", 0.0), 2),
                    "reliefSpend": round(impact.get("relief_spend", 0.0), 2),
                    "extraCo2Kg": round(impact.get("extra_co2_kg", 0.0), 1),
                    "telemetryReadings": sum(r["decision"].get("readings", 0) for r in rows),
                    "truckUpdatesPerSec": round(self._updates / uptime, 1) if uptime else 0,
                    "signalLost": len(self._lost),
                    "aiAvailable": self.ai_available,
                    "aiEnabled": self.ai_enabled and self.ai_available,
                },
                "timestamp": _iso(time.time()),
            }

    # ---- Commands -----------------------------------------------------------------------
    def _handle_classify(self, msg: Dict) -> Dict:
        """Dispatcher (office staff) sets the incident type for a stopped truck."""
        truck_id, label = msg.get("truckId"), str(msg.get("incident", "")).strip().lower()
        if label not in CLASSIFIABLE:
            return {"type": "error", "message": f"Unknown incident type '{label}'"}
        with self.lock:
            row = next((r for r in self.fleet.rows.values() if r["decision"]["truck_id"] == truck_id), None)
            if row is None or not row["decision"]["incident_id"]:
                return {"type": "error", "message": f"{truck_id} is not stopped"}
            d = row["decision"]
            cmd = {"truck_id": truck_id, "incident_id": d["incident_id"], "action": "classify", "ts": d["ts"],
                   "provider": "", "cost": 0.0, "net_savings": 0.0, "penalty_avoided": 0.0,
                   "extra_co2_kg": 0.0, "label": label}
            self._event("system", f"🧑‍💼 Dispatcher classified {truck_id} stop as "
                                  f"{label.replace('_', ' ') or 'unexplained'}", "info")
            self._dirty = True
        if self.on_command:
            self.on_command(cmd)
        return {"type": "incident_classified", "truckId": truck_id, "incident": label,
                "timestamp": _iso(time.time())}

    def _handle_set_ai(self, msg: Dict) -> Dict:
        with self.lock:
            self.ai_enabled = bool(msg.get("enabled", True))
            self._event("system", f"🧠 AI explanations {'enabled' if self.ai_enabled else 'disabled'} "
                                  f"- decisions unchanged (deterministic engine)", "info")
            self._dirty = True
        return {"type": "ai_toggled", "enabled": self.ai_enabled, "timestamp": _iso(time.time())}

    def _check_signal_lost(self):
        """Flag trucks whose tracker has gone quiet; emit events on transitions."""
        now = time.time()
        with self.lock:
            for tid, (_, last) in self._last_seen.items():
                silent = now - last > self.signal_lost_s
                if silent and tid not in self._lost:
                    self._lost.add(tid)
                    self._event("alert", f"📡 {tid} SIGNAL LOST - no tracker data for {now - last:.0f} s",
                                "critical")
                    self._dirty = True
                elif not silent and tid in self._lost:
                    self._lost.discard(tid)
                    self._event("system", f"📡 {tid} tracker back online", "info")
                    self._dirty = True

    def _handle_command(self, msg: Dict) -> Dict:
        action = {"execute_arbitrage": "execute", "dismiss_arbitrage": "dismiss"}[msg["type"]]
        truck_id = msg.get("truckId")
        with self.lock:
            row = next((r for r in self.fleet.rows.values() if r["decision"]["truck_id"] == truck_id), None)
            if row is None:
                return {"type": "error", "message": f"Unknown truck {truck_id}"}
            d = row["decision"]
            if d["recommendation"] not in (EXECUTE, CONSIDER) or d["resolved"]:
                return {"type": "error", "message": f"No open opportunity for {truck_id}"}
            best = next(o for o in d["options"] if o["label"] == d["best"])
            wait = d["options"][0]
            cmd = {
                "truck_id": truck_id, "incident_id": d["incident_id"], "action": action, "ts": d["ts"],
                "provider": best["provider"], "cost": best["direct_cost"] if action == "execute" else 0.0,
                "net_savings": d["net_savings"] if action == "execute" else 0.0,
                "penalty_avoided": (wait["sla_penalty"] + wait["spoilage_loss"]
                                    - best["sla_penalty"] - best["spoilage_loss"]) if action == "execute" else 0.0,
                "extra_co2_kg": best["extra_co2_kg"] if action == "execute" else 0.0,
                "_option": best,
            }
            self.decisions.appendleft({
                "id": f"dec-{time.time_ns()}", "time": _iso(time.time()), "truckId": truck_id,
                "contractId": row["contract_id"], "incident": d["incident"], "action": action,
                "option": best["label"], "exposure": d["exposure"], "cost": cmd["cost"],
                "netSavings": cmd["net_savings"], "penaltyAvoided": round(cmd["penalty_avoided"], 2),
                "extraCo2Kg": cmd["extra_co2_kg"], "currency": d["currency"],
            })
        if self.on_command:
            self.on_command(cmd)
        return {"type": "arbitrage_executed" if action == "execute" else "arbitrage_dismissed",
                "truckId": truck_id, "timestamp": _iso(time.time())}

    # ---- WebSocket server ----------------------------------------------------------------
    async def _client(self, ws):
        self._clients.add(ws)
        try:
            await ws.send(json.dumps({"type": "initial_state", "data": self.snapshot()}))
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                    if msg.get("type") == "ping":
                        await ws.send(json.dumps({"type": "pong", "timestamp": _iso(time.time())}))
                    elif msg.get("type") in ("execute_arbitrage", "dismiss_arbitrage", "classify_incident",
                                             "set_ai"):
                        handler = {"classify_incident": self._handle_classify,
                                   "set_ai": self._handle_set_ai}.get(msg["type"], self._handle_command)
                        reply = handler(msg)
                        if reply["type"] == "error":
                            await ws.send(json.dumps(reply))
                        else:
                            await self._broadcast(reply)
                    else:
                        await ws.send(json.dumps({"type": "error", "message": "Unknown message type"}))
                except (json.JSONDecodeError, KeyError):
                    await ws.send(json.dumps({"type": "error", "message": "Invalid message"}))
        except websockets.ConnectionClosed:
            pass
        finally:
            self._clients.discard(ws)

    async def _broadcast(self, message: Dict):
        if self._clients:
            websockets.broadcast(self._clients, json.dumps(message))

    async def _ticker(self):
        while True:
            await asyncio.sleep(self.interval)
            self._check_signal_lost()
            with self.lock:
                dirty, self._dirty = self._dirty, False
            if dirty and self._clients:
                await self._broadcast({"type": "state_update", "data": self.snapshot()})

    def _health(self, connection, request):
        if request.path == "/health":
            return connection.respond(HTTPStatus.OK, json.dumps(
                {"status": "ok", "trucks": len(self.fleet.rows), "clients": len(self._clients)}) + "\n")
        return None

    async def _serve(self):
        async with websockets.serve(self._client, self.host, self.port, process_request=self._health):
            print(f"✅ Realtime hub on ws://{self.host}:{self.port} (health: http://{self.host}:{self.port}/health)")
            await self._ticker()

    def start(self):
        """Run the hub in a background thread with its own event loop."""
        def run():
            self._loop = asyncio.new_event_loop()
            self._loop.run_until_complete(self._serve())

        threading.Thread(target=run, name="realtime-hub", daemon=True).start()
