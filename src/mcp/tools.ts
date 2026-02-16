import { getCatalog, getKpis, getIssuesBySession, getSession, getOpsBoard, startGuidedSession, advanceGuidedSession, refreshGuidedSession, setSelectedOption, submitSession, issueList, applyFix } from "../data/store";
import { z } from "zod";

const JourneyStartSchema = z.object({
  customerName: z.string().min(1).optional(),
  budget: z.number().positive().optional(),
  budgetBand: z.enum(["value", "balanced", "premium", "luxury"]).optional(),
  occupancy: z.number().int().positive().optional(),
  terrain: z.enum(["mountain", "beach", "forest", "winter", "city", "water"]).optional(),
  region: z.enum(["NW", "CA", "CO", "FL"]).optional(),
  tripStyle: z.string().optional(),
  moods: z.array(z.string()).optional()
});

const JourneyAdvanceSchema = z.object({
  sessionId: z.string(),
  action: z.enum(["start_over", "optimize_family", "optimize_safety", "optimize_budget", "safe_baseline", "show_options", "skip_to_submit", "use_default_preferences", "submit"]).optional(),
  customerName: z.string().min(1).optional(),
  budget: z.number().positive().optional(),
  budgetBand: z.enum(["value", "balanced", "premium", "luxury"]).optional(),
  occupancy: z.number().int().positive().optional(),
  terrain: z.enum(["mountain", "beach", "forest", "winter", "city", "water"]).optional(),
  region: z.enum(["NW", "CA", "CO", "FL"]).optional(),
  tripStyle: z.string().optional(),
  moods: z.array(z.string()).optional(),
  optionId: z.string().optional(),
  optionIds: z.array(z.string()).optional()
});

const SessionActionSchema = z.object({
  sessionId: z.string(),
  optionId: z.string().optional()
});

const OpsBoardSchema = z.object({
  sessionId: z.string().optional()
});

export const mcpTools = [
  {
    name: "catalog.getCatalog",
    description: "Get adventure van catalog and available option modules."
  },
  {
    name: "customer.startSession",
    description: "Start or resume the guided customer configuration flow. Returns widget-ready journey state.",
    inputSchema: JourneyStartSchema
  },
  {
    name: "customer.advanceSession",
    description: "Advance a guided session by collecting one response at a time, applying quick actions, and optionally running readiness check with submit.",
    inputSchema: JourneyAdvanceSchema
  },
  {
    name: "customer.refreshSession",
    description: "Refresh guided session state and return deterministic widget payloads.",
    inputSchema: SessionActionSchema
  },
  {
    name: "customer.updateOptions",
    description: "Add or remove one option from a customer session.",
    inputSchema: SessionActionSchema
  },
  {
    name: "customer.submitSession",
    description: "Submit a customer session and run compatibility/budget checks.",
    inputSchema: SessionActionSchema
  },
  {
    name: "ops.getKpis",
    description: "Get operational KPIs.",
    inputSchema: z.object({})
  },
  {
    name: "ops.getSessionIssues",
    description: "List issues for a specific session.",
    inputSchema: z.object({ sessionId: z.string() })
  },
  {
    name: "ops.getIssues",
    description: "List all open and closed issues."
  },
  {
    name: "ops.getOpsBoard",
    description: "Get prioritized operational fixes and feature suggestions for the dashboard cockpit.",
    inputSchema: OpsBoardSchema
  },
  {
    name: "dev.fixIssue",
    description: "Simulate the developer coworker applying a fix."
  }
];

export async function invokeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "catalog.getCatalog":
      return { success: true, data: getCatalog() };

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
      const result = advanceGuidedSession(parsed.data);
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

    case "dev.fixIssue": {
      const parsed = z.object({ issueId: z.string() }).safeParse(args);
      if (!parsed.success) return { success: false, error: parsed.error.message };
      const issue = applyFix(parsed.data.issueId);
      if (!issue) return { success: false, error: "Fix target invalid or already applied." };
      return {
        success: true,
        data: {
          issue,
          session: getSession(issue.sessionId)
        }
      };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}
