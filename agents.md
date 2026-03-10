# Agents System

> Generated file. Edit the typed agent metadata and prompts in src/agents, then regenerate with `npm run agents:docs`.

## Agent Graph
- **Session Monitor**: Assess session maturity, confidence, blockers, and whether the workflow should advance to design planning. Handoffs: Design Planner when confidence_score >= 0.80.
- **Design Planner**: Generate the Design Brief artifact from structured customer requirements and explicit uncertainties. Handoffs: Supply Orchestrator after persist_design_brief succeeds.
- **Supply Orchestrator**: Create a structured Supply Order draft that translates the approved configuration into sourcing-ready work. Handoffs: No downstream handoffs.

## Shared Models
- Customer voice site: `gpt-realtime`
- Ops agents: `gpt-5.4`

## Shared Tools
- `load_session_context`
- `list_artifacts`
- `publish_status_event`
- `persist_design_brief`
- `persist_supply_order`

## Shared Input Envelope
- Session snapshot from `config_sessions`
- Recent turns from `conversation_turns`
- Existing artifact summaries from `artifacts`

## Shared Output Envelope
- Session Monitor returns the monitor assessment contract.
- Design Planner returns the typed Design Brief contract.
- Supply Orchestrator returns the typed Supply Order contract.

## Handoff Thresholds
- Session Monitor -> Design Planner when confidence_score >= 0.80
- Design Planner -> Supply Orchestrator after a Design Brief artifact is successfully persisted

## Artifact Ownership
- Design Planner owns `design-brief` artifact generation.
- Supply Orchestrator owns `supply-order` artifact generation.
- Artifacts are append-only revisions stored in `artifacts`.

## SSE Event Taxonomy
- `agent_started`
- `agent_status`
- `agent_handoff`
- `tool_started`
- `tool_completed`
- `artifact_ready`
- `agent_completed`
- `agent_failed`

## SQLite Tables
- `config_sessions`
- `conversation_turns`
- `agent_events`
- `artifacts`

## Reasoning Configuration
- Env var: `OPENAI_REASONING_EFFORT`
- Allowed values: `none`, `low`, `medium`, `high`, `xhigh`
- Default: `high`
