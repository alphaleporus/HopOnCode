"""
Operator decisions (execute / dismiss) flowing back into the pipeline.

The realtime hub pushes commands from any thread; Pathway ingests them as a
stream, so decisions are joined with live state and aggregated into impact
KPIs the same way as telemetry.
"""

import queue

import pathway as pw


class CommandSubject(pw.io.python.ConnectorSubject):
    def __init__(self):
        super().__init__()
        self._queue: "queue.Queue[dict]" = queue.Queue()

    def push(self, command: dict):
        self._queue.put(command)

    def run(self):
        while True:
            cmd = self._queue.get()
            self.next(**cmd)
            # Drain anything that arrived together into the same commit
            while not self._queue.empty():
                self.next(**self._queue.get_nowait())
            self.commit()
