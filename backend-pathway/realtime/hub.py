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
    client → server  execute_arbitrage {truckId} | dismiss_arbitrage {truckId} | ping
"""

import asyncio
import json
import threading
import time
from collections import deque
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Callable, Dict, List, Optional

import websockets

EXECUTE, CONSIDER = "EXECUTE", "CONSIDER"


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
        self._prev: Dict[str, Dict] = {}   # truck_id -> last seen decision (for event derivation)
        self._dirty = False
        self._clients = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._started = time.time()
        self._updates = 0

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
            if prev is None:
                self._prev[tid] = d
                if d["status"] != "on-time":
                    self._event_for_status(d, row)
                continue
            if d.get("incident") and d["incident"] != prev.get("incident"):
                self._event("sensor", f"📟 {tid} driver reported: {d['incident'].replace('_', ' ')}", "warning")
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
        return f"${x:,.0f}" if d.get("currency", "USD") == "USD" else f"{d['currency']} {x:,.0f}"

    # ---- Snapshot ---------------------------------------------------------------------------
    def _explanation_for(self, incident_id: str) -> Optional[str]:
        for row in self.explanations.rows.values():
            if row.get("incident_id") == incident_id and isinstance(row.get("explanation"), str) \
                    and row["explanation"].strip():
                return row["explanation"].strip()
        return None

    def _truck_json(self, row: Dict) -> Dict:
        d = row["decision"]
        route = json.loads(row["route"])
        return {
            "id": d["truck_id"], "driver": row["driver"], "cargoValue": row["cargo_value"],
            "status": d["status"], "velocity": round(d["speed_kmh"], 1),
            "position": [d["lon"], d["lat"]], "destination": route[-1], "route": route,
            "contractId": row["contract_id"], "eta": _iso(d["ts"] + d["eta_hours"] * 3600),
            "etaHours": d["eta_hours"], "slackHours": d["slack_hours"], "remainingKm": d["remaining_km"],
            "latenessHours": d["lateness_hours"], "exposure": d["exposure"], "incident": d["incident"],
            "recommendation": d["recommendation"], "summary": d["summary"],
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
                 if r["decision"]["recommendation"] in (EXECUTE, CONSIDER) and not r["decision"]["dismissed"]),
                key=lambda o: -o["netSavings"])
            kpis = next(iter(self.fleet_kpis.rows.values()), {})
            impact = next(iter(self.impact.rows.values()), {})
            uptime = time.time() - self._started
            return {
                "trucks": [self._truck_json(r) for r in rows],
                "events": list(self.events)[:20],
                "arbitrage": next((o for o in opportunities if o["recommendation"] == EXECUTE), None),
                "opportunities": opportunities,
                "metrics": {
                    "trucks": kpis.get("trucks", 0), "onTime": kpis.get("on_time", 0),
                    "delayed": kpis.get("delayed", 0), "critical": kpis.get("critical", 0),
                    "resolved": kpis.get("resolved", 0), "actionable": kpis.get("actionable", 0),
                    "exposure": round(kpis.get("exposure", 0.0), 2),
                    "cargoValue": kpis.get("cargo_value", 0.0),
                    "decisions": impact.get("decisions", 0),
                    "netSavings": round(impact.get("net_savings", 0.0), 2),
                    "penaltiesAvoided": round(impact.get("penalties_avoided", 0.0), 2),
                    "reliefSpend": round(impact.get("relief_spend", 0.0), 2),
                    "extraCo2Kg": round(impact.get("extra_co2_kg", 0.0), 1),
                    "telemetryReadings": sum(r["decision"].get("readings", 0) for r in rows),
                    "truckUpdatesPerSec": round(self._updates / uptime, 1) if uptime else 0,
                },
                "timestamp": _iso(time.time()),
            }

    # ---- Commands -----------------------------------------------------------------------
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
                    elif msg.get("type") in ("execute_arbitrage", "dismiss_arbitrage"):
                        reply = self._handle_command(msg)
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
