# Adventure Van Demo (ChatGPT Apps + MCP + Codex)

This repository powers a three-role OpenAI demo:

- Part 1: Customer concierge in ChatGPT App SDK (widget-first guided flow).
- Part 2: Operations cockpit in ChatGPT App SDK (priority board and fix recommendations).
- Part 3: Developer coworker in Codex using MCP tool execution and issue fixes.

The local web pages are retained for smoke checks only; the intended demo interaction is in ChatGPT.

## Run locally (MacBook)

1. Install dependencies: `npm install`
2. Copy `.env` and set values:
   - `PORT=3000` (or your local port)
   - `OPENAI_API_KEY` when you want live OpenAI summaries (optional fallback mode keeps the demo running)
3. Start backend: `npm run dev`
4. Open a separate terminal and start tunnel: `npm run ngrok`
5. Point ChatGPT app manifests to:
   - Part 1: `https://<ngrok-url>/api/apps/part-1/manifest`
   - Part 2: `https://<ngrok-url>/api/apps/part-2/manifest`

## Part 1 design goals (customer flow)

1. Guided five-step concierge flow with one follow-up question per turn.
2. Step cards + chips, not wall-of-text output.
3. Auto suggestions for family/safety/budget optimization.
4. `Start over` and `Try safer baseline` recovery controls.

## Part 2 design goals (ops/product owner)

1. P0/P1/P2 triage board.
2. Priority scoring = impact x urgency with confidence tie-break.
3. Immediate fixes and backlog features are shown as separate lanes.
4. `Apply now`, `Create follow-up task`, `Defer to backlog` action model.

## Open endpoints

1. `/api/apps/part-1/manifest`
1. `/api/apps/part-2/manifest`
1. `/api/mcp/tools`
1. `/api/mcp/tools/:toolName/call`
1. `/api/ops/board`
1. `/api/ops/board` includes `priorityQueue`, `fixCandidates`, and `featureBuildCandidates`
1. `/api/ops/kpis`

## Terminal scripts

1. `npm run demo:part-1` run a guided API smoke flow for Part 1.
1. `npm run demo:part-2` show ops board output.
1. `npm run demo:part-3 <ISSUE_ID>` apply a fix via `dev.fixIssue`.
1. `npm run seed:summary` show current catalog/session baseline.
1. `npm run test` run the test suite.

## Notes

- `npm run demo:all` chains all scripts.
- Use `/api/admin/reset` while rehearsing to clear demo state.
