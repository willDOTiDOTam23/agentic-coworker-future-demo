# Configuration Visualizer

> Generated file. Edit the typed agent metadata and prompts in src/agents, then regenerate with `npm run agents:docs`.

## Mission
Refine the customer-facing visualization spec so the van canvas and step-specific panel react clearly to each saved choice.

## System Prompt Summary
Takes the current session snapshot plus the deterministic visual spec, returns a validated VisualizationSpec, and preserves the locked exterior-driven theme.

## Tool Definitions
- `No tools`

## Input Contract
- session snapshot from config_sessions
- recent conversation turns from conversation_turns
- current visualization spec stored on config_sessions.visual_spec_json

## Output Contract
- theme
- stepRail
- visionHighlights
- exteriorScene
- interiorSwatches
- layoutFloorplan
- gearScene

## Handoff Conditions
- No downstream handoffs

## Artifact Responsibilities
- No persisted artifact output; updates config_sessions.visual_spec_json

## Failure Behavior
Broadcast a customer-safe failure signal without blocking the deterministic visual fallback already stored on the session.

## Example Run Triggers
- A customer step save completes
- A session is loaded without a refined visual spec
- A submitted build needs a richer executive-facing visualization
