#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"

call_tool() {
  local tool_name="$1"
  local payload="$2"
  curl -s -X POST "$BASE_URL/api/mcp/tools/${tool_name}/call" \
    -H 'Content-Type: application/json' \
    -d "$payload"
}

extract_json_field() {
  local json="$1"
  local path_expr="$2"
  node -e "const body=JSON.parse(process.argv[1]); const path=process.argv[2].split('.'); let cursor=body; for (const key of path){cursor=cursor?.[key];} if(cursor===undefined||cursor===null){process.exit(1);} if(typeof cursor==='object'){process.stdout.write(JSON.stringify(cursor));} else {process.stdout.write(String(cursor));}" "$json" "$path_expr"
}

echo "=== Configurate (Part 1): customer momentum flow ==="

START_RESULT="$(call_tool "customer.startSession" '{"customerName":"Ari Quill","budgetBand":"luxury","terrain":"water","region":"CO","tripStyle":"family-overland","moods":["family","water"],"templateId":"template-ridge-ramble"}')"
echo "$START_RESULT"
SESSION_ID="$(extract_json_field "$START_RESULT" 'data.session.id')"

echo
echo "Session: $SESSION_ID"

call_tool "customer.advanceSession" "{\"sessionId\":\"$SESSION_ID\",\"exterior\":{\"paintColor\":\"paint-matte-graphite\",\"roofRack\":\"rack-rugged\",\"wheels\":\"wheel-all-terrain\",\"lights\":\"light-led\"},\"nextStep\":3}" >/dev/null
call_tool "customer.advanceSession" "{\"sessionId\":\"$SESSION_ID\",\"interior\":{\"level\":\"moderate-build-out\",\"lifestyleMode\":\"true-adventure\"},\"nextStep\":4}" >/dev/null
call_tool "customer.advanceSession" "{\"sessionId\":\"$SESSION_ID\",\"power\":{\"drivetrain\":\"hybrid\"},\"nextStep\":5}" >/dev/null
call_tool "customer.advanceSession" "{\"sessionId\":\"$SESSION_ID\",\"optionId\":\"option-snow-traction\"}" >/dev/null

SUBMIT_RESULT="$(call_tool "customer.submitSession" "{\"sessionId\":\"$SESSION_ID\"}")"
ISSUE_ID="$(extract_json_field "$SUBMIT_RESULT" 'data.issue.id' || true)"

echo "=== Configurate result (pre-fix) ==="
echo "$SUBMIT_RESULT"
echo
if [[ -n "$ISSUE_ID" ]]; then
  echo "Deterministic issue created: $ISSUE_ID"
else
  echo "No issue id returned (check payload manually)."
fi

echo
echo "DEMO_CONTEXT:{\"sessionId\":\"$SESSION_ID\",\"issueId\":\"$ISSUE_ID\"}"
