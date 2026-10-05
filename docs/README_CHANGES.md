# Suggested README changes

Review of the refreshed README (commit `fcfa17b`). It is accurate and already covers Traccar, the real
dataset, impact, the 40 tests and the layout. Only these small fixes remain.

| # | Where | Problem | Change |
|---|---|---|---|
| 1 | `07` Run it | `python backend-pathway/scripts/inject.py` fails on a Mac: there is no `python` command, only `python3` | Use `python3` (see A) |
| 2 | `07` Run it | Traccar's own map (port 8082) shows no trucks until they are linked to your account once | Add the one-time step (see A) |
| 3 | `07` Run it | Dates in Traccar run ahead of the calendar (30× demo clock); looks like a bug if unexplained | Add one line (see A) |
| 4 | `07` Run it | No AI setup: which model, and that 8 GB machines should use the small one | Add the optional AI step (see A) |
| 5 | `06` Impact | Table header says "Per 100 trucks" but the first three rows are per incident | Rename the header (see B) |
| 6 | `04` One incident | TRK-402 is the built-in simulator's scripted truck; the default Traccar demo has TRK-101–116 | Add a one-line caption (see C) |
| 7 | — | No security note | Add one line (see D) |
| 8 | Badge + `10` Layout | Tests are now 45 (double-approval guard, AI explanation checks) | `tests-45%20passing`, `45 tests` |

## A. `07` Run it (replace from "With Docker running…" to the end of the section)

```markdown
With Docker running, the demo starts Traccar and 16 simulated trackers on real South-India lanes; without Docker it
falls back to the built-in simulator (`FEED=internal`).

**Traccar's own map** is at `http://localhost:8082`. First time only: create the admin account there, then link the
trackers to it so they appear in its list:

    python3 infra/traccar_link_devices.py
    docker restart fleetfusion-traccar

The demo clock runs 30× faster so trips play out in minutes, which is why dates in Traccar run ahead of today.

Cause an incident from the backend, the way real data would arrive:

    python3 backend-pathway/scripts/inject.py breakdown

Other types: `accident`, `flat_tyre`, `traffic`, `checkpoint`, `tracker_offline`; `list` shows every truck.
Stop everything with `./cleanup-demo.sh`.

**Optional AI explanations** (local, free): install [Ollama](https://ollama.com), run `ollama serve`, then
`ollama pull llama3.2:3b` (the default in `backend-pathway/.env`). Smaller models (1b) get the recommendation wrong
too often, so their text is rejected and the engine's own summary is shown. Explanations whose figures or choice
don't match the engine are always dropped; decisions are identical with AI on or off.
```

## B. `06` Impact table header

```markdown
| Per incident | Today | FleetFusion |
|---|---|---|
| Cost | ₹7,705 | **₹3,639** |
| Ends in a late delivery | 24% | **12%** |
| Relief truck booked | 29% | **14%** |

**Saving: ≈ ₹9 L a month per 100 trucks.**
```

## C. `04` caption (under the image)

```markdown
> The scripted breakdown from the built-in simulator (`FEED=internal`). In the default Traccar demo the same flow runs
> on any of TRK-101–116 when you inject an incident.
```

## D. Security (add after `08` Connect a real fleet)

```markdown
**Security:** the dashboard connection only accepts browsers from `WS_ALLOWED_ORIGINS` (default
`http://localhost:3000`). Login tokens for operator actions and API keys for data ingest are still to do before
hosting it publicly.
```
