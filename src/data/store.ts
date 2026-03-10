import { randomUUID } from "crypto";
import {
  BudgetBand,
  ConfiguratorProfile,
  ConfiguratorProfile as ConfiguratorProfileType,
  ExteriorConfig,
  ExteriorPaint,
  GuidedInputCaptureState,
  GuidedJourneyState,
  Issue,
  JourneyStep,
  KpiCard,
  LifestyleMode,
  OpsBoardItem,
  OpsBoardPayload,
  OptionItem,
  PmDashboardPayload,
  PerformanceBugCard,
  FeatureIdeaCard,
  PriorityLane,
  Region,
  RecentTransaction,
  RecoResult,
  Session,
  SessionLog,
  Terrain,
  InteriorConfig,
  InteriorLevel,
  PowerConfig,
  WheelStyle,
  RoofRackStyle,
  LightStyle
} from "../types.js";
import {
  defaultConfiguratorProfile,
  exteriorCatalog,
  getTemplateProfile,
  interiorCatalog,
  lifestyleCatalog,
  options as catalogOptions,
  powerCatalog,
  regions,
  terrains,
  visualAssetManifest,
  vans,
  vanTemplates
} from "./catalog.js";
import { applyVisualSelectionsToCatalog, resolveVisualManifestPayload } from "./visual-manifest.js";

interface StoreShape {
  sessions: Map<string, Session>;
  issues: Map<string, Issue>;
  activeFixes: Set<string>;
  recentTransactions: RecentTransaction[];
}

interface GuidedSessionInput {
  customerName?: string;
  budget?: number;
  budgetBand?: BudgetBand;
  occupancy?: number;
  terrain?: Terrain;
  region?: Region;
  tripStyle?: string;
  moods?: string[];
  templateId?: string;
  startFromScratch?: boolean;
}

interface GuidedSessionUpdate {
  sessionId: string;
  action?:
    | "start_over"
    | "optimize_family"
    | "optimize_safety"
    | "optimize_budget"
    | "safe_baseline"
    | "show_options"
    | "skip_to_submit"
    | "use_default_preferences"
    | "submit";
  customerName?: string;
  budget?: number;
  budgetBand?: BudgetBand;
  occupancy?: number;
  terrain?: Terrain;
  region?: Region;
  tripStyle?: string;
  moods?: string[];
  optionId?: string;
  optionIds?: string[];
  templateId?: string;
  startFromScratch?: boolean;
  exterior?: Partial<ExteriorConfig>;
  interior?: Partial<InteriorConfig>;
  power?: Partial<PowerConfig>;
  accessories?: string[];
  lifestyleMode?: LifestyleMode;
  nextStep?: JourneyStep;
}

const BUDGET_BANDS: Record<BudgetBand, number> = {
  value: 52000,
  balanced: 82000,
  premium: 109000,
  luxury: 145000
};

const SAFE_DEFAULT_MOODS = ["family", "safety", "relax"];
const MAX_RECENT_TRANSACTIONS = 24;

const store: StoreShape = {
  sessions: new Map(),
  issues: new Map(),
  activeFixes: new Set(),
  recentTransactions: []
};

const DEFAULT_CAPTURED_INPUTS: GuidedInputCaptureState = {
  customerName: true,
  tripStyle: true,
  budgetBand: true,
  terrain: true,
  region: true
};

function nowIso() {
  return new Date().toISOString();
}

function nowSessionId() {
  return `session-${randomUUID()}`;
}

function normalizeStringList(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)));
}

function effectiveMoods(values: string[]) {
  const normalized = normalizeStringList(values);
  return normalized.length > 0 ? normalized : SAFE_DEFAULT_MOODS;
}

function getTemplateIdOrDefault(candidate?: string) {
  if (!candidate) return undefined;
  return vanTemplates.some((template) => template.id === candidate) ? candidate : undefined;
}

function getTemplate(templateId?: string) {
  const found = templateId ? templateId : undefined;
  return found ? vanTemplates.find((template) => template.id === found) : undefined;
}

function cloneConfigurator(profile: ConfiguratorProfileType): ConfiguratorProfileType {
  return {
    exterior: { ...profile.exterior },
    interior: { ...profile.interior },
    power: { ...profile.power },
    accessories: {
      selectedAccessoryIds: [...profile.accessories.selectedAccessoryIds]
    },
    totalPrice: profile.totalPrice
  };
}

function defaultAccessoryIds(level: InteriorLevel) {
  if (level === "basic-empty") return [];
  if (level === "minimal-build-out") return ["option-solar-panels"];
  if (level === "moderate-build-out") {
    return ["option-solar-panels", "option-family-safety", "option-portable-fridge"];
  }

  return ["option-solar-panels", "option-portable-fridge", "option-shower-module"];
}

function resolveTemplateProfile(templateId: string | undefined, startFromScratch = false): ConfiguratorProfileType {
  if (startFromScratch) {
    const profile = cloneConfigurator(defaultConfiguratorProfile);
    profile.accessories = { selectedAccessoryIds: [] };
    return profile;
  }

  const templateProfile = getTemplateProfile(templateId);
  const profile = cloneConfigurator(templateProfile);

  if (profile.accessories.selectedAccessoryIds.length === 0) {
    profile.accessories = {
      selectedAccessoryIds: defaultAccessoryIds(profile.interior.level)
    };
  }

  profile.totalPrice = 0;
  return profile;
}

function sanitizeConfigLists(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function resolveExteriorConfig(payload: Partial<ExteriorConfig>, templateProfile: ConfiguratorProfileType) {
  const base = templateProfile.exterior;
  return {
    paintColor: (payload.paintColor ?? base.paintColor) as ExteriorPaint,
    roofRack: (payload.roofRack ?? base.roofRack) as RoofRackStyle,
    wheels: (payload.wheels ?? base.wheels) as WheelStyle,
    lights: (payload.lights ?? base.lights) as LightStyle
  };
}

function resolveInteriorConfig(payload: Partial<InteriorConfig>, templateProfile: ConfiguratorProfileType, fallbackLifestyle?: string) {
  return {
    level: (payload.level ?? templateProfile.interior.level) as InteriorConfig["level"],
    lifestyleMode: ((payload.lifestyleMode ?? templateProfile.interior.lifestyleMode ?? fallbackLifestyle ?? "true-adventure") as LifestyleMode)
  };
}

function resolvePowerConfig(payload: Partial<PowerConfig>, templateProfile: ConfiguratorProfileType) {
  return {
    drivetrain: (payload.drivetrain ?? templateProfile.power.drivetrain) as PowerConfig["drivetrain"]
  };
}

function resolveAccessoryConfig(payload: string[] | undefined, templateProfile: ConfiguratorProfileType) {
  return {
    selectedAccessoryIds: sanitizeConfigLists(payload ?? templateProfile.accessories.selectedAccessoryIds)
  };
}

function recomputeTemplateMoods(session: Session) {
  if (session.isFromScratch) {
    return session.moods;
  }

  const template = getTemplate(session.templateId);
  if (!template) return session.moods;

  return [...session.moods, ...template.tags];
}

function computeBudget(payload?: number, band?: BudgetBand) {
  if (typeof payload === "number" && payload > 0) {
    return payload;
  }

  return band && BUDGET_BANDS[band] ? BUDGET_BANDS[band] : BUDGET_BANDS.balanced;
}

function resolveCapturedInputs(payload: Pick<
  GuidedSessionInput,
  "customerName" | "tripStyle" | "budget" | "budgetBand" | "terrain" | "region"
>) {
  return {
    customerName: Boolean(payload.customerName?.trim()),
    tripStyle: Boolean(payload.tripStyle?.trim()),
    budgetBand: Boolean(payload.budget || payload.budgetBand),
    terrain: Boolean(payload.terrain),
    region: Boolean(payload.region)
  };
}

function ensureCapturedInputs(session: Session) {
  if (!session.capturedInputs) {
    session.capturedInputs = { ...DEFAULT_CAPTURED_INPUTS };
  }

  return session.capturedInputs;
}

function getOptionById(optionId: string) {
  return catalogOptions.find((option) => option.id === optionId);
}

function visualContext() {
  const manifest = resolveVisualManifestPayload(visualAssetManifest, vanTemplates, catalogOptions);
  const { resolvedTemplates, resolvedOptions } = applyVisualSelectionsToCatalog(vanTemplates, catalogOptions, manifest);
  return {
    manifest,
    resolvedTemplates,
    resolvedOptions
  };
}

function sessionVanSelectionTags(session: Session) {
  const mergedMoods = recomputeTemplateMoods(session);
  return effectiveMoods(mergedMoods);
}

function scoreVan(van: (typeof vans)[number], budget: number, terrain: Terrain, region: Region, moods: string[]) {
  const resolvedMoods = effectiveMoods(moods);

  if (budget < van.basePrice) return -1;
  if (!van.regions.includes(region)) return -1;
  if (!van.terrains.includes(terrain) && !van.terrains.includes("city")) return -1;

  let score = 0;

  if (resolvedMoods.includes("family")) {
    score += van.maxOccupancy >= 4 ? 24 : 0;
  }

  if (resolvedMoods.includes("winter")) {
    score += van.terrains.includes("winter") ? 28 : -12;
  }

  if (resolvedMoods.includes("water")) {
    score += van.tags.includes("water") ? 35 : -18;
  }

  if (resolvedMoods.includes("adventure")) {
    score += van.tags.includes("tracks") || van.tags.includes("offroad") ? 22 : 4;
  }

  if (resolvedMoods.includes("luxury")) {
    score += van.features.join(" ").toLowerCase().includes("quiet") ? 16 : 8;
  }

  if (resolvedMoods.includes("safety")) {
    score += 10;
  }

  return score;
}

function isOptionCompatible(option: OptionItem, vanTags: string[], terrain: Terrain) {
  const missingRequired = option.requiredTags.filter((tag) => !vanTags.includes(tag));
  if (missingRequired.length > 0) return false;

  if (option.incompatibleTags.includes(terrain)) return false;
  return true;
}

function buildRecommendation(vanTags: string[], terrain: Terrain, moods: string[]): RecoResult {
  const resolvedMoods = effectiveMoods(moods);
  const compatibleOptions = catalogOptions
    .filter((option) => isOptionCompatible(option, vanTags, terrain))
    .sort((a, b) => {
      const impact = resolvedMoods.includes("budget") ? 1 : 0;
      const delta = b.deltaPrice - a.deltaPrice;
      return delta || impact;
    });

  const fallbackVan = [...vans]
    .filter((van) => van.basePrice <= BUDGET_BANDS.luxury)
    .sort((a, b) => a.basePrice - b.basePrice)[0] ?? vans[0];

  return {
    van: fallbackVan,
    options: compatibleOptions,
    estimatedPrice: fallbackVan.basePrice + compatibleOptions.reduce((acc, option) => acc + option.deltaPrice, 0)
  };
}

function recalculateChosenVan(payload: {
  budget: number;
  terrain: Terrain;
  region: Region;
  moods: string[];
}) {
  const candidates = vans
    .map((van) => ({
      van,
      score: scoreVan(van, payload.budget, payload.terrain, payload.region, payload.moods)
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  return (candidates[0] ?? { van: vans[0], score: 0 }).van;
}

function totalFromSelections(vanId: string, selectedOptionIds: string[]) {
  const chosen = vans.find((van) => van.id === vanId) ?? vans[0];
  const optionSum = catalogOptions
    .filter((option) => selectedOptionIds.includes(option.id))
    .reduce((acc, option) => acc + option.deltaPrice, 0);

  return chosen.basePrice + optionSum;
}

function hasTemplateChoice(session: Session) {
  return Boolean(session.isFromScratch || session.templateId);
}

function hasExteriorConfigured(session: Session) {
  return Boolean(session.config.exterior.paintColor && session.config.exterior.roofRack && session.config.exterior.wheels && session.config.exterior.lights);
}

function hasInteriorConfigured(session: Session) {
  return Boolean(session.config.interior.level && session.config.interior.lifestyleMode);
}

function hasPowerConfigured(session: Session) {
  return Boolean(session.config.power.drivetrain);
}

function expectedStep(session: Session): JourneyStep {
  if (!hasTemplateChoice(session)) return 1;
  if (!hasExteriorConfigured(session)) return 2;
  if (!hasInteriorConfigured(session)) return 3;
  if (!hasPowerConfigured(session)) return 4;
  return 5;
}

function clampStep(step: number | undefined) {
  if (!step) return 1;
  return Math.max(1, Math.min(5, step)) as JourneyStep;
}

function resolveJourneyStep(session: Session, explicitStep?: number, allowForwardBump = false) {
  if (!hasTemplateChoice(session)) return 1 as JourneyStep;
  const expected = expectedStep(session);
  if (!explicitStep) return expected;
  const next = clampStep(explicitStep);
  if (allowForwardBump) return next;
  return (Math.min(next, expected) as JourneyStep);
}

function describeTemplate(templateId?: string) {
  const template = getTemplate(templateId);
  return template?.title ?? "Starter concept";
}

function buildJourneyCards(
  step: JourneyStep,
  session: Session,
  recommendation: RecoResult
): GuidedJourneyState["stepCards"] {
  if (step === 1) {
    return [
      {
        id: "step-1-template",
        title: "Step 1: Choose a concept",
        body: `Welcome ${session.customerName || "Explorer"}. Pick a stylish template to start, or begin from scratch.`,
        chipHints: ["true adventure", "nomad", "work-from-home", "play hard"],
        badge: "info"
      }
    ];
  }

  if (step === 2) {
    return [
      {
        id: "step-2-exterior",
        title: "Step 2: Exterior + drivetrain",
        body: `Paint: ${session.config.exterior.paintColor} • Roof: ${session.config.exterior.roofRack} • Wheels: ${session.config.exterior.wheels} • Drive: ${session.config.power.drivetrain}`,
        chipHints: ["paint", "roof rack", "wheels", "lights", "drivetrain"],
        badge: "info"
      }
    ];
  }

  if (step === 3) {
    return [
      {
        id: "step-3-interior",
        title: "Step 3: Interior and lifestyle",
        body: `Build: ${session.config.interior.level.replace("-", " ")} • Lifestyle: ${session.config.interior.lifestyleMode}`,
        chipHints: [session.config.interior.level, session.config.interior.lifestyleMode],
        badge: "info"
      }
    ];
  }

  if (step === 4) {
    return [
      {
        id: "step-4-layout",
        title: "Step 4: Cabin layout",
        body: `Layout focus: ${session.tripStyle || "Custom layout"} • Occupancy: ${session.occupancy}`,
        chipHints: ["gear garage", "family lounge", "work pod", "sleep max"],
        badge: "info"
      }
    ];
  }

  return [
    {
      id: "step-5-accessories",
      title: "Step 5: Accessories + final review",
      body: recommendation ?
        `Estimated total: $${session.totalPrice.toLocaleString()}. Pick final modules and submit.` :
        "Review your build and add optional modules.",
      chipHints: ["sunshade", "shower", "fridge", "submit"],
      badge: session.status === "needs_attention" ? "warning" : "success"
    }
  ];
}

function buildJourneyState(step: JourneyStep, session: Session, recommendation: RecoResult, completed: boolean): GuidedJourneyState {
  if (step === 1) {
    return {
      step: 1,
      nextQuestion: "Pick a template, or start from scratch.",
      requiredInputs: ["templateId", "startFromScratch"],
      stepCards: buildJourneyCards(1, session, recommendation),
      quickActions: [{ id: "start-over", label: "Restart", value: "start_over" }],
      completed: false
    };
  }

  if (step === 2) {
    return {
      step: 2,
      nextQuestion: "Style the exterior and choose drivetrain to lock your next phase.",
      requiredInputs: ["exterior", "power"],
      stepCards: buildJourneyCards(2, session, recommendation),
      quickActions: [
        { id: "to-interior", label: "Continue", value: "show_options" },
        { id: "start-over", label: "Restart", value: "start_over" }
      ],
      completed: false
    };
  }

  if (step === 3) {
    return {
      step: 3,
      nextQuestion: "Choose interior level and lifestyle mode.",
      requiredInputs: ["interior"],
      stepCards: buildJourneyCards(3, session, recommendation),
      quickActions: [
        { id: "to-power", label: "Continue", value: "show_options" },
        { id: "start-over", label: "Restart", value: "start_over" }
      ],
      completed: false
    };
  }

  if (step === 4) {
    return {
      step: 4,
      nextQuestion: "Choose your interior layout and sleeping plan.",
      requiredInputs: ["layout"],
      stepCards: buildJourneyCards(4, session, recommendation),
      quickActions: [
        { id: "to-accessories", label: "Continue", value: "show_options" },
        { id: "start-over", label: "Restart", value: "start_over" }
      ],
      completed: false
    };
  }

  return {
    step: 5,
    nextQuestion: "Review your build, add accessories, then submit.",
    requiredInputs: ["accessories", "submit"],
    stepCards: buildJourneyCards(5, session, recommendation),
    quickActions: [
      { id: "safe-baseline", label: "Try safer baseline", value: "safe_baseline" },
      { id: "submit", label: "Submit readiness check", value: "submit" },
      { id: "start-over", label: "Restart", value: "start_over" }
    ],
    completed
  };
}

function buildJourneyStateForSession(session: Session, recommendation: RecoResult) {
  const step = expectedStep(session);
  return buildJourneyState(step, session, recommendation, session.status === "submitted");
}

function recalcSessionProjection(session: Session, allowForwardBump = false) {
  const templateProfile = resolveTemplateProfile(session.templateId, session.isFromScratch);
  const recommendation = buildRecommendation(
    recalculateChosenVan({
      budget: session.budget,
      terrain: session.terrain,
      region: session.region,
      moods: effectiveMoods(session.moods)
    }).tags,
    session.terrain,
    session.moods
  );

  const chosen = vans.find((item) => item.id === recommendation.van.id) ?? vans[0];
  session.chosenVanId = chosen.id;
  session.totalPrice = totalFromSelections(session.chosenVanId, session.selectedOptionIds);
  session.config.totalPrice = session.totalPrice;
  session.config.accessories.selectedAccessoryIds = [...session.selectedOptionIds];
  session.selectedOptionIds = sanitizeConfigLists(session.selectedOptionIds);

  const step = resolveJourneyStep(session, session.journey?.step, allowForwardBump);
  session.journey = buildJourneyState(step, session, recommendation, session.status === "submitted");

  return recommendation;
}

function syncTemplateAndConfig(session: Session, templateId?: string, startFromScratch?: boolean) {
  if (templateId !== undefined || startFromScratch !== undefined) {
    const nextScratch = startFromScratch ?? session.isFromScratch;
    const nextTemplate = startFromScratch ? undefined : getTemplateIdOrDefault(templateId) || session.templateId;
    session.isFromScratch = Boolean(nextScratch);
    session.templateId = nextScratch ? undefined : nextTemplate;

    const templateProfile = resolveTemplateProfile(nextTemplate, nextScratch);
    session.config = {
      exterior: { ...templateProfile.exterior },
      interior: { ...templateProfile.interior },
      power: { ...templateProfile.power },
      accessories: { selectedAccessoryIds: [...templateProfile.accessories.selectedAccessoryIds] },
      totalPrice: templateProfile.totalPrice
    };
    session.selectedOptionIds = [...session.config.accessories.selectedAccessoryIds];
    session.journey.step = 2;

    const template = getTemplate(nextTemplate);
    session.moods = effectiveMoods([
      ...session.moods.filter((value) => !session.moods.includes("")),
      ...(template ? template.tags : [])
    ]);

    return;
  }
}

function logInfo(session: Session, event: string, message: string, severity: SessionLog["severity"] = "info") {
  session.logs.push({ ts: nowIso(), event, message, severity });
}

function applyQuickAction(session: Session, action: string) {
  if (action === "start_over") {
    syncTemplateAndConfig(session, session.templateId, session.isFromScratch);
    session.status = "draft";
    session.selectedOptionIds = [...session.config.accessories.selectedAccessoryIds];
    session.capturedInputs = {
      customerName: false,
      tripStyle: false,
      budgetBand: false,
      terrain: false,
      region: false
    };
    session.logs = session.logs.slice(-20);
    logInfo(session, "journey_reset", "Customer restarted the guided flow.", "warn");
    session.journey.step = 1;
    return;
  }

  if (action === "show_options") {
    const next = session.journey.step + 1;
    session.journey.step = clampStep(next);
    logInfo(session, "journey_step_advance", `Customer moved to step ${session.journey.step}.`, "info");
    return;
  }

  if (action === "skip_to_submit") {
    session.journey.step = 5;
    logInfo(session, "journey_step_advance", "Customer jumped to final review step.", "info");
    return;
  }

  if (action === "use_default_preferences") {
    if (session.moods.length === 0) {
      session.moods = [...SAFE_DEFAULT_MOODS];
    }
    session.journey.step = 3;
    logInfo(session, "journey_step_advance", "Default preferences applied.", "info");
    return;
  }

  if (action === "safe_baseline") {
    session.selectedOptionIds = [];
    session.config.accessories.selectedAccessoryIds = [];
    logInfo(session, "journey_action", "Customer chose safe baseline option set.", "info");
    return;
  }

  if (action === "optimize_family") {
    if (!session.moods.includes("family")) {
      session.moods = [...session.moods, "family"];
    }
    return;
  }

  if (action === "optimize_safety") {
    if (!session.moods.includes("safety")) {
      session.moods = [...session.moods, "safety"];
    }
    return;
  }

  if (action === "optimize_budget") {
    session.budget = Math.max(16000, session.budget - 8000);
    session.selectedOptionIds = [];
    session.config.accessories.selectedAccessoryIds = [];
    return;
  }
}

function findConflicts(session: Session, vanId: string) {
  const van = vans.find((item) => item.id === vanId) ?? vans[0];
  const selectedOptions = catalogOptions.filter((option) => session.selectedOptionIds.includes(option.id));

  return selectedOptions
    .map((option) => {
      const missingRequired = option.requiredTags.filter((tag) => !van.tags.includes(tag));
      const incompatibleInTerrain = option.incompatibleTags.includes(session.terrain);
      if (missingRequired.length === 0 && !incompatibleInTerrain) {
        return null;
      }

      return {
        ts: nowIso(),
        event: "compatibility_violation",
        message: `${option.name} conflicts with the current setup${missingRequired.length ? ` (missing: ${missingRequired.join(",")})` : ""}.`,
        severity: "error" as const
      };
    })
    .filter((entry) => entry !== null) as SessionLog[];
}

function issueAlreadyOpen(sessionId: string, type: Issue["type"]) {
  return issueList().some((issue) => issue.sessionId === sessionId && issue.type === type && !issue.fixed);
}

export function getVanTemplates() {
  return visualContext().resolvedTemplates;
}

export function getCatalogData() {
  const visuals = visualContext();
  return {
    vans,
    options: visuals.resolvedOptions,
    regions,
    terrains,
    vanTemplates: visuals.resolvedTemplates,
    exteriorOptions: exteriorCatalog,
    interiorOptions: interiorCatalog,
    lifestyleModes: lifestyleCatalog,
    powerOptions: powerCatalog,
    visualAssetManifest: visuals.manifest.assets,
    visualSelections: visuals.manifest.selections
  };
}

export function createSession(payload: {
  customerName: string;
  budget: number;
  occupancy: number;
  terrain: Terrain;
  region: Region;
  moods: string[];
  tripStyle?: string;
  capturedInputs?: GuidedInputCaptureState;
  templateId?: string;
  startFromScratch?: boolean;
}) {
  const normalizedMoods = normalizeStringList(payload.moods);
  const resolvedBudget = computeBudget(payload.budget);
  const isFromScratch = Boolean(payload.startFromScratch);
  const resolvedTemplateId = getTemplateIdOrDefault(payload.templateId);

  const config = resolveTemplateProfile(resolvedTemplateId, isFromScratch);
  const sessionTemplateId = isFromScratch ? undefined : resolvedTemplateId;

  const candidateMoods = isFromScratch
    ? normalizedMoods
    : [...(getTemplate(sessionTemplateId)?.tags ?? []), ...normalizedMoods];

  const chosen = recalculateChosenVan({
    budget: resolvedBudget,
    terrain: payload.terrain,
    region: payload.region,
    moods: candidateMoods
  });

  const chosenMoodTags = sessionTemplateId ? [...candidateMoods] : normalizedMoods;
  const recommendation = buildRecommendation(chosen.tags, payload.terrain, chosenMoodTags);
  const initialTotal = totalFromSelections(chosen.id, config.accessories.selectedAccessoryIds);

  const id = nowSessionId();

  const firstSession: Session = {
    id,
    customerName: payload.customerName || "Guest",
    budget: resolvedBudget,
    occupancy: payload.occupancy,
    terrain: payload.terrain,
    region: payload.region,
    tripStyle: payload.tripStyle,
    templateId: sessionTemplateId,
    isFromScratch,
    config: {
      ...config,
      totalPrice: initialTotal
    },
    moods: normalizedMoods,
    chosenVanId: chosen.id,
    selectedOptionIds: [...config.accessories.selectedAccessoryIds],
    totalPrice: initialTotal,
    status: "draft",
    journey: {
      step: isFromScratch || Boolean(sessionTemplateId) ? 2 : 1,
      nextQuestion: "",
      requiredInputs: ["templateId", "startFromScratch"],
      stepCards: [],
      quickActions: [],
      completed: false
    },
    capturedInputs: payload.capturedInputs ?? { ...DEFAULT_CAPTURED_INPUTS },
    logs: [{ ts: nowIso(), event: "session_created", message: `Session started from ${describeTemplate(sessionTemplateId)}.`, severity: "info" }],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  firstSession.journey = buildJourneyStateForSession(firstSession, recommendation);
  recalcSessionProjection(firstSession);

  store.sessions.set(id, firstSession);

  return {
    session: firstSession,
    recommendation,
    availableOptions: recommendation.options
  };
}

export function startGuidedSession(payload: GuidedSessionInput) {
  const resolvedBudget = computeBudget(payload.budget, payload.budgetBand);
  const resolvedTerrain = payload.terrain ?? "city";
  const resolvedRegion = payload.region ?? "CO";
  const capturedInputs = resolveCapturedInputs(payload);
  const isFromScratch = Boolean(payload.startFromScratch);
  const templateId = payload.templateId;
  const resolvedTemplateId = getTemplateIdOrDefault(templateId);

  const sessionPayload = {
    customerName: payload.customerName?.trim() ?? "",
    budget: resolvedBudget,
    occupancy: Math.max(1, payload.occupancy ?? 2),
    terrain: resolvedTerrain,
    region: resolvedRegion,
    moods: normalizeStringList(payload.moods),
    tripStyle: payload.tripStyle?.trim(),
    capturedInputs,
    templateId: isFromScratch ? undefined : resolvedTemplateId,
    startFromScratch: isFromScratch
  };

  const created = createSession(sessionPayload);
  const session = created.session;
  const recommendation = created.recommendation;
  session.capturedInputs = capturedInputs;

  if (isFromScratch && !session.templateId) {
    session.templateId = undefined;
  }

  // Ensure explicit first-step vs second-step states:
  // when a concept is chosen at launch, move to step 2.
  if (isFromScratch || session.templateId || resolvedTemplateId) {
    session.journey = buildJourneyState(2, session, recommendation, false);
  } else {
    session.journey = buildJourneyState(1, session, recommendation, false);
  }

  session.logs.push({
    ts: nowIso(),
    event: "journey_started",
    message: "Guided journey started.",
    severity: "info"
  });

  return {
    ...created,
    recommendation,
    journeyState: session.journey,
    nextQuestion: session.journey.nextQuestion,
    requiredInputs: session.journey.requiredInputs,
    stepCards: session.journey.stepCards
  };
}

export function advanceGuidedSession(payload: GuidedSessionUpdate) {
  const session = getSession(payload.sessionId);
  if (!session) return null;

  const capturedInputs = ensureCapturedInputs(session);
  let submitResult: ReturnType<typeof submitSession> | null = null;
  const allowForwardBump = payload.action === "skip_to_submit" || payload.action === "submit";

  if (payload.customerName) {
    session.customerName = payload.customerName;
    capturedInputs.customerName = Boolean(payload.customerName.trim());
  }

  if (payload.tripStyle) {
    session.tripStyle = payload.tripStyle;
    capturedInputs.tripStyle = Boolean(payload.tripStyle.trim());
  }

  if (payload.terrain) {
    session.terrain = payload.terrain;
    capturedInputs.terrain = true;
  }

  if (payload.region) {
    session.region = payload.region;
    capturedInputs.region = true;
  }

  if (payload.budget || payload.budgetBand) {
    session.budget = computeBudget(payload.budget, payload.budgetBand);
    capturedInputs.budgetBand = true;
    session.moods = effectiveMoods(session.moods);
  }

  if (typeof payload.occupancy === "number") {
    session.occupancy = Math.max(1, payload.occupancy);
  }

  if (payload.moods) {
    session.moods = normalizeStringList(payload.moods);
  }

  if (payload.templateId !== undefined || payload.startFromScratch !== undefined) {
    syncTemplateAndConfig(session, payload.templateId, payload.startFromScratch);
    session.logs.push({
      ts: nowIso(),
      event: "journey_template_select",
      message: `Template updated to ${payload.startFromScratch ? "scratch mode" : payload.templateId ?? "template"}.`,
      severity: "info"
    });
    if (session.isFromScratch || session.templateId) {
      session.journey.step = clampStep(Math.max(session.journey.step, 2));
    }
  }

  if (payload.exterior) {
    const baseline = resolveTemplateProfile(session.templateId, session.isFromScratch);
    const exterior = resolveExteriorConfig(payload.exterior, baseline);
    session.config.exterior = exterior;
    if (session.journey.step <= 2) {
      session.journey.step = 3;
    }
  }

  if (payload.interior) {
    const baseline = resolveTemplateProfile(session.templateId, session.isFromScratch);
    const interior = resolveInteriorConfig(payload.interior, baseline, payload.lifestyleMode);
    session.config.interior = interior;
    if (session.journey.step <= 3) {
      session.journey.step = 4;
    }
  }

  if (payload.power) {
    const baseline = resolveTemplateProfile(session.templateId, session.isFromScratch);
    const power = resolvePowerConfig(payload.power, baseline);
    session.config.power = power;
    if (session.journey.step <= 4) {
      session.journey.step = 5;
    }
  }

  if (payload.lifestyleMode) {
    session.config.interior.lifestyleMode = payload.lifestyleMode;
    if (session.journey.step <= 3) {
      session.journey.step = 4;
    }
  }

  if (Array.isArray(payload.accessories)) {
    session.config.accessories = {
      selectedAccessoryIds: sanitizeConfigLists(payload.accessories)
    };
    session.selectedOptionIds = [...session.config.accessories.selectedAccessoryIds];
    if (session.journey.step >= 4) {
      session.journey.step = 5;
    }
  }

  if (Array.isArray(payload.optionIds)) {
    session.selectedOptionIds = sanitizeConfigLists(payload.optionIds);
    session.config.accessories.selectedAccessoryIds = [...session.selectedOptionIds];
    if (session.journey.step >= 4) {
      session.journey.step = 5;
    }
  }

  if (payload.optionId) {
    const option = getOptionById(payload.optionId);
    if (option) {
      const already = session.selectedOptionIds.includes(option.id);
      session.selectedOptionIds = already
        ? session.selectedOptionIds.filter((id) => id !== option.id)
        : [...session.selectedOptionIds, option.id];
      session.config.accessories.selectedAccessoryIds = [...session.selectedOptionIds];
      if (session.journey.step >= 4) {
        session.journey.step = 5;
      }
    }
  }

  if (payload.nextStep) {
    session.journey.step = clampStep(payload.nextStep);
  }

  if (payload.action) {
    applyQuickAction(session, payload.action);
  }

  const recommendation = recalcSessionProjection(session, allowForwardBump);
  session.journey.step = resolveJourneyStep(
    session,
    hasTemplateChoice(session) ? session.journey.step : 1,
    allowForwardBump
  );

  const submissionError =
    payload.action === "submit" && session.journey.step < 5
      ? "Please complete the guided flow before submitting."
      : undefined;

  if (payload.action === "submit" && !submissionError) {
    submitResult = submitSession(payload.sessionId);
  }

  session.updatedAt = nowIso();
  session.logs.push({ ts: nowIso(), event: "guided_update", message: `Session updated with action ${payload.action ?? "field_update"}.`, severity: "info" });
  store.sessions.set(session.id, session);

  return {
    session,
    recommendation,
    availableOptions: recommendation.options,
    journeyState: session.journey,
    nextQuestion: session.journey.nextQuestion,
    requiredInputs: session.journey.requiredInputs,
    stepCards: session.journey.stepCards,
    submissionError,
    submission: submitResult
  };
}

export function refreshGuidedSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return null;

  const recommendation = recalcSessionProjection(session);
  session.updatedAt = nowIso();

  return {
    session,
    recommendation,
    availableOptions: recommendation.options,
    journeyState: session.journey,
    nextQuestion: session.journey.nextQuestion,
    requiredInputs: session.journey.requiredInputs,
    stepCards: session.journey.stepCards
  };
}

export function getSession(sessionId: string) {
  return store.sessions.get(sessionId) ?? null;
}

export function getCatalog() {
  return getCatalogData();
}

export function getVisualAssetManifest() {
  return visualContext().manifest;
}

export function setSelectedOption(sessionId: string, optionId: string) {
  const session = getSession(sessionId);
  if (!session) return null;

  const option = getOptionById(optionId);
  if (!option) return null;

  const already = session.selectedOptionIds.includes(option.id);
  session.selectedOptionIds = already
    ? session.selectedOptionIds.filter((id) => id !== option.id)
    : [...session.selectedOptionIds, option.id];

  session.config.accessories.selectedAccessoryIds = [...session.selectedOptionIds];
  recalcSessionProjection(session);
  session.updatedAt = nowIso();
  store.sessions.set(sessionId, session);

  return session;
}

export function submitSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return null;

  if (session.journey.step < 5) {
    return {
      session,
      status: "needs_attention",
      error: "Please complete the guided flow before submitting.",
      conflicts: []
    } as const;
  }

  const conflicts = findConflicts(session, session.chosenVanId);
  if (conflicts.length > 0) {
    const issue: Issue = {
      id: randomUUID(),
      sessionId,
      type: "compatibility_error",
      title: "Compatibility issue detected",
      description: "Selected modules conflict with this route and terrain.",
      severity: "high",
      detectedAt: nowIso(),
      fixed: false,
      fixHint: "Drop incompatible modules and re-submit."
    };

    session.logs.push(...conflicts);
    session.logs.push({ ts: nowIso(), event: "session_blocked", message: issue.description, severity: "error" });

    session.status = "blocked";
    if (!issueAlreadyOpen(sessionId, issue.type)) {
      store.issues.set(issue.id, issue);
    }

    return { session, issue, status: "blocked" as const, conflicts };
  }

  if (session.totalPrice > session.budget) {
    const issue: Issue = {
      id: randomUUID(),
      sessionId,
      type: "budget_pressure",
      title: "Budget threshold exceeded",
      description: `Total ${session.totalPrice} exceeds budget ${session.budget}.`,
      severity: "medium",
      detectedAt: nowIso(),
      fixed: false,
      fixHint: "Remove non-essential accessories and retry."
    };

    session.logs.push({ ts: nowIso(), event: "budget_pressure", message: issue.description, severity: "warn" });
    session.status = "needs_attention";
    if (!issueAlreadyOpen(sessionId, issue.type)) {
      store.issues.set(issue.id, issue);
    }

    return { session, issue, status: "needs_attention" as const };
  }

  if (session.status === "submitted") {
    session.logs.push({ ts: nowIso(), event: "session_resubmitted", message: "Session re-submitted with same configuration.", severity: "info" });
    return { session, status: "submitted" as const };
  }

  session.status = "submitted";
  session.logs.push({ ts: nowIso(), event: "session_submitted", message: "Session submitted successfully.", severity: "info" });

  const tx: RecentTransaction = {
    id: randomUUID(),
    sessionId: session.id,
    sessionLabel: `${session.customerName} • ${session.chosenVanId}`,
    amountUsd: session.totalPrice,
    createdAt: nowIso(),
    status: "submitted"
  };

  store.recentTransactions.unshift(tx);
  if (store.recentTransactions.length > MAX_RECENT_TRANSACTIONS) {
    store.recentTransactions.length = MAX_RECENT_TRANSACTIONS;
  }

  return { session, status: "submitted" as const };
}

export function issueList() {
  return Array.from(store.issues.values());
}

export function getIssue(issueId: string) {
  return store.issues.get(issueId) ?? null;
}

export function getIssuesBySession(sessionId: string) {
  return issueList().filter((issue) => issue.sessionId === sessionId);
}

export function applyFix(issueId: string) {
  const issue = getIssue(issueId);
  if (!issue || issue.fixed) return null;

  const session = getSession(issue.sessionId);
  if (!session) return null;

  if (issue.type === "compatibility_error") {
    session.selectedOptionIds = session.selectedOptionIds.filter((optionId) => {
      const option = getOptionById(optionId);
      if (!option) return false;
      return isOptionCompatible(option, vans.find((item) => item.id === session.chosenVanId)?.tags ?? [], session.terrain);
    });

    session.config.accessories.selectedAccessoryIds = [...session.selectedOptionIds];
    recalcSessionProjection(session);
    session.logs.push({ ts: nowIso(), event: "compatibility_fix_applied", message: "Removed incompatible options and re-ran scoring.", severity: "info" });
  }

  if (issue.type === "budget_pressure") {
    const budget = session.budget;
    const sorted = session.selectedOptionIds
      .map((id) => catalogOptions.find((option) => option.id === id))
      .filter((option): option is OptionItem => Boolean(option))
      .sort((a, b) => b.deltaPrice - a.deltaPrice);

    const selected: string[] = [];
    let remaining = budget - (vans.find((item) => item.id === session.chosenVanId)?.basePrice ?? 0);

    for (const option of sorted) {
      if (option.deltaPrice <= remaining) {
        selected.push(option.id);
        remaining -= option.deltaPrice;
      }
    }

    session.selectedOptionIds = selected;
    session.config.accessories.selectedAccessoryIds = [...selected];
    recalcSessionProjection(session);
    session.logs.push({ ts: nowIso(), event: "budget_fix_applied", message: "Reduced modules for budget guardrail.", severity: "info" });
  }

  issue.fixed = true;
  store.activeFixes.add(issue.id);
  session.status = session.status === "blocked" ? "resolved" : session.status;
  return issue;
}

export function seedDeterministicIssueScenario(payload?: { customerName?: string }) {
  const template = vanTemplates[1] ?? vanTemplates[0];
  const started = startGuidedSession({
    customerName: payload?.customerName ?? "Demo customer",
    budgetBand: "luxury",
    terrain: "water",
    region: "CO",
    templateId: template?.id
  });

  advanceGuidedSession({
    sessionId: started.session.id,
    exterior: {
      paintColor: "paint-matte-graphite",
      roofRack: "rack-rugged",
      wheels: "wheel-all-terrain",
      lights: "light-led"
    },
    nextStep: 3
  });
  advanceGuidedSession({
    sessionId: started.session.id,
    interior: {
      level: "moderate-build-out",
      lifestyleMode: "true-adventure"
    },
    nextStep: 4
  });
  advanceGuidedSession({
    sessionId: started.session.id,
    power: {
      drivetrain: "hybrid"
    },
    nextStep: 5
  });
  advanceGuidedSession({
    sessionId: started.session.id,
    optionId: "option-snow-traction"
  });

  const submission = submitSession(started.session.id);
  const openIssue = getIssuesBySession(started.session.id).find((issue) => !issue.fixed) ?? null;

  return {
    sessionId: started.session.id,
    session: getSession(started.session.id),
    issue: openIssue,
    submissionStatus: submission?.status ?? "unknown",
    board: getOpsBoard(started.session.id)
  };
}

function priorityLabel(score: number): PriorityLane {
  if (score >= 320) return "P0";
  if (score >= 220) return "P1";
  return "P2";
}

function impactFactor(level: "high" | "medium" | "low") {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function urgencyFactor(level: "high" | "medium" | "low") {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function scoreByImpactUrgency(impact: "high" | "medium" | "low", urgency: "high" | "medium" | "low", confidence = 0.8) {
  return impactFactor(impact) * urgencyFactor(urgency) * 50 + confidence * 20;
}

function buildPriorityItemBase(overrides: Partial<OpsBoardItem>): OpsBoardItem {
  return {
    id: randomUUID(),
    sourceType: overrides.sourceType ?? "feature_build",
    priority: "P2",
    title: overrides.title ?? "",
    impact: overrides.impact ?? "low",
    urgency: overrides.urgency ?? "low",
    risk: overrides.risk ?? "low",
    confidence: overrides.confidence ?? 0.8,
    score: overrides.score ?? 0,
    rationale: overrides.rationale ?? "",
    suggestedAction: overrides.suggestedAction ?? "create_follow_up_task",
    availableActions: overrides.availableActions ?? ["create_follow_up_task", "defer_to_backlog"],
    etaBusinessDays: overrides.etaBusinessDays,
    dependencyEstimate: overrides.dependencyEstimate,
    reproducibility: overrides.reproducibility,
    sessionId: overrides.sessionId,
    issueId: overrides.issueId
  };
}

function getOpenIssues(sessionId?: string) {
  const issues = sessionId ? getIssuesBySession(sessionId) : issueList();
  return issues.filter((issue) => !issue.fixed);
}

function getFeatureSignals() {
  return [
    {
      id: randomUUID(),
      title: "Add compatibility preflight in Step 2",
      rationale: "Warn users when wheel/light/rack combinations become invalid before the accessories stage.",
      impact: "high" as const,
      urgency: "medium" as const,
      confidence: 0.91,
      etaBusinessDays: 5
    },
    {
      id: randomUUID(),
      title: "Add budget guardrails in step 3 and 5",
      rationale: "Give users live warnings before they add high-cost modules.",
      impact: "medium" as const,
      urgency: "medium" as const,
      confidence: 0.82,
      etaBusinessDays: 4
    },
    {
      id: randomUUID(),
      title: "Create journey summary panel copy for PM review",
      rationale: "Summarize customer choices and conversion blockers for quick handoff.",
      impact: "medium" as const,
      urgency: "low" as const,
      confidence: 0.75,
      etaBusinessDays: 3
    }
  ];
}

function getFeatureIdeas() {
  return getFeatureSignals().map((signal): FeatureIdeaCard => ({
    id: signal.id,
    title: signal.title,
    rationale: signal.rationale,
    confidence: signal.confidence,
    estimatedImpact: signal.impact,
    etaBusinessDays: signal.etaBusinessDays
  }));
}

function getPerformanceBugs() {
  const openIssues = getOpenIssues();
  return openIssues
    .filter((issue) => issue.type === "compatibility_error")
    .map((issue): PerformanceBugCard => ({
      id: issue.id,
      title: issue.title,
      impact: issue.severity === "high" ? "high" : "medium",
      rationale: issue.description,
      sessionId: issue.sessionId,
      issueId: issue.id
    }));
}

export function getOpsBoard(sessionId?: string): OpsBoardPayload {
  const targetIssues = sessionId ? getIssuesBySession(sessionId) : issueList();
  const openIssues = targetIssues.filter((issue) => !issue.fixed);

  const fixCandidates: OpsBoardItem[] = openIssues.map((issue) => {
    const isBlocked = issue.sessionId ? getSession(issue.sessionId)?.status === "blocked" : false;
    const urgency: "high" | "medium" | "low" = isBlocked ? "high" : issue.severity === "high" ? "high" : "medium";
    const impact: "high" | "medium" | "low" = issue.type === "compatibility_error" ? "high" : "medium";
    const score = scoreByImpactUrgency(impact, urgency, issue.type === "budget_pressure" ? 0.7 : 0.92);

    return buildPriorityItemBase({
      sourceType: "issue_fix",
      title: issue.title,
      impact,
      urgency,
      risk: "low",
      confidence: 0.9,
      score,
      sessionId: issue.sessionId,
      issueId: issue.id,
      rationale: issue.description,
      suggestedAction: "apply_now",
      availableActions: ["apply_now", "create_follow_up_task", "defer_to_backlog"],
      etaBusinessDays: issue.type === "compatibility_error" ? 1 : 2,
      reproducibility: "sometimes",
      dependencyEstimate: issue.type === "compatibility_error" ? "Option fitment filter" : "Rule check"
    });
  });

  const roadmapSignals = getFeatureSignals();
  const featureBuildCandidates: OpsBoardItem[] = roadmapSignals.map((signal) =>
    buildPriorityItemBase({
      sourceType: "feature_build",
      title: signal.title,
      impact: signal.impact,
      urgency: signal.urgency,
      risk: "low",
      confidence: signal.confidence,
      score: scoreByImpactUrgency(signal.impact, signal.urgency, signal.confidence),
      rationale: signal.rationale,
      suggestedAction: "create_follow_up_task",
      availableActions: ["create_follow_up_task", "defer_to_backlog"],
      etaBusinessDays: signal.etaBusinessDays
    })
  );

  const priorityQueue = [...fixCandidates, ...featureBuildCandidates]
    .sort((a, b) => {
      if (a.score === b.score) return b.confidence - a.confidence;
      return b.score - a.score;
    })
    .map((item) => ({
      ...item,
      priority: priorityLabel(item.score)
    }));

  return {
    sessionId,
    priorityQueue,
    fixCandidates,
    immediateFixes: priorityQueue.filter((item) => item.sourceType === "issue_fix" && (item.priority === "P0" || item.priority === "P1")),
    featureBuildCandidates,
    performanceBugs: getPerformanceBugs(),
    featureIdeas: getFeatureIdeas(),
    recentTransactions: store.recentTransactions.slice(0, 6),
    actionRecommendations: priorityQueue.map((item) =>
      item.sourceType === "issue_fix"
        ? `Apply ${item.title} for session ${item.sessionId ?? "N/A"}.`
        : `Create feature follow-up for ${item.title} (ETA ${item.etaBusinessDays ?? 0}d).`
    )
  };
}

function kpiCardsFromTotals(
  totals: {
    newRequests: number;
    configCompletion: number;
    blockedSessions: number;
    recentTransactionValue: number;
    submittedRate: number;
    conversionRate: number;
  }
): KpiCard[] {
  return [
    {
      id: "kpi-new-requests",
      title: "New requests",
      value: totals.newRequests,
      delta: "in demo flow",
      status: totals.newRequests > 0 ? "good" : "warning"
    },
    {
      id: "kpi-config-completion",
      title: "Config completion",
      value: `${totals.configCompletion}%`,
      status: totals.configCompletion >= 60 ? "good" : "warning"
    },
    {
      id: "kpi-blocked-sessions",
      title: "Blocked sessions",
      value: totals.blockedSessions,
      status: totals.blockedSessions > 0 ? "bad" : "good"
    },
    {
      id: "kpi-recent-transaction-value",
      title: "Recent transaction value",
      value: `$${totals.recentTransactionValue.toLocaleString()}`,
      status: totals.recentTransactionValue > 10000 ? "good" : "warning"
    },
    {
      id: "kpi-submitted-rate",
      title: "Submitted rate",
      value: `${totals.submittedRate}%`,
      status: totals.submittedRate >= 50 ? "good" : "warning"
    },
    {
      id: "kpi-conversion",
      title: "Conversion",
      value: `${totals.conversionRate}%`,
      status: totals.conversionRate >= 50 ? "good" : "warning"
    }
  ];
}

export function getKpis() {
  const sessions = Array.from(store.sessions.values());
  const totalSessions = sessions.length;
  const blockedSessions = sessions.filter((session) => session.status === "blocked").length;
  const submitted = sessions.filter((session) => session.status === "submitted").length;
  const resolved = sessions.filter((session) => session.status === "resolved").length;

  const configCompleted = sessions.filter((session) => session.journey.step >= 5).length;
  const configCompletion = totalSessions === 0 ? 0 : Math.round((configCompleted / totalSessions) * 100);
  const submittedRate = totalSessions === 0 ? 0 : Math.round((submitted / totalSessions) * 100);
  const conversionRate = totalSessions === 0 ? 0 : Math.round(((submitted + resolved) / totalSessions) * 100);
  const recentTransactionValue = store.recentTransactions.slice(0, 6).reduce((acc, tx) => acc + tx.amountUsd, 0);

  return {
    totalSessions,
    newRequests: totalSessions,
    submitted,
    blocked: blockedSessions,
    resolved,
    blockedSessions,
    configCompletion,
    submittedRate,
    conversionRate,
    recentTransactionValue,
    issueCount: store.issues.size
  };
}

export function assembleDashboardPayload(): PmDashboardPayload {
  const board = getOpsBoard();
  const kpis = getKpis();

  return {
    kpis: kpiCardsFromTotals({
      newRequests: kpis.newRequests,
      configCompletion: kpis.configCompletion,
      blockedSessions: kpis.blockedSessions,
      recentTransactionValue: kpis.recentTransactionValue,
      submittedRate: kpis.submittedRate,
      conversionRate: kpis.conversionRate
    }),
    performanceBugs: board.performanceBugs ?? [],
    featureIdeas: board.featureIdeas ?? [],
    recentTransactions: board.recentTransactions ?? []
  };
}

export function seedStateSummary() {
  return {
    vanCount: vans.length,
    optionCount: catalogOptions.length,
    activeSessions: store.sessions.size,
    activeIssues: store.issues.size,
    recentTransactionCount: store.recentTransactions.length
  };
}

export function resetDemoState() {
  store.sessions.clear();
  store.issues.clear();
  store.activeFixes.clear();
  store.recentTransactions = [];
  return { status: "reset" };
}
