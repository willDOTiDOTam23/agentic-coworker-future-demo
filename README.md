# Configurate / Control / Customize Demo (ChatGPT Apps + MCP + Codex)

This repository powers a polished three-part OpenAI demo:

- Part 1 (`Configurate`): Customer config momentum in ChatGPT (widget-first guided flow).
- Part 2 (`Control`): Product-owner operational visibility in ChatGPT (priority board + issue detection).
- Part 3 (`Customize`): Live fix segment in Codex that resolves a surfaced issue and returns payoff to the customer flow.

The local web pages are retained for smoke checks only; the intended demo interaction is in ChatGPT.

## Run locally (MacBook)

1. Install dependencies: `npm install`
2. Copy `.env` and set values:
   - `PORT=3000` (or your local port)
   - `OPENAI_API_KEY` when you want live OpenAI summaries (optional fallback mode keeps the demo running)
3. Start backend: `npm run dev`
4. Open a separate terminal and start tunnel: `npm run ngrok`
5. If you are using ChatGPT as an MCP Server, use:
   - Unified MCP URL: `https://<ngrok-url>/api/mcp` (or `https://<ngrok-url>/sse`).
   - Part-specific MCP URLs:
     - Part 1 (van concierge): `https://<ngrok-url>/api/apps/part-1/mcp`
     - Part 2 (PM cockpit): `https://<ngrok-url>/api/apps/part-2/mcp`
   - For this demo, point the App SDK/manifest flow to:
     - `https://<ngrok-url>/api/apps/part-1/manifest`
     - `https://<ngrok-url>/api/apps/part-2/manifest`
6. For real-image ingest and taxonomy:
   - Drop rights-cleared source files into `public/assets/source-drop/configurate`
   - Include `public/assets/source-drop/configurate/rights.json`
     - Per file fields: `file`, `owner`, `usageScope`, `attributionRequired`, `source`
   - Run `npm run assets:ingest`
   - Generated runtime manifest: `public/assets/configurate/visual-manifest.generated.json`
   - Runtime endpoint: `GET /api/assets/visual-manifest`

## Part 1 design goals (Configurate)

1. Guided five-step concierge flow with one follow-up question per turn.
2. Step cards + chips, not wall-of-text output.
3. Auto suggestions for family/safety/budget optimization.
4. `Start over` and `Try safer baseline` recovery controls.

## Part 2 design goals (Control)

1. P0/P1/P2 triage board.
2. Priority scoring = impact x urgency with confidence tie-break.
3. Immediate fixes and backlog features are shown as separate lanes.
4. `Apply now`, `Create follow-up task`, `Defer to backlog` action model.

## Open endpoints

1. `/api/mcp`
1. `/sse`
1. `/.well-known/oauth-authorization-server`
1. `/.well-known/openid-configuration`
1. `/api/apps/part-1/manifest`
1. `/api/apps/part-2/manifest`
1. `/api/apps/part-1/mcp`
1. `/api/apps/part-2/mcp`
1. `/api/mcp/tools`
1. `/api/mcp/tools/:toolName/call`
1. `/api/ops/board`
1. `/api/ops/board` includes `priorityQueue`, `fixCandidates`, and `featureBuildCandidates`
1. MCP methods: `resources/list`, `resources/templates/list`, and `resources/read` (template-backed `ui://` resources)
1. `/api/ops/kpis`
1. `/api/assets/visual-manifest`
1. `/api/ops/dashboard`

### MCP-specific quick checks

```bash
export NGROK_URL="https://<ngrok-url>"
curl "$NGROK_URL/health"
curl "$NGROK_URL/.well-known/oauth-authorization-server"
curl "$NGROK_URL/.well-known/openid-configuration"
curl "$NGROK_URL/api/mcp" -H 'Accept: text/plain'
curl "$NGROK_URL/api/mcp/.well-known/openid-configuration"
curl "$NGROK_URL/api/mcp/tools"
curl "$NGROK_URL/api/apps/part-1/mcp/tools"
curl "$NGROK_URL/api/apps/part-2/mcp/tools"
```

Use this quick smoke check to ensure widget envelopes are returned:

```bash
curl -s -X POST "$NGROK_URL/api/mcp" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"catalog.getCatalog","arguments":{}}}' | jq

curl -s -X POST "$NGROK_URL/api/mcp" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ops.getOpsBoard","arguments":{}}}' | jq
```

## Terminal scripts

1. `npm run demo:part-1` run Configurate and deterministically create a pre-fix issue.
1. `npm run demo:part-2` run Control and show prioritized issue visibility.
1. `npm run demo:part-3` run Customize and apply a live fix.
1. `npm run demo:stage` one-command stage runbook with pause points and expected cues.
1. `npm run seed:summary` show current catalog/session baseline.
1. `npm run assets:ingest` ingest source-drop images, classify taxonomy, and regenerate visual manifest.
1. `npm run test` run the test suite.
1. `npm run test:py` run Python integration tests (requires pytest).  
   For the repo’s managed Python environment, use:
   `python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && npm run test:py`

## Notes

- `npm run demo:all` chains part scripts.
- Use `/api/admin/reset` while rehearsing to clear demo state.
- `GET /api/assets/visual-manifest` now returns rights metadata + taxonomy + deterministic selection payloads.
