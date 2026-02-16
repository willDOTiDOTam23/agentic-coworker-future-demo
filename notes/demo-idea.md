# Agentic Coworkers of the Future - Demo Plan

## Core Narrative (Cinematic 3-Act Structure)

### Part 1 — Situation: Customer Experience Live in ChatGPT (Sales & Marketing Coworker)
- **App/service:** `part-1-customer-app` (customer-facing ChatGPT App SDK surface)
- **Actor:** Sales & Marketing coworker
- **Purpose:** Let a customer configure an adventure van in a fast, playful, voice-friendly flow.
- **Flow goal:** Keep responses concise and interactive using widgets/controls and short cards instead of walls of text.
- **Experience to show:**
  - User asks for a build (e.g., “I want a weekend-ready solar camper with kids”).
  - App uses MCP-backed tool calls to populate options and recommend a configuration.
  - Configurator is dynamic and visual (budget slider, occupancy, terrain, climate, interior layout, power features, exterior kit).
  - Customer can iterate quickly and confirms a draft configuration.
- **Demo intent:** Establish that customer-facing ChatGPT can drive real product configuration with speed, personality, and clarity.
- **Data shown:** realistic van catalog, option pricing, regional availability, lead/quote draft, constraints, and delivery estimate.

### Part 2 — Problem: Internal Oversight App (Product Owner Copilot)
- **App/service:** `part-2-internal-app` (internal-facing ChatGPT App SDK surface)
- **Actor:** Product Owner / Operations coworker
- **Purpose:** Show how internal teams observe and improve the customer experience in near real time.
- **Flow goal:** Track how the Part 1 customer journey is proceeding and surface any failures.
- **Experience to show:**
  - Internal app receives live request context, logs, and interaction metadata from Part 1.
  - Highlights an issue/bug (e.g., bad compatibility rule, unavailable option, or pricing inconsistency).
  - Shows KPIs, request timeline, and failed-step diagnostics in concise widgets.
  - ChatGPT suggests prioritized fixes and proposes next feature work from observed friction.
  - It generates a concrete implementation ticket for developers with acceptance notes.
- **Demo intent:** Position ChatGPT as a product-owning intelligence layer: observability + triage + feature ideation.
- **Data shown:** realistic metrics, queue depth, session transcripts, config failures, component availability conflicts, suggested backlog items.

### Part 3 — Resolution: Codex 5.3 Spark Builds the Fix
- **Service:** local Codex execution loop (developer experience)
- **Actor:** Development Coworker
- **Purpose:** Convert Part 2’s suggested feature/fix into a rapid implementation while customer-facing app runs locally.
- **Flow goal:** Demonstrate Codex 5.3 Spark quickly applying a practical fix from the issue identified.
- **Experience to show:**
  - Codex picks up one prioritized Part 2 suggestion.
  - Makes a targeted code/data correction and notes rationale.
  - Re-runs smoke checks and confirms the scenario can proceed.
  - Deploys locally with fast feedback while preserving context continuity.
- **Demo intent:** Show “agentic coworker” from product to engineering loop in one continuous performance moment.

### Act 4 — Return to Part 1: The Recovered Customer Journey
- After resolution, we return to the customer in Part 1.
- The same customer flow now succeeds with the fix applied.
- Experience is now smoother and more confident:
  - corrected recommendation
  - no blocking error
  - higher finish confidence and clear next action.
- **Message:** the system is a closed-loop co-working loop across customer, ops/product, and engineering agents.

## Technical Blueprint

### Architecture
- Single local server hosts:
  - Part 1 App SDK service + chat surface endpoint(s)
  - Part 2 App SDK service + chat surface endpoint(s)
  - Shared MCP server endpoints for tool calls
- Both ChatGPT apps are separate surfaces but run from same runtime to enable local coordination.
- ngrok can expose the MCP endpoints to ChatGPT for live local integration.

### UX Constraints
- Avoid wall-of-text outputs; prioritize compact cards, compact summaries, quick actions, and chips/buttons.
- Ensure a fast interaction loop (short, direct language and immediate state updates).
- Include optional full-screen presentation mode for stage/demo clarity.

### Data Requirements
- Seed realistic-looking local dataset for both experiences:
  - Product catalog (base platforms, builds, packages)
  - Option inventory and compatibility rules
  - Customer session/request records
  - Internal logs and event stream
  - Analytics snapshots and suggested backlog items

### Narrative Tone
- Cinematic and theatrical, but concise and broadly applicable.
- Keep each act clear:
  - Part 1 establishes context and value
  - Part 2 reveals friction
  - Part 3 resolves with Codex + 5.3 Spark
  - Return to Part 1 confirms impact
