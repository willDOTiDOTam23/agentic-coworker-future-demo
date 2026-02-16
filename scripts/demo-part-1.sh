#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MCP_BASE_URL:-http://localhost:3000}"

echo "=== Part 1: start guided customer flow ==="
curl -s -X POST "$BASE_URL/api/mcp/tools/customer.startSession/call" \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Ari Quill","budgetBand":"premium","terrain":"winter","region":"CO","tripStyle":"family-overland","moods":["family","winter"]}'

echo

echo "Tip: keep this session id and replay options with /api/mcp/tools/customer.advanceSession/call"
echo "curl -s -X POST \"$BASE_URL/api/mcp/tools/customer.advanceSession/call\" -H 'Content-Type: application/json' -d '{\"sessionId\":\"<SESSION_ID>\",\"optionId\":\"option-solar-canopy\"}'"
