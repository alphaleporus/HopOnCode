# Demo checklist (round 2)

Every step answers a point the judges raised in round 1. The order below is the run order.

## Before the slot

- [ ] Close everything heavy (other browsers, IDEs). Optional: stop unrelated Docker containers
      (`docker ps`), e.g. `velero-dev-control-plane`, to free memory for the AI model.
- [ ] `ollama serve` running; `ollama list` shows `llama3.2:3b`; `backend-pathway/.env` has `LLM_MODEL=llama3.2:3b`.
- [ ] Terminal tab 1: `./start-demo.sh`. Wait for "Monitoring services". **Leave this tab alone**: Ctrl+C stops everything.
- [ ] Let it run a few minutes so trucks spread out along their lanes.
- [ ] Terminal tab 2, typed but not run: `python3 backend-pathway/scripts/inject.py breakdown`
- [ ] Browser tabs, in this order:
  1. http://localhost:3000/dashboard (logged in: demo@fleetfusion.com / demo123)
  2. http://localhost:8082 (Traccar, logged in; TEST-1 and PING deleted; units km/h, km)
  3. http://localhost:3000/analytics
- [ ] Dashboard sidebar: the **AI explanations** switch is on (it's greyed out if the model isn't reachable).
- [ ] Dashboard: 16 trucks on the map, no "signal lost" incidents.
- [ ] Optional dry run: inject once, approve, then restart `./start-demo.sh` so the live counters start at zero.

## Run order

| # | Show | Say (one line) | Judge point |
|---|---|---|---|
| 1 | Dashboard map: 16 trucks moving | "16 real lanes from 6,880 real Indian truck trips (open dataset), on real roads. Time runs 30× so you can see movement." | Data felt fake; simulate movement |
| 2 | Switch to Traccar: same trucks | "This is Traccar, an open-source tracking platform fleets already run, speaking 200+ tracker protocols. FleetFusion plugs into its standard data feed. No new hardware, no driver app." | Extension / plugin working |
| 3 | Tab 2: run `inject.py breakdown` | "I'm not clicking anything in our UI. I'm making the truck's tracker report an engine fault, exactly as real hardware would." | Trigger from the backend; no trigger button |
| 4 | Traccar: the truck's **Alarm: Fault** event | "The tracking platform sees the fault first…" | Plugin |
| 5 | Dashboard: truck goes delayed → **critical** in ~10 s | "…and FleetFusion has priced it against the contract and found the cheapest fix." | Industry-ready flow |
| 6 | Truck panel: options table, contract, cause of stop | "Waiting costs ₹X in penalties; this relief truck saves ₹Y. A dispatcher can correct the cause; the price updates instantly." | Real-life difference |
| 7 | Toggle **AI off**, then back on | "AI only rewords the explanation. Off, the decision is identical. If the AI contradicts the engine, we drop its text." | Mentor: what if AI disappears |
| 8 | **Approve**; point at tab 1 / devices log: "Relief accepted" | "The decision goes back out to the carrier's system by webhook. Approving twice can't double-book." | Extension, two-way |
| 9 | Analytics: impact comparison; move one assumption slider | "Same incidents, two ways: ₹7,705 → ₹3,639 per incident, about ₹9 lakh a month per 100 trucks. Every assumption is on screen; here's the range." | Actual difference in real life |

## If something goes wrong

| Symptom | Do |
|---|---|
| `inject.py` says connection refused | The demo stopped. Restart `./start-demo.sh` in tab 1 (takes about a minute). |
| `inject.py` says "No moving truck available" | `python3 backend-pathway/scripts/inject.py list`, then `… breakdown TRK-10x` with a moving one. |
| Truck stays "delayed", never critical | It had enough slack to still arrive on time (correct behaviour). Inject on another truck. |
| AI text slow or missing | Keep going: the engine's own summary is shown. Or toggle AI off and make the point from step 7. |
| Dashboard says backend offline | Check http://localhost:8765/health. If down, restart tab 1. |
| Docker / Traccar won't start | `FEED=internal ./start-demo.sh`: built-in simulator, TRK-402 breaks down on its own. |

## Likely questions

- **Is the data real?** Lanes, distances and the 63% late rate are from a real open dataset (CC BY-SA). Truck movement
  and incidents are simulated; contract penalty rates are illustrative. We label which is which.
- **Is the impact proven?** It's a simulation on real lanes with stated assumptions, not a pilot result. The range is
  ₹3–16 lakh a month per 100 trucks depending on incident rate and how late stops are noticed today.
- **How does it plug into SAP or a TMS?** Same pattern as Traccar: orders and contracts in, decisions out by webhook
  (the outbound half runs in the demo). An SAP connector is the next adapter; we don't claim it today.
- **Who can approve? Security?** Today the dashboard connection only accepts our own web app. Login tokens and
  per-device API keys come before any pilot.
- **Does the driver do anything?** No. Causes come from machine signals (fault codes, crash sensor, ignition,
  tracker silence); only office staff act.
