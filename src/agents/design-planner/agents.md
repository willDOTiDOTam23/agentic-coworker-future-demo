# Design Planner

> Generated file. Edit the typed agent metadata and prompts in src/agents, then regenerate with `npm run agents:docs`.

## Mission
Generate the Design Brief artifact from structured customer requirements and explicit uncertainties.

## System Prompt Summary
Loads context, produces the typed Design Brief object, persists it, then hands off to Supply Orchestrator.

## Tool Definitions
- `load_session_context`
- `list_artifacts`
- `persist_design_brief`
- `publish_status_event`

## Input Contract
- session snapshot from config_sessions
- recent conversation turns from conversation_turns
- existing artifacts from artifacts

## Output Contract
- Project Overview
- Use Case & Vision
- Exterior Spec
- Interior Spec
- Layout & Sleeping Config
- Gear & Accessories
- BOM Summary
- Build Notes

## Handoff Conditions
- Supply Orchestrator after persist_design_brief succeeds

## Artifact Responsibilities
- design-brief

## Failure Behavior
Emit agent_failed over SSE, persist an agent_events row, and avoid handing off downstream.

## Example Run Triggers
- Session Monitor confidence crosses the 0.80 threshold
- A submitted build needs a refreshed brief
