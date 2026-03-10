import { DESIGN_PLANNER_PROMPT } from "./design-planner/index.js";
import { SESSION_MONITOR_PROMPT } from "./session-monitor/index.js";
import { SUPPLY_ORCHESTRATOR_PROMPT } from "./supply-orchestrator/index.js";

export const AGENT_DOCS_NOTICE =
  "Generated file. Edit the typed agent metadata and prompts in src/agents, then regenerate with `npm run agents:docs`.";

export const AGENT_SYSTEM_SPEC = {
  shared: {
    opsModel: "gpt-5.4",
    realtimeModel: "gpt-realtime",
    reasoningEnvVar: "OPENAI_REASONING_EFFORT",
    reasoningValues: ["none", "low", "medium", "high", "xhigh"],
    handoffThresholds: [
      "Session Monitor -> Design Planner when confidence_score >= 0.80",
      "Design Planner -> Supply Orchestrator after a Design Brief artifact is successfully persisted"
    ],
    sseEventTypes: [
      "agent_started",
      "agent_status",
      "agent_handoff",
      "tool_started",
      "tool_completed",
      "artifact_ready",
      "agent_completed",
      "agent_failed"
    ],
    sqliteTables: ["config_sessions", "conversation_turns", "agent_events", "artifacts"],
    sharedTools: [
      "load_session_context",
      "list_artifacts",
      "publish_status_event",
      "persist_design_brief",
      "persist_supply_order"
    ]
  },
  agents: [
    {
      id: "session-monitor",
      name: "Session Monitor",
      folder: "src/agents/session-monitor",
      mission:
        "Assess session maturity, confidence, blockers, and whether the workflow should advance to design planning.",
      systemPromptSummary:
        "Calls load_session_context first, publishes a concise operational status, and only hands off when confidence is at least 0.80.",
      systemPrompt: SESSION_MONITOR_PROMPT,
      tools: ["load_session_context", "list_artifacts", "publish_status_event"],
      inputContract: [
        "session snapshot from config_sessions",
        "recent conversation turns from conversation_turns",
        "artifact summaries from artifacts"
      ],
      outputContract: [
        "status_summary",
        "confidence_score",
        "risk_flags",
        "next_action",
        "handoff_decision"
      ],
      handoffs: ["Design Planner when confidence_score >= 0.80"],
      artifactOutputs: [],
      failureBehavior:
        "Emit agent_failed over SSE and persist an agent_events row with the error summary.",
      exampleTriggers: [
        "Customer finishes a step save",
        "Customer submits the build",
        "Ops replay requests a refresh"
      ]
    },
    {
      id: "design-planner",
      name: "Design Planner",
      folder: "src/agents/design-planner",
      mission:
        "Generate the Design Brief artifact from structured customer requirements and explicit uncertainties.",
      systemPromptSummary:
        "Loads context, produces the typed Design Brief object, persists it, then hands off to Supply Orchestrator.",
      systemPrompt: DESIGN_PLANNER_PROMPT,
      tools: ["load_session_context", "list_artifacts", "persist_design_brief", "publish_status_event"],
      inputContract: [
        "session snapshot from config_sessions",
        "recent conversation turns from conversation_turns",
        "existing artifacts from artifacts"
      ],
      outputContract: [
        "Project Overview",
        "Use Case & Vision",
        "Exterior Spec",
        "Interior Spec",
        "Layout & Sleeping Config",
        "Gear & Accessories",
        "BOM Summary",
        "Build Notes"
      ],
      handoffs: ["Supply Orchestrator after persist_design_brief succeeds"],
      artifactOutputs: ["design-brief"],
      failureBehavior:
        "Emit agent_failed over SSE, persist an agent_events row, and avoid handing off downstream.",
      exampleTriggers: [
        "Session Monitor confidence crosses the 0.80 threshold",
        "A submitted build needs a refreshed brief"
      ]
    },
    {
      id: "supply-orchestrator",
      name: "Supply Orchestrator",
      folder: "src/agents/supply-orchestrator",
      mission:
        "Create a structured Supply Order draft that translates the approved configuration into sourcing-ready work.",
      systemPromptSummary:
        "Loads context and artifacts, produces the typed Supply Order, and persists it as a new artifact revision.",
      systemPrompt: SUPPLY_ORCHESTRATOR_PROMPT,
      tools: ["load_session_context", "list_artifacts", "persist_supply_order", "publish_status_event"],
      inputContract: [
        "session snapshot from config_sessions",
        "recent conversation turns from conversation_turns",
        "latest Design Brief artifact from artifacts"
      ],
      outputContract: ["Order Summary", "Component Line Items", "Sequencing Notes", "Open Questions"],
      handoffs: [],
      artifactOutputs: ["supply-order"],
      failureBehavior:
        "Emit agent_failed over SSE, persist an agent_events row, and keep the last successful artifact revision available.",
      exampleTriggers: [
        "Design Planner persists a fresh Design Brief",
        "A submitted configuration requires a supply order refresh"
      ]
    }
  ]
} as const;

export type AgentSpec = (typeof AGENT_SYSTEM_SPEC.agents)[number];

