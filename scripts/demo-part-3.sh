#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"
ISSUE_ID="${1:-}"

if [[ -z "$ISSUE_ID" ]]; then
  echo "No issueId passed. Auto-selecting first open issue..."
  ISSUE_ID="$(curl -s "$BASE_URL/api/ops/issues" | node -e "const fs=require('fs'); const input=fs.readFileSync(0,'utf8').trim(); const items=JSON.parse(input||'[]'); const open=items.find((issue)=>!issue.fixed); if(open?.id){process.stdout.write(open.id);} else {process.exit(1);} ")"
fi

echo "=== Customize (Part 3): apply live fix ==="
FIX_RESULT="$(curl -s -X POST "$BASE_URL/api/mcp/tools/dev.fixIssue/call" -H 'Content-Type: application/json' -d "{\"issueId\":\"$ISSUE_ID\"}")"
echo "$FIX_RESULT"

SESSION_ID="$(node -e "const body=JSON.parse(process.argv[1]);process.stdout.write(body?.data?.session?.id ?? '')" "$FIX_RESULT")"

echo
echo "=== Customize verification: board after fix ==="
curl -s "$BASE_URL/api/ops/board"
echo

echo "DEMO_CONTEXT:{\"issueId\":\"$ISSUE_ID\",\"sessionId\":\"$SESSION_ID\"}"
