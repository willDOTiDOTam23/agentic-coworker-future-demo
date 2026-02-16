#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"

SESSION_ID="${1:-}"

if [[ -n "$SESSION_ID" ]]; then
  echo "=== Part 2: session scoped board ==="
  curl -s "$BASE_URL/api/ops/board?sessionId=$SESSION_ID"
else
  echo "=== Part 2: global ops board ==="
  curl -s "$BASE_URL/api/ops/board"
fi

echo

echo "=== Part 2: issue list ==="
curl -s "$BASE_URL/api/ops/issues"
echo
