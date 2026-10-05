# FleetFusion: Product Overview, Features & Priorities

> **One line:** FleetFusion is a real-time delay decision engine for road freight. It detects stalled trucks
> from GPS and vehicle data, prices each delay against the customer's contract, and recommends the cheapest
> fix. It plugs into the systems logistics companies already run (SAP-style ERP/TMS plus telematics
> platforms). AI is optional, and the driver has no role.

---

## 1. Positioning

| Principle | What it means in the product |
|---|---|
| **Works without AI** | Every decision is deterministic, auditable math (`backend-pathway/core/`). The LLM only writes explanations; with it switched off, nothing changes except the wording. |
| **Extension, not a new system** | Headless decision engine with adapters: orders and contracts come from the ERP/TMS, location comes from telematics, decisions go back into the host system. Our own dashboard is the reference UI and the demo. |
| **Zero driver dependency** | Incidents are inferred from machine signals (tracker, engine fault codes, crash sensor, geofences, weather). Only trained office staff (dispatchers/managers) act. |
| **Free / open-source stack** | Pathway, Python, Next.js, Leaflet/OSM, Ollama. No paid API keys. |

### Go-to-market logic
- **Pitch lead: SAP.** SAP Business Network Global Track & Trace already takes tracking data from any source and
  syncs it into SAP and non-SAP ERP/TMS. FleetFusion is the *decision layer* on top: shipment and contract data in,
  decision events out.
- **Demo / first integration: telematics.** AIS-140 trackers are mandatory on national-permit goods vehicles in
  India, so location data already exists on the trucks with no new hardware and no driver app.
- **Pricing:** a fee per vehicle per month inside the host's marketplace or partner channel, or a share of the savings.

---

## 2. What is a telematics platform?

**Telematics = telecommunications + informatics:** a device in the truck that reports data over the mobile network.

```
 [Device in truck]  ──4G/2G──▶  [Telematics platform (cloud)]  ──API / webhook──▶  [FleetFusion]
  GPS, SIM, ignition wire,        stores & normalizes data,                         decisions
  CAN/OBD port, accelerometer     dashboards, alerts, APIs
```

- **The device** (hardwired, not a phone) reports position, speed, heading and ignition on/off every few
  seconds. Advanced devices also read the engine computer over **CAN bus / OBD-II** (fault codes, fuel,
  RPM, coolant temperature) and have an **accelerometer** (harsh braking or impact).
- **The platform** (in India: Fleetx, LocoNav, Intangles and others; globally: Samsara, Geotab, Trimble) receives data
  from thousands of devices, cleans it, shows fleet owners a dashboard, and exposes **APIs/webhooks** so other
  software can consume the data. Fleet owners already pay them per vehicle.
- **AIS-140** is India's government standard for vehicle location tracking devices (VLTDs). It is mandatory for
  national-permit goods vehicles. AIS-140 devices provide **GPS, speed, ignition and an emergency button**.
  **Engine fault codes are *not* guaranteed:** those need a CAN/OBD-capable device (a premium tier from some vendors).

**Why it matters to us:**
1. **Data source with zero driver involvement:** location and ignition from every compliant truck.
2. **Distribution channel:** a telematics platform can offer FleetFusion as an add-on to fleets it already serves.
3. **Signal tiers:** the engine degrades gracefully.
   - *Basic (AIS-140):* stop + ignition + geofence + weather → incident type, or an unexplained stop with lower confidence.
   - *Advanced (CAN/OBD):* fault codes and crash sensor → breakdown or accident with high confidence.

---

## 3. Data: where it comes from today, and where it should come from

### 3.1 Today (demo)

| Data | How it's produced now | File | Realism |
|---|---|---|---|
| **Truck telemetry** | `FleetSimulator`: 3 hand-made demo trucks plus any number of generated trucks between 15 Indian cities. Lanes are limited to those a contract SLA can serve. One reading per truck per second, simulated clock with speed-up, constant cruise speed ±jitter, straight lines between 4 waypoints. | `connectors/fleet_simulator.py` | Low to medium |
| **Incidents** | Scripted timeline (`data/scenarios/demo.json`: stop at T+5 s, engine fault P0217 at T+9 s) plus random incidents (Poisson rate per truck-hour). Each type is emitted as a *machine signal*: fault code, crash flag, or an external label. | `fleet_simulator.py`, `data/scenarios/` | Medium |
| **Truck registry** | Driver, contract, cargo value, route, emitted once by the simulator. | `fleet_simulator.py` | Low |
| **Contracts** | 3 hand-written JSON files: SLA, grace period, ₹ penalty per hour, cap, cold-chain limits, force majeure, relief carrier offers. Hot-reloaded. | `data/contracts/*.json` | Medium; penalty rates are **illustrative** |
| **Relief carrier quotes** | Static offers inside each contract, anchored to real ₹45–85/km full-truckload rates plus an emergency premium. | `data/contracts/*.json` | Medium |
| **Incident durations** | Hand-set typical durations per type, plus a duration rule for unexplained stops. | `core/incidents.py` | Assumption |
| **CO₂ factor** | Flat 0.9 kg/km for a laden diesel truck. | `core/config.py` | Assumption |
| **Real-device path** | Already live: `POST /telemetry`, `POST /trucks` (port 8090). | `main.py`, `pipeline/graph.py` | Real |
| **Frontend extras** | Analytics page, public tracking page and landing feature cards still use **mock/random data**. | `app/analytics`, `app/track`, `components/landing` | Mock |

**Sourced market figures used in copy and calibration**

| Fact | Value | Source |
|---|---|---|
| India logistics cost | ₹24.01 lakh crore, 7.97% of GDP (FY24) | DPIIT–NCAER study |
| Stoppage delay | 5–25% of journey time | TCI–IIM highway freight study |
| Truck distance per day | 200–400 km | Retailers Association of India (via industry articles) |
| Full-truckload rate (32 ft) | ₹45–85/km | fr8.in, AssureShift, TruckGuru rate guides |
| Pharma cold chain | ~20% of temperature-sensitive shipments degrade; pharma losses > ₹2,500 crore/yr | Industry reports (Amfi Logistics and others) |
| AIS-140 mandate | National-permit goods vehicles (GSR 1081(E), 2018) | MoRTH; Fleetx / Intangles compliance guides |

### 3.2 Where real data should come from

| Data | Real source | Access | Priority |
|---|---|---|---|
| Live location, speed, ignition | Telematics platform APIs/webhooks (Fleetx, LocoNav, Intangles), or a self-hosted **Traccar** server receiving raw AIS-140 device protocols | Partner API / open source | **P0** |
| Engine fault codes, crash events | CAN/OBD-capable telematics devices (premium tier) | Partner API | P1 |
| Shipments, deadlines, cargo value | ERP/TMS (SAP TM / SAP Global Track & Trace, other TMSs); in India also **GST e-way bills** | Integration / ULIP | P0 (mock adapter), P1 (real) |
| Contracts | Customer contracts → LLM-assisted PDF extraction into our JSON, human confirms | Customer upload | P1 |
| Road distance and arrival time | Self-hosted **OSRM / Valhalla** on the Geofabrik India OpenStreetMap extract | Free, open source | P1 |
| Weather (incidents, force-majeure evidence) | **Open-Meteo** (no key) | Free | P1 |
| Geofences: toll plazas, checkpoints, depots, fuel stations | **OpenStreetMap** (`barrier=toll_booth`, `amenity=fuel`, …) plus the customer's own depot list | Free | P1 |
| Toll crossings when GPS is lost | **FASTag** transactions via ULIP | Govt platform (registration) | P2 |
| Vehicle details / fitness | **Vahan** via ULIP | Govt platform (registration) | P3 |
| Relief capacity and prices | The customer's own idle fleet (from telematics), carrier rate cards, later carrier APIs | Customer / partner | P1 |
| Calibration history (stop durations, delay rates) | The customer's historical trips; public Indian truck-trip datasets (check licence) | Customer / public | P2 |
| Emission factors | GLEC framework / India GHG Program | Free | P2 |

### 3.3 Improving the simulator (when real data isn't available)

| Improvement | Why | Priority |
|---|---|---|
| Snap generated routes to real roads (OSRM) | Straight lines understate distance by 20–40% | P1 |
| Speed profiles: highway vs city vs ghat, time of day | Constant speed hides realistic slow-downs | P1 |
| Ignition on/off and stop-reason signals for the basic AIS-140 tier | Show that the engine works with basic trackers too | P0 |
| GPS noise, dropouts, out-of-order and late readings | Exercises the "signal lost" path and out-of-order handling | P1 |
| Mandatory rest stops / night halts | Separates planned stops from incidents | P2 |
| Replay real trajectories through `/telemetry` | Most convincing evidence | P2 |
| Incident rates and durations calibrated per lane | Replaces hand-set assumptions | P2 |

---

## 4. Feature list with status and priority

**Priority key:** **P0** = do next, blocks the core story · **P1** = high value · **P2** = important for production
· **P3** = later / nice to have. **Status:** ✅ done · 🟡 partial · ⬜ planned.

### 4.1 Decision engine (core)

| Feature | Status | Priority |
|---|---|---|
| Deadline-aware arrival projection (remaining route distance, learned cruise speed, expected stop duration) | ✅ | — |
| Exposure pricing: SLA penalty with grace period and cap, cold-chain spoilage, force majeure | ✅ | — |
| Relief optimizer: wait vs every carrier by **expected cost** (price + reliability-weighted risk) | ✅ | — |
| Recommendation levels EXECUTE / CONSIDER / MONITOR with confidence | ✅ | — |
| Configurable thresholds (env) | ✅ | — |
| INR with Indian number formatting | ✅ | — |
| **Signal-lost status** (tracker silent for N minutes) | ⬜ | **P0** |
| Use **ignition on/off** as a signal (basic AIS-140 tier) | ⬜ | **P0** |
| **Own idle trucks as relief options** (internal swap, zero market cost) | ⬜ | P1 |
| Relief vehicle compatibility (reefer, capacity, permits) | ⬜ | P1 |
| Reroute option for traffic/closures (moving trucks) | ⬜ | P2 |
| Tiered penalty models: % of freight, OTIF windows, delivery slots | ⬜ | P2 |
| Multi-stop trips (milk runs) | ⬜ | P3 |

### 4.2 Driver-free incident detection

| Feature | Status | Priority |
|---|---|---|
| Inference from machine signals: fault code → breakdown/flat tyre, crash sensor → accident, external label → weather/checkpoint, else unexplained stop | ✅ | — |
| Unexplained-stop duration estimate (no signal needed) | ✅ | — |
| **Dispatcher override** of the incident type from the dashboard (office staff, not the driver) | ⬜ | **P0** |
| Geofence inference (toll plaza, checkpoint, depot, fuel station from OSM) | ⬜ | P1 |
| Weather inference (Open-Meteo at the truck's location) | ⬜ | P1 |
| Fleet-wide slowdown on the same road stretch → traffic | ⬜ | P2 |

### 4.3 Streaming platform & scale

| Feature | Status | Priority |
|---|---|---|
| Pathway streaming graph: per-truck state that stays constant in size, joins, incremental KPIs | ✅ | — |
| Contracts hot-reloaded from files | ✅ | — |
| HTTP ingest for real devices (`/telemetry`, `/trucks`) | ✅ | — |
| Operator decisions streamed back in; impact KPIs; audit log (JSONL) | ✅ | — |
| Benchmark: 3,000 trucks/s on one laptop; 5,000 with 4 workers at 94% | ✅ | — |
| Verify the HTTP ingest path doesn't grow memory without limit under load | ⬜ | P1 |
| Kafka/Redpanda ingest for buffering and replay | ⬜ | P2 |
| Pathway persistence (state survives restarts) | ⬜ | P2 |
| Postgres (+PostGIS/TimescaleDB) for trips, contracts, decisions, outcomes | ⬜ | P2 |

### 4.4 Integrations (extension strategy)

| Feature | Status | Priority |
|---|---|---|
| Adapter interface: inbound (orders, contracts, telemetry) and outbound (decision events) | ⬜ | **P0** |
| **SAP-style TMS adapter (mock):** freight orders in → registry and contracts; decision events out via webhook | ⬜ | **P0** |
| **Telematics adapter:** Traccar server (raw AIS-140 protocols) → `/telemetry` | ⬜ | **P0** |
| Embeddable panel (`/embed`, no app chrome, token access) for host UIs | ⬜ | P1 |
| Real SAP integration (Global Track & Trace / SAP TM APIs, BTP app) | ⬜ | P2 |
| Telematics platform partner APIs (Fleetx / LocoNav / Intangles) | ⬜ | P2 |
| Actually book relief (carrier API / WhatsApp to the **carrier's dispatcher**, not the driver) | ⬜ | P2 |
| Customer notifications (email/WhatsApp) on delay and resolution | ⬜ | P2 |
| E-way bill / FASTag via ULIP | ⬜ | P3 |

### 4.5 AI (optional layer)

| Feature | Status | Priority |
|---|---|---|
| Plain-language explanations via local LLM (Ollama), async and cached, once per incident | ✅ | — |
| Deterministic fallback; runs with `LLM_ENABLED=false` | ✅ | — |
| **"AI on/off" indicator and live toggle in the dashboard** (demo answer to "what if AI disappears") | ⬜ | **P0** |
| Contract PDF → JSON extraction, with a human confirming | ⬜ | P1 |
| Explanations cite the contract clause (retrieval over contract text with local embeddings) | ⬜ | P2 |
| Check that numbers quoted by the LLM match the engine's numbers | ⬜ | P2 |
| Small model evaluation set | ⬜ | P3 |

### 4.6 Frontend / usability

| Feature | Status | Priority |
|---|---|---|
| Live map, agent event stream, one-click execute popup | ✅ | — |
| Real KPIs in the header (on-time %, ₹ saved) | ✅ | — |
| Clear "backend offline" banner; reconnect forever | ✅ | — |
| Self-hosted fonts (no Google Fonts fetch; works offline) | ✅ | — |
| Copy repositioned: decision engine, no AI/driver dependency, sourced stats | ✅ | — |
| **Popups keyed by incident** (today a truck can only show one popup per session) | ⬜ | **P0** |
| **Show all options in the popup** (wait vs each carrier: cost, arrival, reliability) | ⬜ | **P0** |
| Impact panel: savings, penalties avoided, relief spend, extra CO₂ | ⬜ | **P0** |
| Opportunities list (all actionable trucks, not just the top one) | ⬜ | P1 |
| Replace mock analytics with real decision history | ⬜ | P1 |
| Public tracking page on live data | ⬜ | P2 |
| Send routes once, then positions only (payload is ~0.6 MB/update at 1k trucks) | ⬜ | P1 |
| Rename `middleware.ts` → `proxy.ts` (Next 16 deprecation) | ⬜ | P3 |

### 4.7 Security, operations & compliance (product-worthiness)

| Feature | Status | Priority |
|---|---|---|
| Open-redirect fix, dev-only auth secret, demo login gated in production | ✅ | — |
| **Authentication on the WebSocket and ingest** (API keys per device/org, JWT for operators) | ⬜ | **P0** before any external deployment |
| Roles: dispatcher, manager, admin; approval policy (auto-execute below ₹X, manager approval above) | ⬜ | P1 |
| Real user store with hashed passwords | ⬜ | P1 |
| TLS (WSS/HTTPS) via Caddy | ⬜ | P1 |
| Track outcomes: predicted vs actual savings → calibration | ⬜ | P1 |
| Single `docker compose`: frontend, backend, Postgres, Traccar, Ollama, Caddy | ⬜ | P1 |
| CI (GitHub Actions: pytest, lint, type-check, build) | ⬜ | P1 |
| Monitoring: Prometheus metrics, structured logs, Sentry | ⬜ | P2 |
| DPDP Act 2023: consent, retention limits and access logs for driver location data | ⬜ | P2 |
| Multi-tenancy (one deployment, many customers) | ⬜ | P3 |

---

## 5. Recommended order of work (by priority, not dates)

**P0: core story and demo credibility**
1. Signal-lost status + ignition signal (basic AIS-140 tier)
2. Dispatcher override of the incident type
3. AI on/off indicator and toggle
4. Frontend: incident-keyed popups, all-options comparison, impact panel
5. Adapter interface + mock SAP-style TMS adapter + Traccar telematics adapter
6. Auth on WebSocket and ingest (before anything is exposed outside localhost)

**P1: real data and usability**
Own-fleet relief, vehicle compatibility, OSRM roads, geofences, weather, contract PDF extraction, embeddable panel,
opportunities list, real analytics, route payload optimization, roles/approvals, outcome tracking, compose + CI.

**P2: production**
Persistence and Postgres, Kafka, real SAP / telematics partner integrations, booking and notifications, monitoring,
DPDP compliance, reroute option, tiered penalties, simulator realism.

**P3: later**
ULIP (FASTag / Vahan / e-way bill), multi-stop trips, multi-tenancy, LLM evaluation set.
