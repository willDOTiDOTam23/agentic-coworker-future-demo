import { z } from "zod";
export const ReasoningEffortSchema = z.enum(["none", "low", "medium", "high", "xhigh"]);

export const StepIdSchema = z.enum(["vision", "exterior", "interior", "layout", "gear"]);

export const ConfigValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeScalar(value: unknown): z.infer<typeof ConfigValueSchema> | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const normalizedItems = value
      .map((item) => {
        if (item === null || item === undefined) return null;
        if (typeof item === "string") return item.trim();
        if (typeof item === "number" || typeof item === "boolean") return String(item);
        return null;
      })
      .filter((item): item is string => Boolean(item));

    return normalizedItems.length > 0 ? normalizedItems : undefined;
  }

  return undefined;
}

export function normalizeConfigurationValues(input: unknown): Record<string, z.infer<typeof ConfigValueSchema>> {
  if (!isPlainObject(input)) {
    return {};
  }

  const normalized: Record<string, z.infer<typeof ConfigValueSchema>> = {};

  const visit = (value: Record<string, unknown>) => {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (!key) continue;

      const normalizedScalar = normalizeScalar(nestedValue);
      if (normalizedScalar !== undefined) {
        normalized[key] = normalizedScalar;
        continue;
      }

      if (isPlainObject(nestedValue)) {
        visit(nestedValue);
      }
    }
  };

  visit(input);
  return normalized;
}

export const ConfigurationValuesSchema = z.preprocess(
  (input) => normalizeConfigurationValues(input),
  z.record(z.string(), ConfigValueSchema)
);

export const SaveConfigurationStepSchema = z.object({
  step: StepIdSchema,
  values: ConfigurationValuesSchema,
  visualTone: z.string().trim().min(1).max(80).optional(),
  paletteChoice: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().min(1).max(280).optional(),
  advance: z.boolean().optional()
});

export const MonitorOutputSchema = z.object({
  status_summary: z.string().min(1),
  confidence_score: z.number().min(0).max(1),
  risk_flags: z.array(z.string()).max(6),
  next_action: z.string().min(1),
  handoff_decision: z.enum(["hold", "design_planner"])
});

export const DesignBriefSchema = z.object({
  projectOverview: z.object({
    buildName: z.string().min(1),
    customerArchetype: z.string().min(1),
    buildStage: z.string().min(1),
    summary: z.string().min(1)
  }),
  useCaseAndVision: z.object({
    primaryUseCase: z.string().min(1),
    visionStatement: z.string().min(1),
    vibeKeywords: z.array(z.string()).min(1).max(6),
    intendedTrips: z.array(z.string()).min(1).max(5)
  }),
  exteriorSpec: z.object({
    exteriorColor: z.string().min(1),
    finish: z.string().min(1),
    drivetrain: z.string().min(1),
    powerPreference: z.string().min(1),
    notes: z.array(z.string()).max(6)
  }),
  interiorSpec: z.object({
    interiorTone: z.string().min(1),
    materials: z.array(z.string()).min(1).max(6),
    comfortLevel: z.string().min(1),
    workspaceIntent: z.string().min(1),
    notes: z.array(z.string()).max(6)
  }),
  layoutAndSleepingConfig: z.object({
    occupancy: z.string().min(1),
    sleepingConfiguration: z.string().min(1),
    layoutPriorities: z.array(z.string()).min(1).max(6),
    storageStrategy: z.string().min(1)
  }),
  gearAndAccessories: z.object({
    items: z.array(
      z.object({
        name: z.string().min(1),
        purpose: z.string().min(1),
        priority: z.enum(["core", "nice-to-have", "stretch"])
      })
    )
  }),
  bomSummary: z.object({
    componentBuckets: z.array(
      z.object({
        category: z.string().min(1),
        items: z.array(z.string()).min(1).max(6),
        estimatedCostRange: z.string().min(1)
      })
    ),
    estimatedTotalRange: z.string().min(1)
  }),
  buildNotes: z.object({
    assumptions: z.array(z.string()).max(6),
    risks: z.array(z.string()).max(6),
    unresolvedDecisions: z.array(z.string()).max(6)
  })
});

export const SupplyOrderSchema = z.object({
  orderSummary: z.object({
    buildPhase: z.string().min(1),
    sourcingPosture: z.string().min(1),
    totalEstimatedRange: z.string().min(1),
    summary: z.string().min(1)
  }),
  componentLineItems: z.array(
    z.object({
      name: z.string().min(1),
      category: z.string().min(1),
      estimatedCostRange: z.string().min(1),
      supplierType: z.string().min(1),
      leadTime: z.string().min(1)
    })
  ),
  sequencingNotes: z.array(z.string()).min(1).max(8),
  openQuestions: z.array(z.string()).max(8)
});

export const PublishStatusEventSchema = z.object({
  agentName: z.enum(["Session Monitor", "Design Planner", "Supply Orchestrator"]),
  message: z.string().min(1).max(240),
  status: z.enum(["thinking", "monitoring", "ready", "blocked"]),
  confidenceScore: z.number().min(0).max(1).nullable(),
  riskFlags: z.array(z.string()).max(6).nullable(),
  nextAction: z.string().max(200).nullable()
});

export type SaveConfigurationStepInput = z.infer<typeof SaveConfigurationStepSchema>;
export type MonitorOutput = z.infer<typeof MonitorOutputSchema>;
export type DesignBrief = z.infer<typeof DesignBriefSchema>;
export type SupplyOrder = z.infer<typeof SupplyOrderSchema>;
export type PublishStatusEventInput = z.infer<typeof PublishStatusEventSchema>;
