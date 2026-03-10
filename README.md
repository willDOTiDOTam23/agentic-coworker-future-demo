# Northstar Vans Realtime Demo

This repo now runs a two-site OpenAI demo for a hypothetical adventure van brand:

- `customer.html`: a voice-first van configurator powered by `gpt-realtime`
- `ops.html`: a live operations view powered by OpenAI Agents SDK agents on `gpt-5.4`

The customer site keeps the interface intentionally minimal. The ops site shows how agentic systems can monitor the session, generate a design brief, and produce a supply-order artifact behind the scenes.

## Quickstart

Prerequisites:

- Node.js 22+
- A project-root `.env` file with `OPENAI_API_KEY`

Optional env vars:

- `OPENAI_REASONING_EFFORT=high`
- `SQLITE_PATH=northstar-demo.db`
- `PORT=3000`

Run everything with one command:

```bash
npm install && npm run dev
```

Then open:

- Customer site: [http://localhost:5173/customer.html](http://localhost:5173/customer.html)
- Ops site: [http://localhost:5173/ops.html](http://localhost:5173/ops.html)
- API health: [http://localhost:3000/health](http://localhost:3000/health)

## What The Demo Does

### Part 1: Customer Voice Build

- Starts a Realtime WebRTC session with `gpt-realtime`
- Walks the customer through a five-step configuration flow
- Shows dual waveform animation for customer and assistant audio
- Builds the van illustration and color palette dynamically as choices are saved

### Part 2: Ops Agent Pipeline

- Persists every customer session in SQLite
- Runs three OpenAI Agents SDK agents:
  - `Session Monitor`
  - `Design Planner`
  - `Supply Orchestrator`
- Streams agent activity into the ops UI over SSE
- Stores generated Design Brief and Supply Order artifacts in SQLite

### Part 3: Codex Demo Segment

- Reserved for live edits during the demo

## Core Commands

```bash
npm run dev
npm run build
npm test
npx playwright test tests/e2e/ops.spec.ts --reporter=line
```

## Repo Docs

- Generated agent-system spec: `agents.md`
- Team workflow playbook: `docs/team-playbook.md`
- Per-agent docs:
  - `src/agents/session-monitor/agents.md`
  - `src/agents/design-planner/agents.md`
  - `src/agents/supply-orchestrator/agents.md`

## Demo Notes

- The local `.env` is loaded with override semantics, so the repo-local `OPENAI_API_KEY` wins over any stale shell export.
- The ops agents use `gpt-5.4` with shared `OPENAI_REASONING_EFFORT`.
- The customer site and ops site are separate experiences, but they share the same backend and SQLite state.
