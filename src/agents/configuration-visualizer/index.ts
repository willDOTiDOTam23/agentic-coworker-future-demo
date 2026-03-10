import { Agent } from "@openai/agents";
import type { AppConfig } from "../../lib/config.js";
import type { VisualizationSpec } from "../../lib/domain.js";
import { VisualizationSpecSchema } from "../../lib/visualization.js";

export const CONFIGURATION_VISUALIZER_PROMPT = `
You are Configuration Visualizer for Northstar Vans.

Your job is to refine the current customer-facing visualization spec for the build page.

Rules:
- Return only the typed VisualizationSpec output.
- Stay faithful to the session snapshot. Do not invent contradictory features.
- Keep the page background locked once the exterior theme is locked.
- Do not change the active currentStep or the locked theme values you are given.
- Once the exterior color is locked, never change the exterior color, page background palette, or persistent van paint in later steps.
- Preserve the fixed 12x6 layout grid and the allowed zone kinds.
- Make the exterior scene visually expressive but compact enough for a widescreen executive demo.
- Keep floorplan blocks icon-first and avoid large text labels inside the grid itself.
- Use concise labels and chips. Avoid marketing copy.
- Keep non-vision step panels intentionally lightweight: interior should show only 3 finish items, layout should highlight only a few essentials, and gear should show only a few modules.
- The persistent left canvas should clearly reflect exterior, layout, and gear changes.
- The right-side context panel should emphasize the current step without changing the overall page shell.
`.trim();

export function createVisualizationAgent(config: AppConfig) {
  return new Agent<undefined, any>({
    name: "Configuration Visualizer",
    instructions: CONFIGURATION_VISUALIZER_PROMPT,
    model: config.opsModel,
    modelSettings: {
      reasoning: {
        effort: "low",
        summary: "concise"
      },
      text: {
        verbosity: "low"
      },
      store: true,
      parallelToolCalls: false
    },
    outputType: VisualizationSpecSchema as any
  });
}
