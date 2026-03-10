import { describe, expect, it } from "vitest";
import { createAgentGraph } from "../src/agents/orchestrator.js";
import { createVisualizationAgent } from "../src/agents/configuration-visualizer/index.js";
import { parseAppConfig } from "../src/lib/config.js";

describe("ops agent graph", () => {
  it("keeps the monitor on the requested reasoning level while capping artifact agents for responsiveness", () => {
    const config = parseAppConfig({
      NODE_ENV: "test",
      PORT: "3100",
      SQLITE_PATH: ":memory:",
      OPENAI_API_KEY: "test-key",
      OPENAI_REASONING_EFFORT: "xhigh"
    });

    const rootAgent = createAgentGraph(config);
    const designPlanner = (rootAgent.handoffs[0] as { agent: { modelSettings: { reasoning?: { effort?: string } }; handoffs: unknown[] } })
      .agent;
    const supplyOrchestrator = (
      designPlanner.handoffs[0] as { agent: { modelSettings: { reasoning?: { effort?: string } } } }
    ).agent;

    expect(rootAgent.model).toBe("gpt-5.4");
    expect(rootAgent.modelSettings.reasoning?.effort).toBe("xhigh");
    expect(designPlanner.modelSettings.reasoning?.effort).toBe("medium");
    expect(supplyOrchestrator.modelSettings.reasoning?.effort).toBe("medium");
  });

  it("validates OPENAI_REASONING_EFFORT values", () => {
    expect(() =>
      parseAppConfig({
        NODE_ENV: "test",
        PORT: "3100",
        SQLITE_PATH: ":memory:",
        OPENAI_REASONING_EFFORT: "ultra" as never
      })
    ).toThrow();
  });

  it("uses gpt-5.4 with fixed low reasoning for the visualizer agent", () => {
    const config = parseAppConfig({
      NODE_ENV: "test",
      PORT: "3100",
      SQLITE_PATH: ":memory:",
      OPENAI_API_KEY: "test-key",
      OPENAI_REASONING_EFFORT: "xhigh"
    });

    const visualizer = createVisualizationAgent(config);

    expect(visualizer.model).toBe("gpt-5.4");
    expect(visualizer.modelSettings.reasoning?.effort).toBe("low");
  });
});
