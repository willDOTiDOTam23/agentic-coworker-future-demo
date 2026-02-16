#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"
ISSUE_ID="${1:-}"

if [[ -z "$ISSUE_ID" ]]; then
  echo "Usage: npm run demo:part-3 -- <ISSUE_ID>"
  echo "No issueId passed. To discover one: curl -s $BASE_URL/api/ops/issues"
  exit 1
fi

echo "=== Part 3: apply issue fix ==="
curl -s -X POST "$BASE_URL/api/mcp/tools/dev.fixIssue/call" \
  -H 'Content-Type: application/json' \
  -d "{\"issueId\":\"$ISSUE_ID\"}"
echo

echo "=== Part 3: rerun board after fix ==="
curl -s "$BASE_URL/api/ops/board"
echo
