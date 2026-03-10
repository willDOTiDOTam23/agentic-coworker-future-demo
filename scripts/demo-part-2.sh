#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"
SESSION_ID="${1:-}"

if [[ -z "$SESSION_ID" ]]; then
  echo "No session id provided. Seeding deterministic issue through Control helper tool..."
  SEEDED="$(curl -s -X POST "$BASE_URL/api/mcp/tools/ops.seedDeterministicIssue/call" -H 'Content-Type: application/json' -d '{}')"
  echo "$SEEDED"
  SESSION_ID="$(node -e "const body=JSON.parse(process.argv[1]); process.stdout.write(body?.data?.sessionId ?? '')" "$SEEDED")"
  ISSUE_ID="$(node -e "const body=JSON.parse(process.argv[1]); process.stdout.write(body?.data?.issue?.id ?? '')" "$SEEDED")"
else
  ISSUE_ID=""
fi

echo
echo "=== Control (Part 2): operational visibility ==="
BOARD="$(curl -s "$BASE_URL/api/ops/board?sessionId=$SESSION_ID")"
echo "$BOARD"

echo
echo "=== Control issue list (session scoped) ==="
ISSUES="$(curl -s "$BASE_URL/api/ops/sessions/$SESSION_ID/issues")"
echo "$ISSUES"

echo
echo "DEMO_CONTEXT:{\"sessionId\":\"$SESSION_ID\",\"seededIssueId\":\"$ISSUE_ID\"}"
