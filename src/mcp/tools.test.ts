import { describe, expect, it } from "vitest";
import { CONTROL_RESOURCE_URI, CONFIGURATE_RESOURCE_URI, getToolDescriptor, isRenderTool, toolsForScope } from "./tools.js";

describe("mcp tool descriptors", () => {
  it("marks render tools and links template URIs through _meta", () => {
    const configurate = getToolDescriptor("configurate.renderJourney");
    const control = getToolDescriptor("control.renderBoard");

    expect(configurate?.toolType).toBe("render");
    expect(control?.toolType).toBe("render");
    expect(configurate?._meta?.ui).toEqual({ resourceUri: CONFIGURATE_RESOURCE_URI });
    expect(control?._meta?.ui).toEqual({ resourceUri: CONTROL_RESOURCE_URI });
    expect(configurate?._meta?.["openai/outputTemplate"]).toBe(CONFIGURATE_RESOURCE_URI);
    expect(control?._meta?.["openai/outputTemplate"]).toBe(CONTROL_RESOURCE_URI);
  });

  it("adds template metadata to first-turn data tools for automatic card rendering", () => {
    const startSession = getToolDescriptor("customer.startSession");
    const advanceSession = getToolDescriptor("customer.advanceSession");
    const opsBoard = getToolDescriptor("ops.getOpsBoard");

    expect(startSession?.toolType).toBe("data");
    expect(advanceSession?.toolType).toBe("data");
    expect(opsBoard?.toolType).toBe("data");
    expect(startSession?._meta?.["openai/outputTemplate"]).toBe(CONFIGURATE_RESOURCE_URI);
    expect(advanceSession?._meta?.["openai/outputTemplate"]).toBe(CONFIGURATE_RESOURCE_URI);
    expect(opsBoard?._meta?.["openai/outputTemplate"]).toBe(CONTROL_RESOURCE_URI);
  });

  it("keeps render tool availability scoped to each app", () => {
    const part1Tools = new Set(toolsForScope("part-1").map((tool) => tool.name));
    const part2Tools = new Set(toolsForScope("part-2").map((tool) => tool.name));

    expect(part1Tools.has("configurate.renderJourney")).toBe(true);
    expect(part1Tools.has("control.renderBoard")).toBe(false);
    expect(part2Tools.has("control.renderBoard")).toBe(true);
    expect(part2Tools.has("configurate.renderJourney")).toBe(false);
  });

  it("keeps data tools separate from render tools", () => {
    expect(isRenderTool("customer.startSession")).toBe(false);
    expect(isRenderTool("ops.getOpsBoard")).toBe(false);
    expect(isRenderTool("configurate.renderJourney")).toBe(true);
    expect(isRenderTool("control.renderBoard")).toBe(true);
  });
});
