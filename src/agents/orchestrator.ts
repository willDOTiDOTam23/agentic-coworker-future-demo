import { Agent, handoff, run, tool } from "@openai/agents";
import { promptWithHandoffInstructions } from "@openai/agents-core/extensions";
import { z } from "zod";
import type { AppConfig } from "../lib/config.js";
import { renderDesignBriefHtml, renderSupplyOrderHtml } from "../lib/artifacts.js";
import type { ArtifactRecord, ConfigurationDetail } from "../lib/domain.js";
import { buildFallbackDesignBrief, buildFallbackSupplyOrder } from "../lib/ops-fallbacks.js";
import type { PublishStatusEventInput } from "../lib/schemas.js";
import { DesignBriefSchema, MonitorOutputSchema, PublishStatusEventSchema, SupplyOrderSchema } from "../lib/schemas.js";
import type { SseBroker, SseEventPayload } from "../lib/sse.js";
import type { SqliteRepository } from "../lib/repository.js";
import { DESIGN_PLANNER_PROMPT } from "./design-planner/index.js";
import { SESSION_MONITOR_PROMPT } from "./session-monitor/index.js";
import { SUPPLY_ORCHESTRATOR_PROMPT } from "./supply-orchestrator/index.js";

interface QueueState {
  active: boolean;
  revision: number;
  latestReason: string;
  rerunRequested: boolean;
  timer?: NodeJS.Timeout;
}

interface RuntimeFlags {
  monitorConfidence?: number;
  designBriefPersisted?: boolean;
  supplyOrderPersisted?: boolean;
  lastMonitorStatus?: PublishStatusEventInput;
}

export interface OpsRunContextValue {
  config: AppConfig;
  repo: SqliteRepository;
  sse: SseBroker;
  sessionId: string;
  runId: string;
  trigger: string;
  snapshot: ConfigurationDetail;
  artifacts: ArtifactRecord[];
  runtime: RuntimeFlags;
}

export interface OpsOrchestrator {
  queueRun(sessionId: string, reason: string): void;
}

function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildEvent(payload: Omit<SseEventPayload, "timestamp">): SseEventPayload {
  return {
    ...payload,
    timestamp: new Date().toISOString()
  };
}

function emit(
  repo: SqliteRepository,
  sse: SseBroker,
  payload: Omit<SseEventPayload, "timestamp">
) {
  const event = buildEvent(payload);
  repo.addAgentEvent({
    sessionId: event.sessionId,
    agentName: event.agentName,
    eventType: event.type,
    status: event.status ?? "info",
    displayText: event.detail ?? event.type,
    details: event.metadata
  });
  sse.broadcast(event);
}

function hasStepValues(values: Record<string, unknown> | undefined) {
  return Boolean(values && Object.keys(values).length > 0);
}

function isReadyForDesignPlanning(snapshot: ConfigurationDetail) {
  const { session } = snapshot;
  return (
    session.status === "submitted" &&
    hasStepValues(session.state.vision) &&
    hasStepValues(session.state.exterior) &&
    hasStepValues(session.state.interior) &&
    hasStepValues(session.state.layout)
  );
}

function getArtifactReasoningEffort(config: AppConfig) {
  switch (config.reasoningEffort) {
    case "xhigh":
      return "medium" as const;
    case "high":
      return "low" as const;
    default:
      return config.reasoningEffort;
  }
}

function buildTools() {
  const EmptyParameters = z.object({});
  const isMonitorBeforeStatus = ({ runContext, agent }: { runContext: { context: OpsRunContextValue }; agent: { name: string } }) =>
    agent.name === "Session Monitor" && !runContext.context.runtime.lastMonitorStatus;
  const isDesignPlannerBeforePersist = ({ runContext, agent }: { runContext: { context: OpsRunContextValue }; agent: { name: string } }) =>
    agent.name === "Design Planner" && !runContext.context.runtime.designBriefPersisted;
  const isSupplyOrchestratorBeforePersist = ({
    runContext,
    agent
  }: {
    runContext: { context: OpsRunContextValue };
    agent: { name: string };
  }) => agent.name === "Supply Orchestrator" && !runContext.context.runtime.supplyOrderPersisted;

  const loadSessionContext = tool<typeof EmptyParameters, OpsRunContextValue>({
    name: "load_session_context",
    description: "Load the current configuration session snapshot, latest turns, and theme state.",
    parameters: EmptyParameters,
    isEnabled: (args) =>
      isMonitorBeforeStatus(args as any) ||
      isDesignPlannerBeforePersist(args as any) ||
      isSupplyOrchestratorBeforePersist(args as any),
    execute: async (_input, runContext) => {
      return runContext?.context.snapshot ?? null;
    }
  });

  const listArtifacts = tool<typeof EmptyParameters, OpsRunContextValue>({
    name: "list_artifacts",
    description: "List the artifacts already generated for the active session.",
    parameters: EmptyParameters,
    isEnabled: (args) =>
      isMonitorBeforeStatus(args as any) ||
      isDesignPlannerBeforePersist(args as any) ||
      isSupplyOrchestratorBeforePersist(args as any),
    execute: async (_input, runContext) => {
      const context = runContext?.context;
      if (!context) return [];
      return context.repo.listArtifacts(context.sessionId).map((artifact) => ({
        id: artifact.id,
        agentName: artifact.agentName,
        templateType: artifact.templateType,
        createdAt: artifact.createdAt
      }));
    }
  });

  const publishStatusEvent = tool<typeof PublishStatusEventSchema, OpsRunContextValue>({
    name: "publish_status_event",
    description:
      "Persist and broadcast a concise operational status update with optional confidence and next action.",
    parameters: PublishStatusEventSchema,
    isEnabled: ({ runContext, agent }) =>
      agent.name === "Session Monitor" && !runContext.context.runtime.lastMonitorStatus,
    execute: async (input, runContext) => {
      const context = runContext?.context;
      if (!context) return { ok: false };
      const designReady = isReadyForDesignPlanning(context.snapshot);
      const effectiveConfidenceScore =
        typeof input.confidenceScore === "number"
          ? Math.max(input.confidenceScore, designReady ? 0.85 : 0)
          : designReady
            ? 0.85
            : null;
      const effectiveStatus = designReady && input.status !== "ready" ? "ready" : input.status;
      const effectiveMessage =
        designReady && input.status !== "ready"
          ? "Configuration is complete enough to kick off planning artifacts automatically."
          : input.message;
      const effectiveNextAction = designReady ? "Design Planner is starting now." : input.nextAction ?? null;

      if (typeof effectiveConfidenceScore === "number") {
        context.runtime.monitorConfidence = effectiveConfidenceScore;
        context.repo.updateLatestConfidence(context.sessionId, effectiveConfidenceScore);
      }

      if (input.agentName === "Session Monitor") {
        context.runtime.lastMonitorStatus = {
          ...input,
          status: effectiveStatus,
          message: effectiveMessage,
          confidenceScore: effectiveConfidenceScore,
          nextAction: effectiveNextAction
        };
      }

      emit(context.repo, context.sse, {
        type: "agent_status",
        sessionId: context.sessionId,
        agentName: input.agentName,
        runId: context.runId,
        status: effectiveStatus,
        detail: effectiveMessage,
        metadata: {
          confidenceScore: effectiveConfidenceScore,
          riskFlags: input.riskFlags ?? [],
          nextAction: effectiveNextAction
        }
      });

      return { ok: true };
    }
  });

  const persistDesignBrief = tool<typeof DesignBriefSchema, OpsRunContextValue>({
    name: "persist_design_brief",
    description: "Render and persist the Design Brief artifact for the active session.",
    parameters: DesignBriefSchema,
    isEnabled: ({ runContext, agent }) =>
      agent.name === "Design Planner" && !runContext.context.runtime.designBriefPersisted,
    execute: async (input, runContext) => {
      const context = runContext?.context;
      if (!context) return { ok: false };

      const artifact = context.repo.createArtifact({
        sessionId: context.sessionId,
        agentName: "Design Planner",
        templateType: "design-brief",
        renderedContent: renderDesignBriefHtml(input)
      });
      context.runtime.designBriefPersisted = true;

      emit(context.repo, context.sse, {
        type: "artifact_ready",
        sessionId: context.sessionId,
        agentName: "Design Planner",
        runId: context.runId,
        status: "ready",
        detail: "Design Brief generated",
        metadata: {
          artifactId: artifact.id,
          templateType: artifact.templateType,
          artifact
        }
      });

      return {
        artifactId: artifact.id,
        templateType: artifact.templateType,
        createdAt: artifact.createdAt,
        brief: input
      };
    }
  });

  const persistSupplyOrder = tool<typeof SupplyOrderSchema, OpsRunContextValue>({
    name: "persist_supply_order",
    description: "Render and persist the Supply Order artifact for the active session.",
    parameters: SupplyOrderSchema,
    isEnabled: ({ runContext, agent }) =>
      agent.name === "Supply Orchestrator" && !runContext.context.runtime.supplyOrderPersisted,
    execute: async (input, runContext) => {
      const context = runContext?.context;
      if (!context) return { ok: false };

      const artifact = context.repo.createArtifact({
        sessionId: context.sessionId,
        agentName: "Supply Orchestrator",
        templateType: "supply-order",
        renderedContent: renderSupplyOrderHtml(input)
      });
      context.runtime.supplyOrderPersisted = true;

      emit(context.repo, context.sse, {
        type: "artifact_ready",
        sessionId: context.sessionId,
        agentName: "Supply Orchestrator",
        runId: context.runId,
        status: "ready",
        detail: "Supply Order generated",
        metadata: {
          artifactId: artifact.id,
          templateType: artifact.templateType,
          artifact
        }
      });

      return {
        artifactId: artifact.id,
        templateType: artifact.templateType,
        createdAt: artifact.createdAt,
        order: input
      };
    }
  });

  return {
    loadSessionContext,
    listArtifacts,
    publishStatusEvent,
    persistDesignBrief,
    persistSupplyOrder
  };
}

export function createAgentGraph(config: AppConfig) {
  const tools = buildTools();
  const artifactReasoningEffort = getArtifactReasoningEffort(config);

  const supplyOrchestrator = new Agent<OpsRunContextValue, any>({
    name: "Supply Orchestrator",
    handoffDescription: "Creates the sourcing and sequencing artifact after design planning is complete.",
    instructions: SUPPLY_ORCHESTRATOR_PROMPT,
    model: config.opsModel,
    modelSettings: {
      toolChoice: "auto",
      reasoning: {
        effort: artifactReasoningEffort,
        summary: "concise"
      },
      text: {
        verbosity: "low"
      },
      store: true,
      parallelToolCalls: false
    },
    tools: [tools.loadSessionContext, tools.listArtifacts, tools.persistSupplyOrder, tools.publishStatusEvent],
    toolUseBehavior: (_runContext, toolResults) => {
      const persistedOrder = toolResults.find(
        (toolResult) => toolResult.type === "function_output" && toolResult.tool.name === "persist_supply_order"
      );

      if (persistedOrder?.type !== "function_output") {
        return {
          isFinalOutput: false,
          isInterrupted: undefined
        };
      }

      const output = persistedOrder.output as { order?: unknown };
      return {
        isFinalOutput: true,
        isInterrupted: undefined,
        finalOutput: compactJson(output.order ?? {})
      };
    }
  });

  const designPlanner = new Agent<OpsRunContextValue, any>({
    name: "Design Planner",
    handoffDescription: "Turns a mature session into a structured Design Brief and then hands off to supply planning.",
    instructions: promptWithHandoffInstructions(DESIGN_PLANNER_PROMPT),
    model: config.opsModel,
    modelSettings: {
      toolChoice: "auto",
      reasoning: {
        effort: artifactReasoningEffort,
        summary: "concise"
      },
      text: {
        verbosity: "low"
      },
      store: true,
      parallelToolCalls: false
    },
    tools: [tools.loadSessionContext, tools.listArtifacts, tools.persistDesignBrief, tools.publishStatusEvent],
    toolUseBehavior: () => ({
      isFinalOutput: false,
      isInterrupted: undefined
    }),
    handoffs: [
      handoff(supplyOrchestrator, {
        isEnabled: ({ runContext }) =>
          Boolean((runContext as { context: OpsRunContextValue }).context.runtime.designBriefPersisted)
      })
    ],
    handoffOutputTypeWarningEnabled: false
  });

  const sessionMonitor = new Agent<OpsRunContextValue, any>({
    name: "Session Monitor",
    handoffDescription: "Assesses customer-session maturity and decides when it is safe to start planning artifacts.",
    instructions: promptWithHandoffInstructions(SESSION_MONITOR_PROMPT),
    model: config.opsModel,
    modelSettings: {
      toolChoice: "publish_status_event",
      reasoning: {
        effort: config.reasoningEffort,
        summary: "concise"
      },
      text: {
        verbosity: "low"
      },
      store: true,
      parallelToolCalls: false
    },
    tools: [tools.loadSessionContext, tools.listArtifacts, tools.publishStatusEvent],
    toolUseBehavior: (runContext, toolResults) => {
      const context = (runContext as { context: OpsRunContextValue }).context;
      const publishedStatus = toolResults.some(
        (toolResult) => toolResult.type === "function_output" && toolResult.tool.name === "publish_status_event"
      );

      if (!publishedStatus) {
        return {
          isFinalOutput: false,
          isInterrupted: undefined
        };
      }

      if ((context.runtime.monitorConfidence ?? 0) >= 0.8 || isReadyForDesignPlanning(context.snapshot)) {
        return {
          isFinalOutput: false,
          isInterrupted: undefined
        };
      }

      const status = context.runtime.lastMonitorStatus;
      const output = status ? {
        status_summary: status.message,
        confidence_score: status.confidenceScore ?? 0,
        risk_flags: status.riskFlags ?? [],
        next_action: status.nextAction ?? "Continue gathering configuration detail.",
        handoff_decision: "hold"
      } : {
        status_summary: "Monitor completed without a status payload.",
        confidence_score: 0,
        risk_flags: [],
        next_action: "Continue gathering configuration detail.",
        handoff_decision: "hold"
      };

      return {
        isFinalOutput: true,
        isInterrupted: undefined,
        finalOutput: compactJson(output)
      };
    },
    handoffs: [
      handoff(designPlanner, {
        isEnabled: ({ runContext }) =>
          ((runContext as { context: OpsRunContextValue }).context.runtime.monitorConfidence ?? 0) >= 0.8 ||
          isReadyForDesignPlanning((runContext as { context: OpsRunContextValue }).context.snapshot)
      })
    ],
    handoffOutputTypeWarningEnabled: false,
    outputType: MonitorOutputSchema as any
  });

  return sessionMonitor;
}

function extractDetail(item: unknown): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  const raw = (item as { rawItem?: { name?: string; type?: string; callId?: string; call_id?: string } }).rawItem;
  if (!raw) return undefined;
  return raw.name ?? raw.type ?? raw.callId ?? raw.call_id;
}

class OpenAiOpsOrchestrator implements OpsOrchestrator {
  private readonly queue = new Map<string, QueueState>();
  private readonly entryAgent;

  constructor(
    private readonly config: AppConfig,
    private readonly repo: SqliteRepository,
    private readonly sse: SseBroker
  ) {
    this.entryAgent = createAgentGraph(config);
  }

  queueRun(sessionId: string, reason: string) {
    if (!this.config.hasOpenAiKey) {
      emit(this.repo, this.sse, {
        type: "agent_failed",
        sessionId,
        agentName: "Session Monitor",
        runId: `missing-key-${sessionId}`,
        status: "blocked",
        detail: "OPENAI_API_KEY is missing. Ops agents are offline."
      });
      return;
    }

    const existing = this.queue.get(sessionId) ?? {
      active: false,
      revision: 0,
      latestReason: reason,
      rerunRequested: false
    };

    existing.revision += 1;
    existing.latestReason = reason;
    existing.rerunRequested = existing.active || existing.rerunRequested;
    if (existing.timer) {
      clearTimeout(existing.timer);
    }

    existing.timer = setTimeout(() => {
      void this.executeQueuedRun(sessionId, existing.revision);
    }, 450);

    this.queue.set(sessionId, existing);
  }

  private hasArtifact(sessionId: string, templateType: ArtifactRecord["templateType"]) {
    return this.repo.listArtifacts(sessionId).some((artifact) => artifact.templateType === templateType);
  }

  private emitFallbackArtifacts(context: OpsRunContextValue) {
    const latestDetail = this.repo.getConfigurationDetail(context.sessionId);
    if (!latestDetail || !isReadyForDesignPlanning(latestDetail)) {
      return;
    }

    if (!this.hasArtifact(context.sessionId, "design-brief")) {
      emit(this.repo, this.sse, {
        type: "agent_started",
        sessionId: context.sessionId,
        agentName: "Design Planner",
        runId: context.runId,
        status: "running",
        detail: "Design Planner is drafting the first artifact revision."
      });

      const brief = buildFallbackDesignBrief(latestDetail);
      const artifact = this.repo.createArtifact({
        sessionId: context.sessionId,
        agentName: "Design Planner",
        templateType: "design-brief",
        renderedContent: renderDesignBriefHtml(brief)
      });
      context.runtime.designBriefPersisted = true;

      emit(this.repo, this.sse, {
        type: "artifact_ready",
        sessionId: context.sessionId,
        agentName: "Design Planner",
        runId: context.runId,
        status: "ready",
        detail: "Design Brief generated",
        metadata: {
          artifactId: artifact.id,
          templateType: artifact.templateType,
          artifact
        }
      });
      emit(this.repo, this.sse, {
        type: "agent_completed",
        sessionId: context.sessionId,
        agentName: "Design Planner",
        runId: context.runId,
        status: "completed",
        detail: "Design Planner completed the initial artifact revision."
      });
    }

    if (latestDetail.session.status !== "submitted" || this.hasArtifact(context.sessionId, "supply-order")) {
      return;
    }

    emit(this.repo, this.sse, {
      type: "agent_started",
      sessionId: context.sessionId,
      agentName: "Supply Orchestrator",
      runId: context.runId,
      status: "running",
      detail: "Supply Orchestrator is drafting the first sourcing plan."
    });

    const order = buildFallbackSupplyOrder(latestDetail);
    const artifact = this.repo.createArtifact({
      sessionId: context.sessionId,
      agentName: "Supply Orchestrator",
      templateType: "supply-order",
      renderedContent: renderSupplyOrderHtml(order)
    });
    context.runtime.supplyOrderPersisted = true;

    emit(this.repo, this.sse, {
      type: "artifact_ready",
      sessionId: context.sessionId,
      agentName: "Supply Orchestrator",
      runId: context.runId,
      status: "ready",
      detail: "Supply Order generated",
      metadata: {
        artifactId: artifact.id,
        templateType: artifact.templateType,
        artifact
      }
    });
    emit(this.repo, this.sse, {
      type: "agent_completed",
      sessionId: context.sessionId,
      agentName: "Supply Orchestrator",
      runId: context.runId,
      status: "completed",
      detail: "Supply Orchestrator completed the initial sourcing revision."
    });
  }

  private async executeQueuedRun(sessionId: string, revision: number) {
    const state = this.queue.get(sessionId);
    if (!state) return;
    if (state.active) {
      state.rerunRequested = true;
      return;
    }

    const detail = this.repo.getConfigurationDetail(sessionId);
    if (!detail) return;

    state.active = true;
    state.rerunRequested = false;
    const runId = `${sessionId}-${Date.now()}`;

    const context: OpsRunContextValue = {
      config: this.config,
      repo: this.repo,
      sse: this.sse,
      sessionId,
      runId,
      trigger: state.latestReason,
      snapshot: detail,
      artifacts: this.repo.listArtifacts(sessionId),
      runtime: {}
    };

    emit(this.repo, this.sse, {
      type: "agent_started",
      sessionId,
      agentName: "Session Monitor",
      runId,
      status: "running",
      detail: `Run triggered by ${state.latestReason}`
    });

    let currentAgentName = "Session Monitor";
    const fallbackTimer = isReadyForDesignPlanning(detail)
      ? setTimeout(() => {
          this.emitFallbackArtifacts(context);
        }, 12000)
      : null;

    try {
      const stream = await run(
        this.entryAgent,
        [
          "Review the Northstar Vans session and continue the ops workflow.",
          `Trigger: ${state.latestReason}.`,
          `Session snapshot:\n${compactJson({
            session: detail.session,
            turns: detail.turns.slice(0, 8),
            artifacts: context.artifacts.map((artifact) => ({
              id: artifact.id,
              agentName: artifact.agentName,
              templateType: artifact.templateType,
              createdAt: artifact.createdAt,
              renderedContent: artifact.renderedContent
            }))
          })}`
        ].join("\n\n"),
        {
          stream: true,
          context,
          maxTurns: 12
        }
      );

      for await (const event of stream) {
        if (event.type === "agent_updated_stream_event") {
          const nextAgentName = event.agent.name;
          if (nextAgentName !== currentAgentName) {
            emit(this.repo, this.sse, {
              type: "agent_handoff",
              sessionId,
              agentName: currentAgentName,
              runId,
              status: "handoff",
              detail: `${currentAgentName} handed off to ${nextAgentName}`
            });
            emit(this.repo, this.sse, {
              type: "agent_started",
              sessionId,
              agentName: nextAgentName,
              runId,
              status: "running",
              detail: `${nextAgentName} started`
            });
            currentAgentName = nextAgentName;
          }
        }

        if (event.type === "run_item_stream_event") {
          if (event.name === "tool_called") {
            emit(this.repo, this.sse, {
              type: "tool_started",
              sessionId,
              agentName: currentAgentName,
              runId,
              status: "running",
              detail: extractDetail(event.item.toJSON()) ?? "tool called"
            });
          }

          if (event.name === "tool_output") {
            emit(this.repo, this.sse, {
              type: "tool_completed",
              sessionId,
              agentName: currentAgentName,
              runId,
              status: "completed",
              detail: extractDetail(event.item.toJSON()) ?? "tool completed"
            });
          }
        }
      }

      await stream.completed;

      emit(this.repo, this.sse, {
        type: "agent_completed",
        sessionId,
        agentName: currentAgentName,
        runId,
        status: "completed",
        detail: stream.finalOutput ? compactJson(stream.finalOutput) : "Run completed"
      });
    } catch (error) {
      emit(this.repo, this.sse, {
        type: "agent_failed",
        sessionId,
        agentName: currentAgentName,
        runId,
        status: "failed",
        detail: error instanceof Error ? error.message : "Unknown agent failure"
      });
    } finally {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      state.active = false;
      if (state.revision !== revision || state.rerunRequested) {
        state.rerunRequested = false;
        this.queueRun(sessionId, "debounced-refresh");
      }
    }
  }
}

export function createOpsOrchestrator(
  config: AppConfig,
  repo: SqliteRepository,
  sse: SseBroker
): OpsOrchestrator {
  return new OpenAiOpsOrchestrator(config, repo, sse);
}
