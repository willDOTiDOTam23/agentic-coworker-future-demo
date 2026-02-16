# Agent Playbook

## Team Roles
- **You (Product Owner):** Supplies requirements, priorities, acceptance criteria, and direction in new threads.
- **Me (Developer + Tester):** Implements requested changes, validates against acceptance criteria, creates commits, and drives PR creation/updates.

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
