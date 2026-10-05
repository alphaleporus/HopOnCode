<img src="docs/assets/header.svg" width="100%" alt="FleetFusion: real-time delay decisions for road freight">

![engine](https://img.shields.io/badge/engine-Pathway-2F4FE0?style=flat-square&labelColor=14171F)
![telematics](https://img.shields.io/badge/telematics-Traccar%206-2F4FE0?style=flat-square&labelColor=14171F)
![ui](https://img.shields.io/badge/ui-Next.js%2016-2F4FE0?style=flat-square&labelColor=14171F)
![roads](https://img.shields.io/badge/roads-OSRM%20%C2%B7%20OSM-2F4FE0?style=flat-square&labelColor=14171F)
![tests](https://img.shields.io/badge/tests-40%20passing-2F4FE0?style=flat-square&labelColor=14171F)
![cost](https://img.shields.io/badge/cost-no%20paid%20APIs-2F4FE0?style=flat-square&labelColor=14171F)

When a truck stops, FleetFusion prices the delay against the customer's contract and recommends the cheapest way to recover, within seconds.

## `01` Why

A stalled truck costs money long before anyone notices. Usually the bill shows up as a late-delivery penalty, after it's too late to act.

- Trucks lose **5–25% of journey time** to stoppages (TCI–IIM highway study).
- **63%** of the 6,880 real delivery trips in our source dataset were flagged delayed.

## `02` What it does

| | |
|---|---|
| `DETECT` | Reads the GPS trackers trucks already carry, through Traccar. No driver app. |
| `DIAGNOSE` | Infers why it stopped from machine signals: fault codes, crash sensor, ignition, silence. |
| `PRICE` | Applies the contract: deadline, penalty per hour, cap, cold-chain limit, force majeure. |
| `DECIDE` | Compares waiting against every relief truck by expected cost, including the risk a relief fails. |
| `ACT` | An operator approves in one click; the decision goes back to the carrier by webhook. |

Every number is deterministic. A local model (Ollama) can rewrite the explanation in plain words; switching it off changes nothing else.

## `03` Architecture

<img src="docs/assets/architecture.svg" width="100%" alt="Architecture: GPS trackers report to Traccar; Traccar, the order system and contract files feed the FleetFusion engine (ingest, Pathway state, cause, decision, realtime hub), which serves the dashboard and analytics and sends approved fixes to the carrier by webhook. Ollama is optional.">

## `04` One incident, end to end

<img src="docs/assets/incident.svg" width="100%" alt="One incident: TRK-402 goes on time, delayed (speed 0), critical (fault code P0217), resolved (dispatcher approves), moving (relief takes the cargo). About ₹38k at risk, 1.8 h late, about ₹22k saved, no driver calls.">

## `05` How a fix is chosen

<img src="docs/assets/fix-decision.svg" width="100%" alt="How a fix is chosen: wait ₹37,985, QuickFreight ₹15,567, RapidLogistics ₹15,760, ExpressHaul ₹21,799. The lowest passes three checks (saving ≥ ₹2,000, ≥ 5% of waiting, confidence ≥ 0.6) and is recommended.">

> Computed by `core/arbitrage.py` for the demo breakdown. Values shift slightly with the exact second the truck stops.

## `06` Impact (simulated)

Same fleet, same incidents, handled two ways: **today** (noticed after about 60 min, then 45 min of phone calls) and **with FleetFusion** (signal in about 3 min, recommendation executed).

| Per 100 trucks | Today | FleetFusion |
|---|---|---|
| Cost per incident | ₹7,705 | **₹3,639** |
| Late deliveries | 24% | **12%** |
| Relief trucks booked | 29% | **14%** |
| Saving | | **≈ ₹9 L / month** |

Assumes 8 incidents per 100 trips, 300 km/day, 26 days a month. Range: ₹3.0 L to ₹16.2 L a month depending on incident rate and discovery delay. Reproduce with `scripts/impact_report.py`, or use the live calculator in Analytics.

## `07` Run it

Needs Node.js 18+, Python 3.10+, and Docker (optional).

```bash
./start-demo.sh
```

Open `http://localhost:3000/dashboard` and sign in with `demo@fleetfusion.com` / `demo123`.

With Docker running, the demo starts Traccar and 16 simulated trackers on real South-India lanes; without Docker it falls back to the built-in simulator (`FEED=internal`). Traccar's own map is at `http://localhost:8082`.

Cause an incident from the backend, the way real data would arrive:

```bash
python backend-pathway/scripts/inject.py breakdown
```

Other types: `accident`, `flat_tyre`, `traffic`, `checkpoint`, `tracker_offline`. Stop everything with `./cleanup-demo.sh`.

## `08` Connect a real fleet

- **Traccar:** point any supported tracker at your Traccar server and forward positions and events to FleetFusion on port `8091` (config in `infra/traccar/traccar.xml`).
- **HTTP:** register a trip with `POST /trucks` and stream readings to `POST /telemetry` on port `8090`.
- **Contracts:** JSON files in `backend-pathway/data/contracts/`. Edit one and decisions update live.

## `09` Stack

| Layer | Tools |
|---|---|
| Streaming engine | Python, Pathway |
| Telematics | Traccar 6 (Docker) |
| Dashboard | Next.js 16, React 19, Tailwind, Leaflet + OpenStreetMap |
| Roads | OSRM over OpenStreetMap |
| Optional AI | Ollama, local |

One process handles **3,000 truck readings per second** on a laptop (about 450 MB). Benchmark: `backend-pathway/scripts/benchmark.py`.

## `10` Layout

```
app/ components/ lib/        Dashboard and analytics (Next.js)
backend-pathway/
  core/                      Decision logic, penalties, impact model
  pipeline/                  Pathway streaming graph
  connectors/                Traccar, simulator, operator commands
  realtime/                  WebSocket hub
  devices/                   Simulated GPS trackers
  data/                      Contracts, fleet lanes, demo scenario
  tests/                     40 tests
infra/                       Traccar setup
docs/                        Product notes and decision log
```

## Checks

```bash
cd backend-pathway && PYTHONPATH=. venv-pathway/bin/python -m pytest tests/
```

```bash
npm run lint && npm run type-check && npm run build
```

---

Fleet data: derived from "Delivery truck trips data" (Kaggle, CC BY-SA 3.0). Contract penalty rates are illustrative.
