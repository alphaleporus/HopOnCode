"""
Traccar integration: FleetFusion as a plug-in for an open-source telematics platform.

Traccar (https://www.traccar.org, Apache-2.0) receives data from real GPS trackers (200+ device
protocols, including AIS-140 units) and forwards every position and event as JSON:

    forward.type=json        forward.url=http://<fleetfusion>:8091/integrations/traccar/positions
    event.forward.type=json  event.forward.url=http://<fleetfusion>:8091/integrations/traccar/events

This module turns those payloads into FleetFusion telemetry readings. Same shape works for other
platforms that forward positions/events (SAP Global Track & Trace, commercial telematics APIs).
"""

import json
import queue
import socketserver
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable, Dict, Optional

import pathway as pw

KNOTS_TO_KMH = 1.852


class FastHTTPServer(ThreadingHTTPServer):
    """ThreadingHTTPServer tuned for bursty integrations.

    - no reverse-DNS lookup in server_bind (can hang for a long time on macOS)
    - a deep accept queue: the default of 5 drops connections when Traccar forwards a burst of
      positions and events every second, which shows up as every truck going "signal lost"
    """

    request_queue_size = 1024
    daemon_threads = True

    def server_bind(self):
        socketserver.TCPServer.server_bind(self)
        self.server_name, self.server_port = self.server_address[:2]
# Traccar alarm types that mean a collision / impact
CRASH_ALARMS = {"accident", "vibration", "tow", "hardBraking"}


def parse_time(value: str) -> int:
    """Traccar ISO timestamp ('2026-10-05T15:11:24.000+00:00') -> epoch seconds."""
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())


def position_to_reading(payload: Dict) -> Optional[Dict]:
    """Map a Traccar position forward ({position, device}) to a FleetFusion telemetry reading."""
    pos, dev = payload.get("position") or {}, payload.get("device") or {}
    truck_id = dev.get("uniqueId") or dev.get("name")
    if not truck_id or pos.get("latitude") is None or pos.get("longitude") is None:
        return None
    attrs = pos.get("attributes") or {}
    alarm = str(attrs.get("alarm") or "")
    ignition = attrs.get("ignition")
    dtcs = str(attrs.get("dtcs") or "").split(",")[0].strip()
    return {
        "truck_id": str(truck_id),
        "ts": parse_time(pos.get("fixTime") or pos.get("deviceTime")),
        "lat": float(pos["latitude"]),
        "lon": float(pos["longitude"]),
        "speed_kmh": round(float(pos.get("speed") or 0.0) * KNOTS_TO_KMH, 1),
        # A fault alarm without a specific code still means the vehicle can't continue
        "fault_code": dtcs or ("ALARM-FAULT" if alarm == "fault" else ""),
        "harsh_event": any(a in CRASH_ALARMS for a in alarm.split(",")),
        "ignition": -1 if ignition is None else (1 if ignition else 0),
        "incident": "",
        "trip_started_at": 0,  # trip start comes from the order system (registry), not the tracker
    }


def event_summary(payload: Dict) -> Optional[Dict]:
    """Traccar event forward ({event, position, device}) -> short record for the activity stream."""
    ev, dev = payload.get("event") or {}, payload.get("device") or {}
    etype = ev.get("type")
    if not etype:
        return None
    detail = (ev.get("attributes") or {}).get("alarm", "")
    return {"truck_id": str(dev.get("uniqueId") or dev.get("name") or ""), "type": etype, "detail": str(detail),
            "time": ev.get("eventTime") or ""}


class TraccarSubject(pw.io.python.ConnectorSubject):
    """Receives Traccar forwards over HTTP and feeds readings into Pathway.

    Runs its own small HTTP server so readings enter as an append-only stream
    (no per-request state retained), and so the integration surface is separate
    from the generic ingest API.
    """

    def __init__(self, host: str = "0.0.0.0", port: int = 8091,
                 on_event: Optional[Callable[[Dict], None]] = None):
        super().__init__()
        self.host, self.port, self.on_event = host, port, on_event
        self.received = 0

    def run(self):
        subject = self
        inbox: "queue.Queue[Dict]" = queue.Queue()

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                try:
                    body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                    if self.path.endswith("/positions"):
                        reading = position_to_reading(body)
                        if reading:
                            inbox.put(reading)
                    elif self.path.endswith("/events") and subject.on_event:
                        summary = event_summary(body)
                        if summary:
                            subject.on_event(summary)
                    self.send_response(200)
                except Exception as e:  # never make Traccar retry forever on a bad payload
                    print(f"⚠️  Traccar payload rejected: {e}")
                    self.send_response(400)
                self.end_headers()

            def log_message(self, *args):
                pass

        server = FastHTTPServer((self.host, self.port), Handler)
        threading.Thread(target=server.serve_forever, name="traccar-http", daemon=True).start()
        print(f"🛰  Traccar integration listening on http://{self.host}:{self.port}/integrations/traccar/*")

        # Pathway's next()/commit() are called only from this connector thread
        while True:
            reading = inbox.get()
            self.next(**reading)
            self.received += 1
            while not inbox.empty():
                self.next(**inbox.get_nowait())
                self.received += 1
            self.commit()
