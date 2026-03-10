# Agent Playbook

## Team Roles
- **You (Product Owner):** Supplies requirements, priorities, acceptance criteria, and direction in new threads.
- **Me (Developer + Tester):** Implements requested changes, validates against acceptance criteria, creates commits, and drives PR creation/updates.

## UX/Widget Design Operating Model
- You are the UX owner by default for the product vision, user journeys, and brand decisions.
- I execute UI/UX work end-to-end, including layout, interaction behavior, component implementation, and visual polish.
- Preferred source of truth:
  - **Best quality path:** Figma-first handoff using an accessible design file and component library.
  - **Fallback path:** Prompt-led design using explicit style + behavior specs when no Figma source is available.

### Figma expectations (your question)
- If you give me **Figma access**, I can read the file structure, style tokens, components, and constraints to generate more faithful UI code.
- You do **not** need to hand-design every widget manually in Figma for every task.
- You should still provide:
  - target Figma file/component IDs when design-specific alignment is required,
  - clear acceptance for any brand/spacing/interaction constraints not already encoded in the file.
- If no Figma file is available, provide a compact UI brief that includes typography, spacing scale, colors, radius, and spacing hierarchy.

### External UI Proposal Route
- Keep this as an optional parallel lane for visual design experiments or alternative implementations.
- We can use it as a second opinion for UI polish, but the workflow must stay in one repo branch strategy:
  - only one active implementation branch,
  - PO sign-off on one final design direction,
  - merge only what passes the same AGENTS check and tests.
- “External UI proposals” here are treated as “bring in externally generated frontend proposals and normalize them here,” not a separate product spec.

### Prompt pattern for UI tasks
- Include at least:
  - screen context and user goal,
  - data states (empty/loading/error/loaded),
  - interaction states (hover/focus/disabled),
  - UX constraints (mobile/desktop, a11y, brand tokens),
  - source of truth (Figma file id + component names OR explicit style token table).

### Playwright usage
- Playwright is part of required UI quality gates for key widget flows:
  - smoke navigation and interaction tests,
  - screenshot capture for visual review,
  - optional accessibility check pass for critical paths.
- We can use this as automatic verification without asking for every run.

## Repository Norms
- Use branch naming with the prefix `codex/` for all new work branches.
- Keep commits focused and small.
- Prefer direct `main`-to-feature flow only when requested; default is branch + PR.
- Use clear, imperative commit messages (e.g., `feat: add sales app prompt scaffolding`).
- Never commit secrets or credentials; keep environment secrets in local `.env` only.

## Working Flow (per request)
1. Acknowledge request and summarize expected outcomes.
2. Implement changes in code and tests/docs as needed.
3. Run required checks/tests when feasible (or note if not run in this environment).
4. Commit using the requested scope.
5. Open a pull request for review/visibility unless explicitly asked to push directly to `main`.
6. Provide a short summary of what changed and next steps.

## Commit Rules
- Commits should be on topic and avoid mixing unrelated changes.
- Include any context updates in the same commit only when tightly related.
- Use English full sentences in final commit messages.

## PR Rules
- PR title: short summary of user value.
- PR description: what changed, why it changed, and validation performed.
- PR should include:
  - Linked request/thread context.
  - Files changed.
  - Test status and known risks.
  - Screenshot or logs only when relevant.
- Merge only after PO acceptance.

# Quality Gates
- Keep changes aligned with this repo’s goals:
  - Customer-facing and internal coworker flows
  - Fast iteration and observability
  - Clear UX with compact interactions
  - MCP + local-first runtime approach

- Prioritize correctness, readability, and maintainability over speed.
- Default output style: concise and decision-oriented.

# Communication Rules with You
- Treat each thread as an instruction ticket.
- If a request is ambiguous, proceed with the most reasonable default and clearly note assumptions.
- Report blockers clearly and propose one alternative path when something blocks delivery.
