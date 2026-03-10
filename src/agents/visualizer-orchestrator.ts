import { run } from "@openai/agents";
import type { AppConfig } from "../lib/config.js";
import type { VisualizationSpec } from "../lib/domain.js";
import type { SqliteRepository } from "../lib/repository.js";
import type { SseBroker } from "../lib/sse.js";
import { sanitizeVisualizationSpecInput, VisualizationSpecSchema, withVisualizationMetadata } from "../lib/visualization.js";
import { createVisualizationAgent } from "./configuration-visualizer/index.js";

interface QueueState {
  active: boolean;
  revision: number;
  latestReason: string;
  rerunRequested: boolean;
  timer?: NodeJS.Timeout;
}

export interface VisualizationOrchestrator {
  queueRun(sessionId: string, reason: string): void;
}

function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

class OpenAiVisualizationOrchestrator implements VisualizationOrchestrator {
  private readonly queue = new Map<string, QueueState>();

  constructor(
    private readonly config: AppConfig,
    private readonly repo: SqliteRepository,
    private readonly sse: SseBroker
  ) {}

  queueRun(sessionId: string, reason: string) {
    if (!this.config.hasOpenAiKey) {
      return;
    }

    const current = this.queue.get(sessionId) ?? {
      active: false,
      revision: 0,
      latestReason: reason,
      rerunRequested: false
    };

    current.latestReason = reason;
    current.revision += 1;

    if (current.timer) {
      clearTimeout(current.timer);
    }

    current.timer = setTimeout(() => {
      void this.execute(sessionId, current.revision);
    }, 525);

    this.queue.set(sessionId, current);
  }

  private async execute(sessionId: string, revision: number) {
    const state = this.queue.get(sessionId);
    if (!state) return;
    if (state.active) {
      state.rerunRequested = true;
      return;
    }

    const detail = this.repo.getConfigurationDetail(sessionId);
    if (!detail) {
      return;
    }

    state.active = true;
    state.rerunRequested = false;
    const runId = `${sessionId}-visual-${Date.now()}`;

    try {
      const result = await run(
        createVisualizationAgent(this.config),
        [
          "Refine the visualization spec for the customer configurator.",
          `Trigger: ${state.latestReason}.`,
          `Current session snapshot:\n${compactJson({
            session: detail.session,
            turns: detail.turns.slice(0, 6)
          })}`,
          `Current visualization spec:\n${compactJson(detail.visualSpec)}`
        ].join("\n\n"),
        {
          stream: false,
          maxTurns: 6
        }
      );

      const parsed = VisualizationSpecSchema.parse(sanitizeVisualizationSpecInput(result.finalOutput));
      const refined = this.stabilizeSpec(detail.visualSpec, parsed);
      this.repo.saveVisualSpec(sessionId, refined);
      this.sse.broadcast({
        type: "visual_spec_updated",
        sessionId,
        agentName: "Configuration Visualizer",
        runId,
        status: "ready",
        detail: "Visualization refined",
        timestamp: new Date().toISOString(),
        metadata: {
          source: "agent",
          visualSpec: refined
        }
      });
    } catch (error) {
      this.sse.broadcast({
        type: "agent_failed",
        sessionId,
        agentName: "Configuration Visualizer",
        runId,
        status: "failed",
        detail: error instanceof Error ? error.message : "Visualization refinement failed",
        timestamp: new Date().toISOString()
      });
    } finally {
      state.active = false;
      if (state.revision !== revision || state.rerunRequested) {
        state.rerunRequested = false;
        this.queueRun(sessionId, "visual-refresh");
      }
    }
  }

  private stabilizeSpec(base: VisualizationSpec, candidate: VisualizationSpec) {
    return withVisualizationMetadata(
      VisualizationSpecSchema.parse({
        ...candidate,
        currentStep: base.currentStep,
        theme: base.theme,
        stepRail: base.stepRail,
        exteriorScene: base.exteriorScene,
        layoutFloorplan: {
          ...candidate.layoutFloorplan,
          driveSide: base.layoutFloorplan.driveSide,
          frontSeatConfig: base.layoutFloorplan.frontSeatConfig,
          legend: base.layoutFloorplan.legend
        },
        gearScene: {
          ...candidate.gearScene,
          attachmentStates: base.gearScene.attachmentStates
        }
      }),
      {
        generatedBy: "agent"
      }
    );
  }
}

export function createVisualizationOrchestrator(
  config: AppConfig,
  repo: SqliteRepository,
  sse: SseBroker
): VisualizationOrchestrator {
  return new OpenAiVisualizationOrchestrator(config, repo, sse);
}
