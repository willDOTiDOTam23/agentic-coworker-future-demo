#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"
ISSUE_ID="${1:-}"

if [[ -z "$ISSUE_ID" ]]; then
  echo "No issueId passed. Auto-selecting first open issue..."
  ISSUE_ID="$(curl -s "$BASE_URL/api/ops/issues" | node -e "const fs = require('fs'); const input = fs.readFileSync(0, 'utf8').trim(); if (!input) { process.exit(1); } try { const items = JSON.parse(input); const open = Array.isArray(items) ? items.find((issue) => !issue.fixed) : null; if (open?.id) { console.log(open.id); process.exit(0); } process.exit(1); } catch { process.exit(1); }")"
  if [[ -z "$ISSUE_ID" ]]; then
    echo "No open issues found. Seeding board first by re-running Part 2 for a blocked session may help."
    exit 1
  fi
  echo "Using issue: $ISSUE_ID"
fi

echo "=== Part 3: apply issue fix ==="
curl -s -X POST "$BASE_URL/api/mcp/tools/dev.fixIssue/call" \
  -H 'Content-Type: application/json' \
  -d "{\"issueId\":\"$ISSUE_ID\"}"
echo

echo "=== Part 3: rerun board after fix ==="
curl -s "$BASE_URL/api/ops/board"
echo
