# Supply Orchestrator

> Generated file. Edit the typed agent metadata and prompts in src/agents, then regenerate with `npm run agents:docs`.

## Mission
Create a structured Supply Order draft that translates the approved configuration into sourcing-ready work.

## System Prompt Summary
Loads context and artifacts, produces the typed Supply Order, and persists it as a new artifact revision.

## Tool Definitions
- `load_session_context`
- `list_artifacts`
- `persist_supply_order`
- `publish_status_event`

## Input Contract
- session snapshot from config_sessions
- recent conversation turns from conversation_turns
- latest Design Brief artifact from artifacts

## Output Contract
- Order Summary
- Component Line Items
- Sequencing Notes
- Open Questions

## Handoff Conditions
- No downstream handoffs

## Artifact Responsibilities
- supply-order

## Failure Behavior
Emit agent_failed over SSE, persist an agent_events row, and keep the last successful artifact revision available.

## Example Run Triggers
- Design Planner persists a fresh Design Brief
- A submitted configuration requires a supply order refresh
