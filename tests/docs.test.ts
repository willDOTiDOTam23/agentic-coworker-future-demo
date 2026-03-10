import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("generated agent docs", () => {
  it("keeps the root agents.md aligned with the current topology", () => {
    const rootDoc = fs.readFileSync(path.join(repoRoot, "agents.md"), "utf8");
    expect(rootDoc).toContain("## Agent Graph");
    expect(rootDoc).toContain("OPENAI_REASONING_EFFORT");
    expect(rootDoc).toContain("Session Monitor -> Design Planner when confidence_score >= 0.80");
    expect(rootDoc).toContain("Configuration Visualizer");
    expect(rootDoc).toContain("visual_spec_updated");
  });

  it("writes per-agent documentation files", () => {
    const visualizerDoc = fs.readFileSync(
      path.join(repoRoot, "src/agents/configuration-visualizer/agents.md"),
      "utf8"
    );
    const sessionMonitorDoc = fs.readFileSync(
      path.join(repoRoot, "src/agents/session-monitor/agents.md"),
      "utf8"
    );
    const designPlannerDoc = fs.readFileSync(
      path.join(repoRoot, "src/agents/design-planner/agents.md"),
      "utf8"
    );
    const supplyDoc = fs.readFileSync(
      path.join(repoRoot, "src/agents/supply-orchestrator/agents.md"),
      "utf8"
    );

    expect(visualizerDoc).toContain("VisualizationSpec");
    expect(sessionMonitorDoc).toContain("## Tool Definitions");
    expect(designPlannerDoc).toContain("persist_design_brief");
    expect(supplyDoc).toContain("Supply Orchestrator");
  });

  it("preserves the previous human playbook under docs/team-playbook.md", () => {
    const playbook = fs.readFileSync(path.join(repoRoot, "docs/team-playbook.md"), "utf8");
    expect(playbook).toContain("## Team Roles");
    expect(playbook).toContain("## Repository Norms");
  });
});
