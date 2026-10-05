# FleetFusion (repo: HopOnCode)

Real-time delay decision engine for road freight (Craftverse 2.0 hackathon). **Read `docs/CONTEXT.md` first**: it
holds the full decision log, mentor/judge feedback, gotchas and the current plan. Product overview and
prioritized features: `docs/PRODUCT.md`.

## Rules
- Free / open-source only. No paid APIs.
- The user commits and pushes; give git commands, one per `bash` block. Don't push.
- Plan before large changes; use priorities (P0–P3), never timelines.
- INR everywhere (`core/money.py`, `lib/utils/format.ts`).
- No driver involvement in any flow; AI is optional and never changes decisions.
- README stays plain-language with Mermaid diagrams.
- Never show fabricated numbers as real; label examples and assumptions.

## Commands
- Run demo: `./start-demo.sh` (stop: `./cleanup-demo.sh`). Dashboard http://localhost:3000/dashboard, login demo@fleetfusion.com / demo123.
- Backend tests: `cd backend-pathway && PYTHONPATH=. venv-pathway/bin/python -m pytest tests/`
- Frontend checks: `npm run lint && npm run type-check && npm run build`
- Parallel test stack without disturbing the user's demo: backend `WEBSOCKET_PORT=8775`, frontend prod build with
  `NEXT_PUBLIC_WS_URL=ws://localhost:8775` on port 3005; rebuild with defaults afterwards.
