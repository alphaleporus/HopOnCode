# FleetFusion: Working Context & Decision Log

Rich context for continuing development across chat sessions. Newest section last.
Repo: https://github.com/alphaleporus/HopOnCode (product name **FleetFusion**). Hackathon: **Craftverse 2.0**.
Origin: ported from our earlier Pathway hackathon project (github.com/alphaleporus/GenAI_Proj, fork of Naveeeya/GenAI_Proj).

---

## 1. Ground rules from the user
- **Free / open-source only.** No paid APIs (OpenAI removed; local Ollama optional).
- **User commits and pushes themselves.** Give git commands (one per `bash` block); never push.
- **Plan before big changes**; give priorities (P0–P3), **no timelines**.
- **Currency: INR** with Indian grouping (₹1,25,000; compact ₹2.5 Cr / ₹38.3 L).
- **Zero driver dependency** (mentor feedback). Only office staff (dispatchers) may act.
- **Works without AI** (mentor feedback). AI only explains; decisions are deterministic.
- **Extension, not standalone SaaS** (mentor feedback): plug into SAP-style ERP/TMS + telematics.
- README must be **plain language, no jargon**, with Mermaid diagrams.
- Be honest about what is real vs illustrative; no fabricated stats on screen.

## 2. Architecture (current)
```
backend-pathway/ (Python 3.11 venv: venv-pathway, Pathway 0.33)
  core/        pure decision logic (unit-tested): geo, models, penalty, incidents (signal inference),
               telemetry (O(1) per-truck state fold), arbitrage (expected-cost optimizer), money (₹ format), config
  pipeline/graph.py  Pathway graph: telemetry → stateful fold → ⋈ registry ⋈ contracts (hot-reload files)
               → assess UDF → ⟕ dispatcher overrides → ⟕ execute/dismiss → fleet table, KPIs, impact,
               LLM explanations (dedup + fully-async + cache)
  connectors/  fleet_simulator.py (sim clock, scenario, random incidents, relief resume, demo trigger/reset),
               command_connector.py (operator commands → Pathway)
  realtime/hub.py  WebSocket :8765 (+GET /health); derives events; signal-lost on wall clock;
               classify_incident, set_ai, demo_control, execute/dismiss; decision history
  llm/         llm_client.py (OpenAI-compatible, stdlib only, Ollama default), explainer.py
  main.py      one process: pipeline + hub + HTTP ingest :8090 (POST /telemetry, /trucks)
  data/contracts/*.json (INR), data/scenarios/demo.json, scripts/benchmark.py, tests/ (31 tests)
Next.js 16 frontend: app/dashboard (map, agent stream, dispatcher desk, AI toggle, demo buttons, popup with
  all options), app/analytics (live KPIs, savings chart, decision log, exports), landing page, login (next-auth demo user)
```
Decision model: WAIT cost = SLA penalty(lateness, grace, cap) + spoilage; RELIEF_i = price + r·exposure(relief)
+ (1−r)·WAIT. Best = min expected cost. EXECUTE if saving ≥ max(₹2,000, 5% of WAIT) and confidence ≥ 0.6.
Incident inference (no driver): crash sensor → accident; DTC (C07xx → flat tyre, else breakdown); external label
(geofence/weather/TMS); ignition on while stopped → idling; else unexplained (Lindy rule). Weak signals never
downgrade strong ones. Dispatcher override wins for that stop.

## 3. Key facts & gotchas
- **Pathway 0.33 float `sum` over updated rows returns 0** → money KPIs summed as integer paise (regression test).
- `pw.reducers.latest` fails on retractions → contracts use `max`.
- Next 16 allows one `next dev` per folder (`.next/dev/lock`); for parallel testing build prod with
  `NEXT_PUBLIC_WS_URL=ws://localhost:8775` and `next start -p 3005`, then **rebuild default** afterwards.
- Self-hosted Geist fonts via `geist` package (Google Fonts fetch broke builds offline).
- `start-demo.sh` needs `logs/` (fixed). `npm run dev:all` = start-demo.
- Teammate's brand pack lives in `public/brand/` (excluded from ESLint).
- Benchmark: 3,000 trucks/s single process (~450 MB); 5,000 at 94% with PATHWAY_THREADS=4.
- Ollama **not installed** on the dev Mac → LLM explanation path is built but **never verified with a real model**.

## 4. Sourced numbers (used in pitch/UI)
- Logistics cost ₹24.01 lakh crore = 7.97% GDP FY24 (DPIIT–NCAER).
- Stoppage delay 5–25% of journey time (TCI–IIM highway study).
- Trucks 200–400 km/day; FTL 32 ft ₹45–85/km; ~20% temperature-sensitive pharma degrades; pharma losses > ₹2,500 Cr/yr.
- AIS-140 VLTD mandatory for national-permit goods vehicles (GSR 1081(E), 2018). Gives GPS/speed/ignition/panic;
  engine DTCs need CAN/OBD-capable devices.
- SAP Business Network Global Track & Trace accepts tracking data from any source (extension slot).
- Contract penalty rates in demo are **illustrative**; relief prices anchored to real per-km rates.

## 5. Demo state
Scenario: TRK-402 stops T+5s → fault P0217 T+9s → critical, popup (₹38,282 at risk, saves ~₹22.5k).
TRK-518 tracker silent T+25s → back T+90s. Demo buttons: Trigger breakdown (TRK-402 fault, then TRK-305 crash
on vaccines → ₹14.1 L at risk, saves ~₹12.9 L), Reset (replays, keeps savings). `DEMO_CONTROLS=false` hides them.

## 6. Mentor / judge feedback history
**Mentor round 1:** (1) "If AI disappears, is it usable?" → yes, deterministic; repositioned copy, AI toggle.
(2) Sell as extension of existing apps (SAP) not standalone SaaS → adapter strategy. (3) Driver must have no role →
machine-signal inference + dispatcher desk.

**Judging round 1 (went well).** Feedback:
1. Show the **actual difference FF makes in real life** (not just ₹24 lakh crore market numbers).
2. Liked the **extension idea**; want to **see it working** (plugin/API?).
3. Data feels **fake/hardcoded**, especially the **trigger button**; improve the dataset.
4. **Simulate truck movement** (we do, but at 1× on an India map it's invisible; popup comes too fast).
5. **Trigger from the backend**, not the frontend: more realistic, functional, industry-ready.
6. (Team's own) UI looks gimmicky / "college project"; needs an industry-ready, trustworthy feel.

## 7. Agreed direction after judging round 1 (pending user answers)
P0:
- **Realistic data feed, out of process:** a separate "mock telematics provider" that posts to the public
  `/telemetry` API (exactly like a real integration); larger fleet on real road routes (OSRM/OSM India),
  time compression so movement is visible, incidents arising from the feed on their own (rates from data).
  Demo buttons hidden/removed.
- **Impact proof:** counterfactual replay, same fleet + same incidents run "without FF" (late discovery,
  default wait) vs "with FF"; per-month ₹ saved, penalties avoided, on-time %, spoilage avoided, CO₂; plus an
  assumptions-transparent fleet calculator (bottom-up, not % of ₹24 lakh crore).
- **Extension showcase:** API-first (OpenAPI spec + webhooks) + embeddable widget; demo inside a mock host
  TMS (generic, SAP-inspired look, not SAP-branded) whose orders flow in and decisions flow back.
- **UI overhaul** with the brand pack: Paper/Ink/Cobalt, Signal/Clear only for delay/saved, Archivo + IBM Plex
  Mono, light theme, dense tables, no emoji/confetti/neon; "exceptions inbox" (incidents sorted by ₹ at risk) as
  the primary view, map secondary; approval with audit.
P1: verify Ollama end to end; auth on WS/ingest; persistence; OSRM self-host; geofences; weather.

## 8. Open questions to the user (asked after judging round 1)
See the chat; record answers here when received.
