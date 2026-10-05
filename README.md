# FleetFusion

**Real-time decision engine for logistics: detects at-risk deliveries from live telemetry, prices the
financial exposure against each customer contract, and recommends the cheapest recovery, live.**

Built for **Craftverse 2.0** (repo: HopOnCode). Evolved from our earlier FleetFusion prototype
([fork](https://github.com/alphaleporus/GenAI_Proj) · [original](https://github.com/Naveeeya/GenAI_Proj));
the original docs are in [`docs/reference/`](docs/reference/).

---

## What it does

A truck breaks down 90 km from a just-in-time factory delivery. FleetFusion:

1. **Detects** the stop from telemetry within a second, before anyone calls in.
2. **Projects** arrival against the contract deadline using the incident type (driver-reported or unknown).
3. **Prices exposure**: SLA penalty with grace period and cap, plus spoilage for perishable cargo, and
   force-majeure exemptions.
4. **Optimizes recovery**: scores "wait it out" against every spot-market relief carrier by **expected cost**
   (price + reliability-weighted residual risk) and picks the cheapest. It does not just pick the lowest quote.
5. **Explains** the decision in plain language (local LLM, optional) and lets an operator execute it in one click.
6. **Closes the loop**: the decision flows back into the stream, the incident is marked resolved, and impact
   KPIs (savings, penalties avoided, extra CO₂) update live. Every decision is written to an audit log.

---

## Architecture

```
 Telematics / phone app ──POST /telemetry──┐
 Fleet simulator (any size) ───────────────┤
                                           ▼
 ┌──────────────────────── Pathway streaming engine ────────────────────────┐
 │ telemetry ─▶ groupby truck ─▶ stateful fold (O(1) memory per truck)     │
 │                 ⋈ truck registry (POST /trucks)                           │
 │                 ⋈ contracts  (data/contracts/*.json, hot-reloaded)        │
 │                     └─▶ assess() UDF ─ deterministic decision core        │
 │                           ⟕ operator commands (execute / dismiss)         │
 │                               ├─▶ fleet KPIs (incremental)                │
 │                               └─▶ new incidents ─▶ LLM explainer (async)  │
 │ commands ─▶ impact KPIs + audit log (output/decisions.jsonl)             │
 └───────────────────────────────┬──────────────────────────────────────────┘
                                 │ pw.io.subscribe (in-process)
                                 ▼
                    Realtime hub (WebSocket :8765, /health)
                      coalesced snapshots @ 2 Hz, derived events
                                 │
                                 ▼
                     Next.js dashboard (map, agent stream, 1-click fix)
```

| Layer | Path | Notes |
|---|---|---|
| Decision core (pure Python) | `backend-pathway/core/` | `arbitrage.py` (optimizer), `penalty.py`, `incidents.py`, `telemetry.py` (state fold), `geo.py`, `models.py`, `config.py` |
| Streaming graph | `backend-pathway/pipeline/graph.py` | Joins, stateful reducer, incremental KPIs, dedup before the LLM |
| Inputs | `backend-pathway/connectors/` | Fleet simulator, operator command stream; HTTP ingest is wired in `main.py` |
| Realtime hub | `backend-pathway/realtime/hub.py` | WebSocket server, event derivation, command handling |
| LLM | `backend-pathway/llm/` | OpenAI-compatible client (Ollama default) + fully-async cached explainer |
| Frontend | `app/`, `components/`, `lib/` | Next.js 16 / React 19 / Leaflet |

### Decision model

For a stopped truck with `d` km left, `t_left` hours to deadline and expected remaining stop `s`:

```
WAIT      arrival = s + d / cruise                cost = penalty(lateness) + spoilage(transit)
RELIEF_i  arrival = pickup_i + transfer_i + d / v_i
          cost    = price_i + r_i * exposure(relief) + (1 - r_i) * cost(WAIT)
best = argmin cost          net_savings = cost(WAIT) - cost(best)
EXECUTE if net_savings ≥ max($100, 5% of WAIT) and confidence ≥ 0.6, else CONSIDER
```

- Expected stop duration: incident profiles (breakdown ≈ 3 h, flat tyre ≈ 1 h, …); unexplained stops use the
  Lindy rule (a stop that has lasted *t* is expected to last about *t* more, min 20 min).
- Confidence = incident certainty × provider reliability × savings margin.
- Status: `critical` = money at stake, `delayed` = stopped/slow/under 15 min slack, `on-time`, `resolved`.
- All thresholds are configurable via env (`core/config.py`). The LLM never changes the numbers.

---

## Scalability (measured)

`python scripts/benchmark.py --trucks 1000 3000 5000` on a MacBook (Apple Silicon), single process,
1 reading per truck per second, random incidents on:

| Trucks | Readings/s processed | Peak memory | Notes |
|---:|---:|---:|---|
| 1,000 | 1,008 | 279 MB | keeps up |
| 3,000 | 2,999 | 454 MB | keeps up |
| 5,000 | ~4,700 (94%) | 553 MB | `PATHWAY_THREADS=4`; single-node saturation point |

Why it scales:
- **O(1) state per truck** (stateful reducer) instead of an ever-growing history.
- **Incremental computation**: Pathway only recomputes rows that changed. KPIs are incremental reducers.
- **LLM calls once per incident** (deduplicate + cache + fully-async executor), never per tick, and never block the stream.
- **Bounded fan-out**: clients get coalesced snapshots at a fixed rate, independent of ingest rate.
- **Scale-out path**: `PATHWAY_THREADS` / `pathway spawn` for multi-worker; swap the HTTP ingest for
  `pw.io.kafka` at fleet scale without touching the graph.

---

## Quick start

```bash
./start-demo.sh        # installs deps, starts backend + frontend
./cleanup-demo.sh      # stops everything / frees ports
```

Manual:

```bash
# Backend (Python 3.10+)
cd backend-pathway
python3 -m venv venv-pathway && source venv-pathway/bin/activate
pip install -r requirements-pathway.txt
cp .env.example .env
python main.py                       # Pathway pipeline + realtime hub (one process)

# Frontend (new terminal)
cp .env.local.example .env.local
npm install && npm run dev           # http://localhost:3000  (demo@fleetfusion.com / demo123)

# Optional: local LLM explanations
ollama pull llama3.2:3b && ollama serve
```

Demo scenario (`data/scenarios/demo.json`): TRK-402 stops at T+5 s (unexplained → delayed), the driver
reports a breakdown at T+9 s (→ critical, relief recommended). Use `SIM_SPEEDUP=60` to watch relief handover
and trips complete in minutes. Use `FLEET_SIZE=1000 RANDOM_INCIDENT_RATE=0.2` for a busy fleet.

Tests:

```bash
cd backend-pathway && PYTHONPATH=. venv-pathway/bin/python -m pytest tests/
npm run lint && npm run type-check && npm run build
```

---

## API

**Telemetry ingest** (real devices, phone apps, telematics gateways):

```bash
curl -X POST localhost:8090/trucks -H 'Content-Type: application/json' -d '{"truck_id":"DEV-1","driver":"A","contract_id":"CNT-2024-003","cargo_value":50000,"route":"[[88.36,22.57],[85.82,20.29]]"}'
curl -X POST localhost:8090/telemetry -H 'Content-Type: application/json' -d '{"truck_id":"DEV-1","ts":1760000000,"lat":22.4,"lon":88.1,"speed_kmh":0,"incident":"accident","trip_started_at":1759990000}'
```

**WebSocket** `ws://localhost:8765`:
- server → client: `initial_state` / `state_update` with `{trucks, events, arbitrage, opportunities, metrics}`;
  `arbitrage_executed`, `arbitrage_dismissed`, `error`, `pong`
- client → server: `{"type":"execute_arbitrage","truckId":"TRK-402"}`, `{"type":"dismiss_arbitrage",...}`, `{"type":"ping"}`

**Health**: `GET http://localhost:8765/health`

**Contracts**: drop or edit JSON in `backend-pathway/data/contracts/`; decisions update live. Fields: `sla_hours`,
`grace_minutes`, `penalty_per_hour`, `max_penalty`, `force_majeure`, `cargo.max_transit_hours`,
`cargo.spoilage_loss_fraction`, `spot_market_alternatives[]` (`cost`, `pickup_eta_minutes`, `reliability`,
`speed_kmh`, `transfer_minutes`).

---

## Stack (free; open source unless noted)

| Layer | Tech | License |
|---|---|---|
| Streaming | [Pathway](https://pathway.com) 0.33 | BSL 1.1: free to use, source-available, converts to Apache-2.0 |
| Realtime | `websockets` | BSD |
| LLM | Ollama (local) or any OpenAI-compatible server | MIT |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | MIT / Apache-2.0 |
| UI / Maps | framer-motion, lucide-react, recharts, Leaflet + react-leaflet, OSM tiles, OSRM | MIT / ISC / BSD / Hippocratic / ODbL |
| Auth | next-auth (credentials, JWT) | ISC |

No paid API keys. Without an LLM the system uses deterministic explanations, so it always runs offline.

---

## Judging criteria → what to show

| Criterion | Evidence |
|---|---|
| **Scalability** | Benchmark table above; O(1) per-truck state; multi-worker; LLM off the hot path |
| **Tech used** | Pathway streaming joins, stateful reducers, hot-reloaded file connector, REST connector, async UDF + cache, dedup; WebSockets; local LLM |
| **Feasibility** | Runs on a laptop with zero paid services; real-device HTTP ingest; contracts are plain JSON; deterministic, auditable decisions; 25 backend tests |
| **Usability** | One-click execute; plain-language explanation; agent event stream; ops never touch the math |
| **Actual impact** | Live KPIs: net savings, penalties avoided, relief spend, extra CO₂; spoilage avoided for cold chain |

---

## Next steps

- [ ] Frontend: show `opportunities`, `metrics` (impact KPIs) and per-option comparison from the new payload
- [ ] Frontend: send routes once (not every snapshot) to cut payload at 1k+ trucks (~0.6 MB/snapshot today)
- [ ] Persist operator decisions across restarts (Pathway persistence) and add operator identity to the audit log
- [ ] Calibrate incident durations and provider reliability from historical data
- [ ] Rename `middleware.ts` → `proxy.ts` (Next 16); replace FleetFusion logo assets if needed
