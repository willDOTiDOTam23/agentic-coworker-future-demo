# Findings

- MCP server now supports resources discovery/read methods in addition to tools calls.
- Render tools are explicitly split from data tools and carry MCP Apps + ChatGPT compatibility metadata.
- UI resources are exposed via `ui://configurate/session-card.html` and `ui://control/priority-board.html`.
- Visual manifest is runtime-driven and now includes rights metadata + taxonomy per asset.
- Deterministic stage flow requires selecting a template at session start to reach submit-ready state and surface compatibility issues.
- Accessory mapping uses strict type matching; missing accessory types correctly fall back to placeholder imagery.
