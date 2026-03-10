#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"
AUTO_RUN="${DEMO_AUTO_RUN:-0}"

pause_point() {
  local title="$1"
  local cue="$2"
  echo
  echo "----- ${title} -----"
  echo "Expected cue: ${cue}"
  if [[ "$AUTO_RUN" != "1" ]]; then
    read -r -p "Press Enter to continue... " _
  fi
}

extract_context_json() {
  local output="$1"
  node -e "const out=process.argv[1]; const line=out.split('\\n').find((entry)=>entry.startsWith('DEMO_CONTEXT:')); if(!line){process.exit(1);} process.stdout.write(line.slice('DEMO_CONTEXT:'.length));" "$output"
}

extract_field() {
  local json_payload="$1"
  local key="$2"
  node -e "const payload=JSON.parse(process.argv[1]); process.stdout.write(String(payload?.[process.argv[2]] ?? ''));" "$json_payload" "$key"
}

echo "=== Stage Runbook: Configurate → Control → Customize ==="
echo "Base URL: $BASE_URL"

echo
echo "[0] Reset demo state"
curl -s -X POST "$BASE_URL/api/admin/reset"
echo

PART1_OUTPUT="$(bash scripts/demo-part-1.sh)"
echo "$PART1_OUTPUT"
PART1_CONTEXT="$(extract_context_json "$PART1_OUTPUT")"
SESSION_ID="$(extract_field "$PART1_CONTEXT" "sessionId")"
ISSUE_ID="$(extract_field "$PART1_CONTEXT" "issueId")"

pause_point "Part 1 Complete" "Configurate should show a blocked or needs-attention state with an issue id."

PART2_OUTPUT="$(bash scripts/demo-part-2.sh "$SESSION_ID")"
echo "$PART2_OUTPUT"
pause_point "Part 2 Complete" "Control should surface the session issue as a top fix candidate."

PART3_OUTPUT="$(bash scripts/demo-part-3.sh "$ISSUE_ID")"
echo "$PART3_OUTPUT"
PART3_CONTEXT="$(extract_context_json "$PART3_OUTPUT" || true)"
FIXED_SESSION_ID="$(extract_field "$PART3_CONTEXT" "sessionId" || true)"
if [[ -n "$FIXED_SESSION_ID" ]]; then
  SESSION_ID="$FIXED_SESSION_ID"
fi

pause_point "Part 3 Complete" "Customize should show the issue fixed and Control board should de-escalate."

echo
echo "[Final] Re-run Configurate submit for payoff"
FINAL="$(curl -s -X POST "$BASE_URL/api/mcp/tools/customer.submitSession/call" -H 'Content-Type: application/json' -d "{\"sessionId\":\"$SESSION_ID\"}")"
echo "$FINAL"

echo
echo "Runbook complete."
