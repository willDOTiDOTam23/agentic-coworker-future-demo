import {
  advanceGuidedSession,
  applyFix,
  getCatalog,
  getIssuesBySession,
  getKpis,
  getOpsBoard,
  getSession,
  issueList,
  refreshGuidedSession,
  seedDeterministicIssueScenario,
  setSelectedOption,
  startGuidedSession,
  submitSession
} from "../data/store.js";
import { z } from "zod";

const JourneyStartSchema = z.object({
  customerName: z.string().min(1).optional(),
  budget: z.number().positive().optional(),
  budgetBand: z.enum(["value", "balanced", "premium", "luxury"]).optional(),
  occupancy: z.number().int().positive().optional(),
  terrain: z.enum(["mountain", "beach", "forest", "winter", "city", "water"]).optional(),
  region: z.enum(["NW", "CA", "CO", "FL"]).optional(),
  tripStyle: z.string().optional(),
  moods: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  startFromScratch: z.boolean().optional()
});

const JourneyAdvanceSchema = z.object({
  sessionId: z.string(),
  action: z
    .enum([
      "start_over",
      "optimize_family",
      "optimize_safety",
      "optimize_budget",
      "safe_baseline",
      "show_options",
      "skip_to_submit",
      "use_default_preferences",
      "submit"
    ])
    .optional(),
  customerName: z.string().min(1).optional(),
  budget: z.number().positive().optional(),
  budgetBand: z.enum(["value", "balanced", "premium", "luxury"]).optional(),
  occupancy: z.number().int().positive().optional(),
  terrain: z.enum(["mountain", "beach", "forest", "winter", "city", "water"]).optional(),
  region: z.enum(["NW", "CA", "CO", "FL"]).optional(),
  tripStyle: z.string().optional(),
  moods: z.array(z.string()).optional(),
  optionId: z.string().optional(),
  optionIds: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  startFromScratch: z.boolean().optional(),
  exterior: z
    .object({
      paintColor: z.string().optional(),
      roofRack: z.string().optional(),
      wheels: z.string().optional(),
      lights: z.string().optional()
    })
    .optional(),
  interior: z
    .object({
      level: z.string().optional(),
      lifestyleMode: z.string().optional()
    })
    .optional(),
  power: z
    .object({
      drivetrain: z.string().optional()
    })
    .optional(),
  accessories: z.array(z.string()).optional(),
  lifestyleMode: z.string().optional(),
  nextStep: z.number().int().min(1).max(5).optional()
});

const SessionActionSchema = z.object({
  sessionId: z.string(),
  optionId: z.string().optional()
});

const OpsBoardSchema = z.object({
  sessionId: z.string().optional()
});

const EmptySchema = {
  type: "object",
  additionalProperties: true
} as const;

const JourneyStartSchemaJson = {
  ...EmptySchema,
  properties: {
    customerName: { type: "string", minLength: 1 },
    budget: { type: "number", exclusiveMinimum: 0 },
    budgetBand: { type: "string", enum: ["value", "balanced", "premium", "luxury"] },
    occupancy: { type: "integer", minimum: 1 },
    terrain: { type: "string", enum: ["mountain", "beach", "forest", "winter", "city", "water"] },
    region: { type: "string", enum: ["NW", "CA", "CO", "FL"] },
    tripStyle: { type: "string" },
    moods: { type: "array", items: { type: "string" } },
    templateId: { type: "string" },
    startFromScratch: { type: "boolean" }
  },
  required: []
} as const;

const JourneyAdvanceSchemaJson = {
  ...EmptySchema,
  properties: {
    sessionId: { type: "string" },
    action: {
      type: "string",
      enum: [
        "start_over",
        "optimize_family",
        "optimize_safety",
        "optimize_budget",
        "safe_baseline",
        "show_options",
        "skip_to_submit",
        "use_default_preferences",
        "submit"
      ]
    },
    customerName: { type: "string", minLength: 1 },
    budget: { type: "number", exclusiveMinimum: 0 },
    budgetBand: { type: "string", enum: ["value", "balanced", "premium", "luxury"] },
    occupancy: { type: "integer", minimum: 1 },
    terrain: { type: "string", enum: ["mountain", "beach", "forest", "winter", "city", "water"] },
    region: { type: "string", enum: ["NW", "CA", "CO", "FL"] },
    tripStyle: { type: "string" },
    moods: { type: "array", items: { type: "string" } },
    optionId: { type: "string" },
    optionIds: { type: "array", items: { type: "string" } },
    templateId: { type: "string" },
    startFromScratch: { type: "boolean" },
    exterior: {
      type: "object",
      properties: {
        paintColor: { type: "string" },
        roofRack: { type: "string" },
        wheels: { type: "string" },
        lights: { type: "string" }
      }
    },
    interior: {
      type: "object",
      properties: {
        level: { type: "string" },
        lifestyleMode: { type: "string" }
      }
    },
    power: {
      type: "object",
      properties: {
        drivetrain: { type: "string" }
      }
    },
    accessories: { type: "array", items: { type: "string" } },
    lifestyleMode: { type: "string" },
    nextStep: { type: "number", minimum: 1, maximum: 5 }
  },
  required: ["sessionId"]
} as const;

const SessionActionSchemaJson = {
  ...EmptySchema,
  properties: {
    sessionId: { type: "string" },
    optionId: { type: "string" }
  },
  required: ["sessionId"]
} as const;

const OpsBoardSchemaJson = {
  ...EmptySchema,
  properties: {
    sessionId: { type: "string" }
  }
} as const;

const FixIssueSchemaJson = {
  ...EmptySchema,
  properties: {
    issueId: { type: "string" }
  },
  required: ["issueId"]
} as const;

const RenderJourneySchemaJson = {
  ...EmptySchema,
  properties: {
    sessionId: { type: "string" }
  },
  required: ["sessionId"]
} as const;

const RenderBoardSchemaJson = {
  ...EmptySchema,
  properties: {
    sessionId: { type: "string" }
  }
} as const;

const SeedIssueSchema = z.object({
  customerName: z.string().min(1).optional()
});

const SeedIssueSchemaJson = {
  ...EmptySchema,
  properties: {
    customerName: { type: "string", minLength: 1 }
  },
  required: []
} as const;

export type McpToolKind = "data" | "render";

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: unknown;
  toolType: McpToolKind;
  _meta?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export const CONFIGURATE_RESOURCE_URI = "ui://configurate/session-card-v6.html";
export const CONTROL_RESOURCE_URI = "ui://control/priority-board-v3.html";

const CONFIGURATE_WIDGET_META = {
  ui: {
    resourceUri: CONFIGURATE_RESOURCE_URI
  },
  "openai/outputTemplate": CONFIGURATE_RESOURCE_URI
} as const;

const CONTROL_WIDGET_META = {
  ui: {
    resourceUri: CONTROL_RESOURCE_URI
  },
  "openai/outputTemplate": CONTROL_RESOURCE_URI
} as const;

export const mcpTools: McpToolDescriptor[] = [
  {
    name: "catalog.getCatalog",
    description: "Get Configurate catalog, visual selections, and available option modules.",
    inputSchema: EmptySchema,
    toolType: "data",
    _meta: CONFIGURATE_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "customer.getVanTemplates",
    description: "Get Configurate starter templates for onboarding.",
    inputSchema: EmptySchema,
    toolType: "data",
    _meta: CONFIGURATE_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "customer.startSession",
    description: "Start or resume the guided customer configuration flow.",
    inputSchema: JourneyStartSchemaJson,
    toolType: "data",
    _meta: CONFIGURATE_WIDGET_META,
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: "customer.advanceSession",
    description: "Advance one step in the guided Configurate flow.",
    inputSchema: JourneyAdvanceSchemaJson,
    toolType: "data",
    _meta: CONFIGURATE_WIDGET_META,
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: "customer.refreshSession",
    description: "Refresh guided session state for deterministic UI state recovery.",
    inputSchema: SessionActionSchemaJson,
    toolType: "data",
    _meta: CONFIGURATE_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "customer.updateOptions",
    description: "Add or remove one option from a customer session.",
    inputSchema: SessionActionSchemaJson,
    toolType: "data",
    _meta: CONFIGURATE_WIDGET_META,
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: "customer.submitSession",
    description: "Submit a customer session and run compatibility and budget checks.",
    inputSchema: SessionActionSchemaJson,
    toolType: "data",
    _meta: CONFIGURATE_WIDGET_META,
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: "configurate.renderJourney",
    description: "Render-ready Configurate journey payload bound to the Configurate UI template resource.",
    inputSchema: RenderJourneySchemaJson,
    toolType: "render",
    _meta: CONFIGURATE_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "ops.getKpis",
    description: "Get Control operational KPIs.",
    inputSchema: EmptySchema,
    toolType: "data",
    _meta: CONTROL_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "ops.getSessionIssues",
    description: "List issues for a specific session.",
    inputSchema: {
      ...EmptySchema,
      properties: {
        sessionId: { type: "string" }
      },
      required: ["sessionId"]
    },
    toolType: "data",
    _meta: CONTROL_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "ops.getIssues",
    description: "List all open and closed issues.",
    inputSchema: EmptySchema,
    toolType: "data",
    _meta: CONTROL_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "ops.getOpsBoard",
    description: "Get the ranked Control operations board with immediate fix candidates.",
    inputSchema: OpsBoardSchemaJson,
    toolType: "data",
    _meta: CONTROL_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "ops.seedDeterministicIssue",
    description: "Create a deterministic blocked-session issue so the live demo can reliably transition into Customize.",
    inputSchema: SeedIssueSchemaJson,
    toolType: "data",
    _meta: CONTROL_WIDGET_META,
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: "control.renderBoard",
    description: "Render-ready Control board payload bound to the Control UI template resource.",
    inputSchema: RenderBoardSchemaJson,
    toolType: "render",
    _meta: CONTROL_WIDGET_META,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "dev.fixIssue",
    description: "Apply a Customize fix for a selected issue.",
    inputSchema: FixIssueSchemaJson,
    toolType: "data",
    _meta: CONTROL_WIDGET_META,
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
      openWorldHint: false
    }
  }
];

const customerToolNames = new Set<string>([
  "customer.startSession",
  "customer.advanceSession",
  "customer.refreshSession",
  "customer.updateOptions",
  "customer.submitSession",
  "configurate.renderJourney"
]);

const opsToolNames = new Set<string>([
  "ops.getKpis",
  "ops.getSessionIssues",
  "ops.getIssues",
  "ops.getOpsBoard",
  "ops.seedDeterministicIssue",
  "control.renderBoard",
  "dev.fixIssue"
]);

export const toolsets = {
  part1: customerToolNames,
  part2: opsToolNames,
  unified: new Set([...customerToolNames, ...opsToolNames, "catalog.getCatalog", "customer.getVanTemplates"])
};

export type McpPartScope = "part-1" | "part-2";

const toolDescriptorByName = new Map(mcpTools.map((tool) => [tool.name, tool]));

export function getToolDescriptor(name: string) {
  return toolDescriptorByName.get(name);
}

export function toolsForScope(scope?: McpPartScope) {
  const keys = scope ? (scope === "part-1" ? toolsets.part1 : toolsets.part2) : toolsets.unified;
  return mcpTools.filter((tool) => keys.has(tool.name));
}

export function isToolAllowed(scope: McpPartScope | undefined, name: string) {
  const keys = scope ? (scope === "part-1" ? toolsets.part1 : toolsets.part2) : toolsets.unified;
  return keys.has(name);
}

export function isRenderTool(name: string) {
  return getToolDescriptor(name)?.toolType === "render";
}

export async function invokeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "catalog.getCatalog":
      return { success: true, data: getCatalog() };

    case "customer.getVanTemplates":
      return { success: true, data: getCatalog().vanTemplates ?? [] };

    case "customer.startSession": {
      const parsed = JourneyStartSchema.safeParse(args);
      if (!parsed.success) {
        return { success: false, error: parsed.error.message };
      }
      return { success: true, data: startGuidedSession(parsed.data) };
    }

    case "customer.advanceSession": {
      const parsed = JourneyAdvanceSchema.safeParse(args);
      if (!parsed.success) {
        return { success: false, error: parsed.error.message };
      }
      const result = advanceGuidedSession(parsed.data as unknown as Parameters<typeof advanceGuidedSession>[0]);
      if (!result) return { success: false, error: "Session not found." };
      return { success: true, data: result };
    }

    case "customer.refreshSession": {
      const parsed = SessionActionSchema.safeParse(args);
      if (!parsed.success) {
        return { success: false, error: parsed.error.message };
      }
      const result = refreshGuidedSession(parsed.data.sessionId);
      if (!result) return { success: false, error: "Session not found." };
      return { success: true, data: result };
    }

    case "customer.updateOptions": {
      const parsed = SessionActionSchema.safeParse(args);
      if (!parsed.success) {
        return { success: false, error: parsed.error.message };
      }
      const result = setSelectedOption(parsed.data.sessionId, parsed.data.optionId ?? "");
      if (!result) return { success: false, error: "Session or option not found." };
      const refreshed = refreshGuidedSession(result.id);
      return { success: true, data: { ...refreshed } };
    }

    case "customer.submitSession": {
      const parsed = SessionActionSchema.safeParse(args);
      if (!parsed.success) {
        return { success: false, error: parsed.error.message };
      }
      const result = submitSession(parsed.data.sessionId);
      if (!result) return { success: false, error: "Session not found." };
      return { success: true, data: result };
    }

    case "configurate.renderJourney": {
      const parsed = z.object({ sessionId: z.string() }).safeParse(args);
      if (!parsed.success) {
        return { success: false, error: parsed.error.message };
      }
      const result = refreshGuidedSession(parsed.data.sessionId);
      if (!result) return { success: false, error: "Session not found." };
      return {
        success: true,
        data: {
          app: "Configurate",
          narrativeMoment: "customer_config_momentum",
          ...result
        }
      };
    }

    case "ops.getKpis":
      return { success: true, data: getKpis() };

    case "ops.getSessionIssues": {
      const parsed = z.object({ sessionId: z.string() }).safeParse(args);
      if (!parsed.success) return { success: false, error: parsed.error.message };
      return { success: true, data: getIssuesBySession(parsed.data.sessionId) };
    }

    case "ops.getIssues":
      return { success: true, data: issueList() };

    case "ops.getOpsBoard": {
      const parsed = OpsBoardSchema.safeParse(args);
      if (!parsed.success) return { success: false, error: parsed.error.message };
      return { success: true, data: getOpsBoard(parsed.data.sessionId) };
    }

    case "ops.seedDeterministicIssue": {
      const parsed = SeedIssueSchema.safeParse(args);
      if (!parsed.success) return { success: false, error: parsed.error.message };
      return { success: true, data: seedDeterministicIssueScenario(parsed.data) };
    }

    case "control.renderBoard": {
      const parsed = OpsBoardSchema.safeParse(args);
      if (!parsed.success) return { success: false, error: parsed.error.message };
      const board = getOpsBoard(parsed.data.sessionId);
      return {
        success: true,
        data: {
          app: "Control",
          narrativeMoment: "operational_visibility_and_issue_detection",
          board,
          kpis: getKpis()
        }
      };
    }

    case "dev.fixIssue": {
      const parsed = z.object({ issueId: z.string() }).safeParse(args);
      if (!parsed.success) return { success: false, error: parsed.error.message };
      const issue = applyFix(parsed.data.issueId);
      if (!issue) return { success: false, error: "Fix target invalid or already applied." };
      return {
        success: true,
        data: {
          narrativeMoment: "customize_live_fix_payoff",
          issue,
          session: getSession(issue.sessionId)
        }
      };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}
