"""
Load test: run the backend with a large simulated fleet and measure throughput.

    python scripts/benchmark.py --trucks 1000 2000 5000 --seconds 30

Reports, per fleet size:
  - telemetry readings/s actually processed end-to-end (counted from per-truck state)
  - snapshot size broadcast to clients, peak memory (RSS) of the backend
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
import time

import websockets

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rss_mb(pid: int) -> float:
    out = subprocess.run(["ps", "-o", "rss=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return int(out) / 1024 if out else 0.0


async def sample(seconds: float, pid: int):
    async with websockets.connect("ws://localhost:8765", max_size=None) as ws:
        first = last = None
        peak_rss, sizes = 0.0, []
        t_end = time.time() + seconds
        while time.time() < t_end:
            raw = await asyncio.wait_for(ws.recv(), timeout=30)
            msg = json.loads(raw)
            if msg["type"] not in ("initial_state", "state_update"):
                continue
            d = msg["data"]
            readings = d["metrics"]["telemetryReadings"]
            now = time.time()
            if first is None and readings:
                first = (now, readings)
            last = (now, readings)
            sizes.append(len(raw))
            peak_rss = max(peak_rss, rss_mb(pid))
        rate = (last[1] - first[1]) / (last[0] - first[0]) if first and last and last[0] > first[0] else 0
        return {"readings_per_s": round(rate), "snapshot_kb": round(sum(sizes) / len(sizes) / 1024),
                "peak_rss_mb": round(peak_rss), "trucks": len(d["trucks"]), "critical": d["metrics"]["critical"],
                "actionable": d["metrics"]["actionable"]}


def run(trucks: int, seconds: float, warmup: float):
    env = dict(os.environ, FLEET_SIZE=str(trucks), SIM_SPEEDUP="60", RANDOM_INCIDENT_RATE="0.2",
               SCENARIO="none", ENABLE_HTTP_INGEST="false", LLM_ENABLED="false", PYTHONUNBUFFERED="1")
    proc = subprocess.Popen([sys.executable, "main.py"], cwd=HERE, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        time.sleep(warmup)
        result = asyncio.run(sample(seconds, proc.pid))
        result["expected_readings_per_s"] = trucks  # 1 reading per truck per second
        return result
    finally:
        proc.terminate()
        try:
            proc.wait(10)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--trucks", type=int, nargs="+", default=[100, 1000])
    ap.add_argument("--seconds", type=float, default=20)
    ap.add_argument("--warmup", type=float, default=8)
    args = ap.parse_args()
    print(f"{'trucks':>7} {'readings/s':>11} {'expected':>9} {'snapshot':>9} {'peak RSS':>9} {'critical':>9} {'actionable':>10}")
    for n in args.trucks:
        r = run(n, args.seconds, args.warmup)
        print(f"{n:>7} {r['readings_per_s']:>11} {r['expected_readings_per_s']:>9} {r['snapshot_kb']:>7}KB "
              f"{r['peak_rss_mb']:>7}MB {r['critical']:>9} {r['actionable']:>10}")
