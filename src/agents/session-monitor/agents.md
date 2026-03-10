# Session Monitor

> Generated file. Edit the typed agent metadata and prompts in src/agents, then regenerate with `npm run agents:docs`.

## Mission
Assess session maturity, confidence, blockers, and whether the workflow should advance to design planning.

## System Prompt Summary
Calls load_session_context first, publishes a concise operational status, and only hands off when confidence is at least 0.80.

## Tool Definitions
- `load_session_context`
- `list_artifacts`
- `publish_status_event`

## Input Contract
- session snapshot from config_sessions
- recent conversation turns from conversation_turns
- artifact summaries from artifacts

## Output Contract
- status_summary
- confidence_score
- risk_flags
- next_action
- handoff_decision

## Handoff Conditions
- Design Planner when confidence_score >= 0.80

## Artifact Responsibilities
- No artifact output

## Failure Behavior
Emit agent_failed over SSE and persist an agent_events row with the error summary.

## Example Run Triggers
- Customer finishes a step save
- Customer submits the build
- Ops replay requests a refresh
