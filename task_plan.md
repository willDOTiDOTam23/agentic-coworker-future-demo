# Task Plan

## Goal
Deliver a polished three-part demo with locked naming (`Configurate`, `Control`, `Customize`), rights-cleared image ingestion, MCP Apps resource/template compatibility, and deterministic stage runbook flow.

## Phases
- [x] Discover current architecture and constraints.
- [x] Rename manifests/UI/scripts/docs for final narrative.
- [x] Implement rights-aware ingestion + taxonomy + deterministic runtime selections.
- [x] Add MCP resources/templates + render/data tool split + compatibility metadata.
- [x] Add deterministic issue seed + stage runbook.
- [x] Update tests and run verification.

## Risks
- Existing uncommitted work was preserved; no unrelated changes were reverted.
- Ingestion pipeline now expects rights metadata and excludes Noovo-origin sources.
- Stage scripts depend on local server availability and use deterministic seeded payloads.
