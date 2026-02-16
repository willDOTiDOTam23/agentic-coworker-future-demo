import { randomUUID } from "crypto";
import {
  BudgetBand,
  GuidedJourneyState,
  Issue,
  OptionItem,
  OpsBoardItem,
  OpsBoardPayload,
  PriorityLane,
  GuidedInputCaptureState,
  RecoResult,
  Region,
  Session,
  SessionLog,
  Terrain
} from "../types";
import { options, vans } from "./catalog";

interface StoreShape {
  sessions: Map<string, Session>;
  issues: Map<string, Issue>;
  activeFixes: Set<string>;
}

const BUDGET_BANDS: Record<BudgetBand, number> = {
  value: 52000,
  balanced: 82000,
  premium: 109000,
  luxury: 145000
};

const store: StoreShape = {
  sessions: new Map(),
  issues: new Map(),
  activeFixes: new Set()
};

function nowIso() {
  return new Date().toISOString();
}

const SAFE_DEFAULT_MOODS = ["family", "safety"];
const DEFAULT_CAPTURED_INPUTS: GuidedInputCaptureState = {
  customerName: true,
  tripStyle: true,
  budgetBand: true,
  terrain: true,
  region: true
};

function normalizeStringList(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)));
}

function effectiveMoods(values: string[]) {
  const normalized = normalizeStringList(values);
  return normalized.length > 0 ? normalized : SAFE_DEFAULT_MOODS;
}

function buildJourneyState(step: number, nextQuestion: string, requiredInputs: string[], stepCards: GuidedJourneyState["stepCards"], quickActions: GuidedJourneyState["quickActions"], completed: boolean): GuidedJourneyState {
  return {
    step: step as 1 | 2 | 3 | 4 | 5,
    nextQuestion,
    requiredInputs,
    stepCards,
    quickActions,
    completed
  };
}

function computeBudget(payload?: number, band?: BudgetBand) {
  if (payload && payload > 0) return payload;
  if (band && BUDGET_BANDS[band]) return BUDGET_BANDS[band];
  return BUDGET_BANDS.balanced;
}

function resolveCapturedInputs(payload: Pick<GuidedSessionInput, "customerName" | "tripStyle" | "budget" | "budgetBand" | "terrain" | "region">): GuidedInputCaptureState {
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

function scoreVan(van: (typeof vans)[number], budget: number, terrain: Terrain, region: Region, moods: string[]) {
  const resolvedMoods = effectiveMoods(moods);
  if (budget < van.basePrice) return -1;
  if (!van.regions.includes(region)) return -1;
  if (!van.terrains.includes(terrain) && !van.terrains.includes("city")) return -1;

  let score = 0;
  if (resolvedMoods.includes("family")) score += van.maxOccupancy > 3 ? 30 : 0;
  if (resolvedMoods.includes("luxury")) score += van.features.some((feature) => /smart|climate|pods|pod|roof|comfort/i.test(feature)) ? 25 : 0;
  if (resolvedMoods.includes("winter")) score += van.terrains.includes("winter") ? 35 : -20;
  if (resolvedMoods.includes("water")) score += van.tags.includes("water") ? 45 : -30;
  if (resolvedMoods.includes("adventure")) score += van.tags.includes("tracks") || van.tags.includes("offroad") ? 30 : 5;
  if (resolvedMoods.includes("safety")) score += van.features.some((feature) => /climate|pods|assist|safe/i.test(feature)) ? 20 : 10;

  return score;
}

function isCompatible(vanTags: string[], option: OptionItem, terrain: Terrain) {
  const hasRequired = option.requiredTags.every((tag) => vanTags.includes(tag));
  if (!hasRequired) {
    return false;
  }

  if (terrain === "winter" && option.incompatibleTags.includes("winter")) {
    return false;
  }

  if (terrain === "water" && option.incompatibleTags.includes("water")) {
    return false;
  }

  return true;
}

function buildRecommendation(vanTags: string[], terrain: Terrain, moods: string[]): RecoResult {
  const resolvedMoods = effectiveMoods(moods);
  const compatibleOptions = options
    .filter((option) => isCompatible(vanTags, option, terrain))
    .sort((a, b) => {
      const scoreA = a.deltaPrice;
      const scoreB = b.deltaPrice;
      const moodBoostA = a.requiredTags.some((tag) => tag === "water") && resolvedMoods.includes("water") ? -800 : 0;
      const moodBoostB = b.requiredTags.some((tag) => tag === "water") && resolvedMoods.includes("water") ? -800 : 0;
      return scoreA + moodBoostA - (scoreB + moodBoostB);
    });

  const sortedVans = [...vans]
    .sort((a, b) => a.basePrice - b.basePrice)
    .filter((van) => van.basePrice <= BUDGET_BANDS.luxury);

  const chosen = sortedVans[0] ?? vans[0];

  return {
    van: chosen,
    options: compatibleOptions,
    estimatedPrice: chosen.basePrice + compatibleOptions.reduce((acc, option) => acc + option.deltaPrice, 0)
  };
}

function recalculateChosenVan(payload: {
  budget: number;
  terrain: Terrain;
  region: Region;
  moods: string[];
}) {
  const resolvedMoods = effectiveMoods(payload.moods);
  const candidates = vans
    .map((van) => ({
      van,
      score: scoreVan(van, payload.budget, payload.terrain, payload.region, resolvedMoods)
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  return (candidates[0] ?? { van: vans[0], score: 0 }).van;
}

function summarizeForStepCards(session: Session): RecoResult {
  const chosenVan = vans.find((van) => van.id === session.chosenVanId) ?? vans[0];
  return buildRecommendation(chosenVan.tags, session.terrain, session.moods);
}

function computeJourneyCards(step: 1 | 2 | 3 | 4 | 5, session: Session, recommendation: RecoResult): GuidedJourneyState["stepCards"] {
  const summary = `Budget: $${session.budget.toLocaleString()} • Region: ${session.region} • Terrain: ${session.terrain} • Trip style: ${session.tripStyle ?? "general"}`;

  if (step === 1) {
    return [
      {
        id: "step-1",
        title: "Step 1: Customer context",
        body: `Tell us your context in one pass. ${summary}`,
        chipHints: ["Family", "Adventure", "Luxury", "Safety", "Water"],
        badge: "info"
      }
    ];
  }

  if (step === 2) {
    return [
      {
        id: "step-2",
        title: "Step 2: Preference capture",
        body: "Pick the vibe for this trip so we can tune fit fast.",
        chipHints: ["family", "adventure", "safety", "luxury", "winter", "water"],
        badge: "info"
      }
    ];
  }

  if (step === 3) {
    return [
      {
        id: "step-3-baseline",
        title: `Step 3: Baseline fit`,
        body: `${recommendation.van.name} selected. Why this is right: ${recommendation.van.features.slice(0, 2).join(", ")}`,
        chipHints: recommendation.van.tags,
        badge: "success"
      },
      {
        id: "step-3-total",
        title: "Budget readout",
        body: `Live baseline: $${recommendation.estimatedPrice.toLocaleString()}`,
        chipHints: [session.totalPrice > session.budget ? "Budget risk" : "In budget"],
        badge: session.totalPrice > session.budget ? "warning" : "success"
      }
    ];
  }

  if (step === 4) {
    const optionChips = recommendation.options.slice(0, 4).map((option) => `${option.name} (+$${option.deltaPrice})`);
    return [
      {
        id: "step-4-options",
        title: "Step 4: Upgrade stack",
        body: optionChips.length === 0 ? "No compatible options yet for this profile." : optionChips.join("  •  "),
        chipHints: recommendation.options.slice(0, 4).map((option) => option.name),
        badge: "warning"
      },
      {
        id: "step-4-savings",
        title: "Live total",
        body: `Total: $${session.totalPrice.toLocaleString()} / Budget: $${session.budget.toLocaleString()}`,
        badge: session.totalPrice > session.budget ? "warning" : "success"
      }
    ];
  }

  return [
    {
      id: "step-5-ready",
      title: "Step 5: Readiness check",
      body: "Final check-in. Submit to validate compatibility and budget before handoff.",
      badge: session.totalPrice > session.budget ? "warning" : "success"
    }
  ];
}

function buildJourneyStateForSession(session: Session): GuidedJourneyState {
  const capturedInputs = session.capturedInputs ?? DEFAULT_CAPTURED_INPUTS;
  const rec = summarizeForStepCards(session);
  const currentStepHint = session.journey?.step ?? 1;
  const hasStep1 = capturedInputs.customerName &&
    capturedInputs.tripStyle &&
    capturedInputs.budgetBand &&
    capturedInputs.terrain &&
    capturedInputs.region;
  const hasStep2 = hasStep1 && session.moods.length > 0;
  const missingStep1Fields = hasStep1
    ? []
    : [
        !capturedInputs.customerName ? "customerName" : null,
        !capturedInputs.tripStyle ? "tripStyle" : null,
        !capturedInputs.budgetBand ? "budgetBand" : null,
        !capturedInputs.terrain ? "terrain" : null,
        !capturedInputs.region ? "region" : null
      ].filter((field): field is string => Boolean(field));

  if (!hasStep1) {
    return buildJourneyState(
      1,
      `I need a couple details before we lock the fit: ${missingStep1Fields.length ? missingStep1Fields.join(", ") : "context"}.`,
      missingStep1Fields,
      computeJourneyCards(1, session, rec),
      [
        { id: "trip-adventure", label: "Adventure", value: "adventure" },
        { id: "trip-family", label: "Family", value: "family" },
        { id: "trip-luxury", label: "Luxury", value: "luxury" }
      ],
      false
    );
  }

  if (!hasStep2) {
    return buildJourneyState(
      2,
      "Pick your top preference: family, adventure, safety, luxury, or winter/water focus.",
      ["moods"],
      computeJourneyCards(2, session, rec),
      [
        { id: "use-defaults", label: "Use safe defaults", value: "use_default_preferences" },
        { id: "mood-family", label: "Family", value: "family" },
        { id: "mood-adventure", label: "Adventure", value: "adventure" },
        { id: "mood-safety", label: "Safety", value: "safety" },
        { id: "mood-luxury", label: "Luxury", value: "luxury" }
      ],
      false
    );
  }

  if (session.selectedOptionIds.length === 0) {
    if (currentStepHint >= 4) {
      return buildJourneyState(
        4,
        "Pick 3–4 upgrades, then submit for readiness check.",
        ["optionSelection"],
        computeJourneyCards(4, session, rec),
        [
          { id: "opt-family", label: "Optimize for family", value: "optimize_family" },
          { id: "opt-safety", label: "Optimize for safety", value: "optimize_safety" },
          { id: "opt-budget", label: "Optimize for budget", value: "optimize_budget" },
          { id: "skip-options", label: "Skip upgrades", value: "skip_to_submit" }
        ],
        true
      );
    }

    return buildJourneyState(
      3,
      "Baseline is ready. Tap to confirm and go to upgrade options.",
      ["optionSelection"],
      computeJourneyCards(3, session, rec),
      [
        { id: "show-options", label: "Show upgrade options", value: "show_options" }
      ],
      true
    );
  }

  return buildJourneyState(
    5,
    "You are at the final step. Ready to run the readiness check when you want to submit.",
    ["submit"],
    computeJourneyCards(5, session, rec),
    [
      { id: "safe-baseline", label: "Try safer baseline", value: "safe_baseline" },
      { id: "restart", label: "Start over", value: "start_over" },
      { id: "submit", label: "Submit for readiness check", value: "submit" }
    ],
    true
  );
}

function applyQuickAction(session: Session, action: string) {
  if (action === "start_over") {
    session.selectedOptionIds = [];
    session.journey.step = 1;
    session.tripStyle = "";
    session.capturedInputs = {
      customerName: false,
      tripStyle: false,
      budgetBand: false,
      terrain: false,
      region: false
    };
    const sessionIssues = getIssuesBySession(session.id);
    sessionIssues.forEach((issue) => {
      issue.fixed = true;
    });
    session.status = "draft";
    session.logs.push({ ts: nowIso(), event: "journey_reset", message: "Customer restarted the guided flow.", severity: "warn" });
    recalcSessionProjection(session);
    return;
  }

  if (action === "show_options") {
    session.journey.step = 4;
    session.logs.push({
      ts: nowIso(),
      event: "journey_step_advance",
      message: "Customer moved to upgrade options.",
      severity: "info"
    });
    return;
  }

  if (action === "skip_to_submit") {
    session.journey.step = 5;
    session.logs.push({
      ts: nowIso(),
      event: "journey_step_advance",
      message: "Customer skipped option selection.",
      severity: "info"
    });
    return;
  }

  if (action === "use_default_preferences") {
    session.moods = [...SAFE_DEFAULT_MOODS];
    session.journey.step = 3;
    session.logs.push({
      ts: nowIso(),
      event: "journey_step_advance",
      message: "Customer accepted safe default preferences.",
      severity: "info"
    });
    return;
  }

  if (action === "safe_baseline") {
    session.selectedOptionIds = [];
    const rec = summarizeForStepCards(session);
    session.totalPrice = rec.van.basePrice;
    session.journey.step = 5;
    session.logs.push({
      ts: nowIso(),
      event: "guidance_action",
      message: "Customer selected safer baseline configuration.",
      severity: "info"
    });
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
    const rec = summarizeForStepCards(session);
    const budgetCap = Math.max(session.budget - 8000, 0);
    session.budget = Math.min(session.budget, budgetCap || session.budget);
    session.totalPrice = rec.van.basePrice;
    session.selectedOptionIds = [];
    return;
  }
}

function recalcSessionProjection(session: Session) {
  const baseline = recalculateChosenVan({
    budget: session.budget,
    terrain: session.terrain,
    region: session.region,
    moods: session.moods
  });

  const rec = buildRecommendation(baseline.tags, session.terrain, session.moods);
  session.chosenVanId = baseline.id;
  session.totalPrice = rec.van.basePrice + session.selectedOptionIds
    .map((id) => options.find((option) => option.id === id)?.deltaPrice ?? 0)
    .reduce((acc, price) => acc + price, 0);
  session.journey = buildJourneyStateForSession(session);

  return rec;
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
}) {
  const normalizedMoods = normalizeStringList(payload.moods);
  const recommendedVan = recalculateChosenVan({
    budget: payload.budget,
    terrain: payload.terrain,
    region: payload.region,
    moods: normalizedMoods
  });

  const recommendation = buildRecommendation(recommendedVan.tags, payload.terrain, normalizedMoods);
  const id = randomUUID();

  const firstSession: Session = {
    id,
    customerName: payload.customerName || "Guest",
    budget: payload.budget,
    occupancy: payload.occupancy,
    terrain: payload.terrain,
    region: payload.region,
    tripStyle: payload.tripStyle,
    moods: normalizedMoods,
    chosenVanId: recommendedVan.id,
    selectedOptionIds: [],
    totalPrice: recommendation.van.basePrice,
    status: "draft",
    capturedInputs: payload.capturedInputs ?? DEFAULT_CAPTURED_INPUTS,
    journey: buildJourneyStateForSession({
      id,
      customerName: payload.customerName || "Guest",
      budget: payload.budget,
      occupancy: payload.occupancy,
      terrain: payload.terrain,
      region: payload.region,
      tripStyle: payload.tripStyle,
      moods: normalizedMoods,
      chosenVanId: recommendedVan.id,
      selectedOptionIds: [],
      totalPrice: recommendation.van.basePrice,
      status: "draft",
      capturedInputs: payload.capturedInputs ?? DEFAULT_CAPTURED_INPUTS,
      journey: {
        step: 1,
        nextQuestion: "",
        requiredInputs: [],
        stepCards: [],
        quickActions: [],
        completed: false
      },
      logs: [{
        ts: nowIso(),
        event: "session_created",
        message: "Session initialized",
        severity: "info"
      }],
      createdAt: nowIso(),
      updatedAt: nowIso()
    }),
    logs: [{
      ts: nowIso(),
      event: "session_created",
      message: "Session initialized",
      severity: "info"
    }],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  firstSession.journey = buildJourneyStateForSession(firstSession);
  store.sessions.set(id, firstSession);

  return {
    session: firstSession,
    recommendation,
    availableOptions: recommendation.options
  };
}

export interface GuidedSessionInput {
  customerName?: string;
  budget?: number;
  budgetBand?: BudgetBand;
  occupancy?: number;
  terrain?: Terrain;
  region?: Region;
  tripStyle?: string;
  moods?: string[];
}

export function startGuidedSession(payload: GuidedSessionInput) {
  const resolvedBudget = computeBudget(payload.budget, payload.budgetBand);
  const capturedInputs = resolveCapturedInputs(payload);
  const sessionPayload = {
    customerName: payload.customerName?.trim() ?? "",
    budget: resolvedBudget,
    occupancy: Math.max(1, payload.occupancy ?? 2),
    terrain: payload.terrain ?? "city",
    region: payload.region ?? "CO",
    moods: normalizeStringList(payload.moods),
    tripStyle: payload.tripStyle?.trim(),
    capturedInputs
  };

  const created = createSession(sessionPayload);
  created.session.journey = buildJourneyStateForSession(created.session);

  return {
    ...created,
    journeyState: created.session.journey,
    nextQuestion: created.session.journey.nextQuestion,
    requiredInputs: created.session.journey.requiredInputs,
    stepCards: created.session.journey.stepCards
  };
}

export interface GuidedSessionUpdate {
  sessionId: string;
  action?: "start_over" | "optimize_family" | "optimize_safety" | "optimize_budget" | "safe_baseline" | "show_options" | "skip_to_submit" | "use_default_preferences" | "submit";
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
}

export function refreshGuidedSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return null;

  recalcSessionProjection(session);
  session.updatedAt = nowIso();
  store.sessions.set(session.id, session);

  const recommendation = summarizeForStepCards(session);
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

export function advanceGuidedSession(payload: GuidedSessionUpdate) {
  const session = getSession(payload.sessionId);
  if (!session) return null;
  const capturedInputs = ensureCapturedInputs(session);
  let submitResult: ReturnType<typeof submitSession> | null = null;

  if (payload.customerName) {
    session.customerName = payload.customerName;
    capturedInputs.customerName = payload.customerName.trim().length > 0;
  }
  if (payload.tripStyle) {
    session.tripStyle = payload.tripStyle;
    capturedInputs.tripStyle = payload.tripStyle.trim().length > 0;
  }
  if (payload.terrain) {
    session.terrain = payload.terrain;
    capturedInputs.terrain = true;
  }
  if (payload.region) {
    session.region = payload.region;
    capturedInputs.region = true;
  }
  if (payload.occupancy) session.occupancy = payload.occupancy;
  if (payload.budgetBand || payload.budget) {
    session.budget = computeBudget(payload.budget, payload.budgetBand);
    capturedInputs.budgetBand = true;
  }
  if (payload.moods) {
    session.moods = normalizeStringList(payload.moods);
  }
  if (payload.optionIds) {
    session.selectedOptionIds = payload.optionIds.filter(Boolean);
  }
  if (payload.optionId) {
    const option = options.find((item) => item.id === payload.optionId);
    if (option) {
      const already = session.selectedOptionIds.includes(option.id);
      session.selectedOptionIds = already
        ? session.selectedOptionIds.filter((id) => id !== option.id)
        : session.selectedOptionIds.concat(option.id);
    }
  }

  if (payload.action) {
    applyQuickAction(session, payload.action);
  }

  const recommendation = recalcSessionProjection(session);
  const submissionError = payload.action === "submit" && session.journey.step < 5
    ? "Please complete the guided flow before submitting."
    : undefined;

  if (payload.action === "submit" && !submissionError) {
    submitResult = submitSession(payload.sessionId);
  }

  session.logs.push({
    ts: nowIso(),
    event: "guided_update",
    message: `Session updated via guided action (${payload.action ?? "field_update"}).`,
    severity: "info"
  });
  session.updatedAt = nowIso();
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

export function getSession(sessionId: string) {
  return store.sessions.get(sessionId) ?? null;
}

export function getCatalog() {
  return { vans, options };
}

export function setSelectedOption(sessionId: string, optionId: string) {
  const session = getSession(sessionId);
  if (!session) return null;

  const option = options.find((opt) => opt.id === optionId);
  if (!option) return null;

  const already = session.selectedOptionIds.includes(optionId);
  const nextOptions = already
    ? session.selectedOptionIds.filter((id) => id !== optionId)
    : [...session.selectedOptionIds, optionId];

  session.selectedOptionIds = nextOptions;
  session.totalPrice = vans.find((v) => v.id === session.chosenVanId)!.basePrice +
    nextOptions
      .map((id) => options.find((o) => o.id === id)?.deltaPrice ?? 0)
      .reduce((a, b) => a + b, 0);
  session.updatedAt = nowIso();
  session.journey = buildJourneyStateForSession(session);
  store.sessions.set(sessionId, session);

  return session;
}

function findConflicts(session: Session, vanId: string) {
  const van = vans.find((item) => item.id === vanId)!;
  const selectedOpts = options.filter((opt) => session.selectedOptionIds.includes(opt.id));
  const conflicts: SessionLog[] = [];

  if (selectedOpts.length === 0) return conflicts;

  const terrain = session.terrain;

  selectedOpts.forEach((opt) => {
    const missingRequired = opt.requiredTags.filter((tag) => {
      if (tag === "water") return !van.tags.includes("water");
      if (tag === "tracks") return !van.tags.includes("tracks");
      if (tag === "offroad") return !van.tags.includes("offroad") && !van.tags.includes("tracks");
      return !van.tags.includes(tag);
    });

    const incompatibleInTerrain = opt.incompatibleTags.includes(terrain);
    if (missingRequired.length > 0 || incompatibleInTerrain) {
      conflicts.push({
        ts: nowIso(),
        event: "compatibility_violation",
        severity: "error",
        message: `${opt.name} conflicts with current setup${missingRequired.length ? ` (missing: ${missingRequired.join(",")})` : ""}`
      });
    }
  });

  return conflicts;
}

function issueAlreadyOpen(sessionId: string, type: Issue["type"]) {
  return issueList().some((issue) => issue.sessionId === sessionId && issue.type === type && !issue.fixed);
}

export function submitSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return null;

  const conflicts = findConflicts(session, session.chosenVanId);
  if (conflicts.length > 0) {
    const issue: Issue = {
      id: randomUUID(),
      sessionId,
      type: "compatibility_error",
      title: "Configuration failed compatibility checks",
      description: "A selected option does not match the chosen vehicle profile for this terrain and build.",
      severity: "high",
      detectedAt: nowIso(),
      fixed: false,
      fixHint: "Enable region-aware compatibility re-check and suggest a compatible replacement option before submission."
    };

    session.status = "blocked";
    session.logs.push(...conflicts);
    session.logs.push({ ts: nowIso(), event: "session_blocked", message: "Validation failed", severity: "error" });

    if (!issueAlreadyOpen(sessionId, issue.type)) {
      store.issues.set(issue.id, issue);
    }

    return { session, issue, status: "blocked", conflicts };
  }

  if (session.totalPrice > session.budget) {
    const issue: Issue = {
      id: randomUUID(),
      sessionId,
      type: "budget_pressure",
      title: "Budget threshold exceeded",
      description: `Current configuration is $${session.totalPrice} for a budget of $${session.budget}.`,
      severity: "medium",
      detectedAt: nowIso(),
      fixed: false,
      fixHint: "Auto-demote one premium option, then recalc and re-submit"
    };
    session.status = "needs_attention";
    session.logs.push({ ts: nowIso(), event: "budget_pressure", message: issue.description, severity: "warn" });

    if (!issueAlreadyOpen(sessionId, issue.type)) {
      store.issues.set(issue.id, issue);
    }

    return { session, issue, status: "needs_attention" };
  }

  session.status = "submitted";
  session.logs.push({
    ts: nowIso(),
    event: "session_submitted",
    message: "Session submitted successfully",
    severity: "info"
  });

  return { session, status: "submitted" };
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
    session.selectedOptionIds = session.selectedOptionIds.filter((id) => {
      const selected = options.find((o) => o.id === id);
      if (!selected) return false;
      return !selected.incompatibleTags.includes(session.terrain);
    });

    const van = vans.find((item) => item.id === session.chosenVanId);
    session.totalPrice = (van?.basePrice ?? 0) + session.selectedOptionIds
      .map((id) => options.find((o) => o.id === id)?.deltaPrice ?? 0)
      .reduce((acc, price) => acc + price, 0);

    session.logs.push({
      ts: nowIso(),
      event: "compatibility_fix_applied",
      message: "Developer coworker removed invalid options and added a safe fallback configuration.",
      severity: "info"
    });
    issue.fixed = true;
    session.status = "resolved";
    session.journey = buildJourneyStateForSession(session);
    store.sessions.set(session.id, session);
  }

  if (issue.type === "budget_pressure") {
    session.selectedOptionIds = session.selectedOptionIds.slice(0, 1);
    const van = vans.find((item) => item.id === session.chosenVanId);
    const fallbackPrice =
      (van?.basePrice ?? 0) +
      session.selectedOptionIds
        .map((id) => options.find((o) => o.id === id)?.deltaPrice ?? 0)
        .reduce((acc, price) => acc + price, 0);
    session.totalPrice = fallbackPrice;
    issue.fixed = true;
    session.logs.push({
      ts: nowIso(),
      event: "budget_fix_applied",
      message: "Developer coworker removed lower-priority options to meet budget pressure.",
      severity: "info"
    });
    session.status = "resolved";
    session.journey = buildJourneyStateForSession(session);
    store.sessions.set(session.id, session);
  }

  store.activeFixes.add(issueId);
  return issue;
}

function priorityLabel(score: number): PriorityLane {
  if (score >= 320) return "P0";
  if (score >= 220) return "P1";
  return "P2";
}

function urgencyFactor(level: "high" | "medium" | "low") {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function impactFactor(level: "high" | "medium" | "low") {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function scoreByImpactUrgency(
  impact: "high" | "medium" | "low",
  urgency: "high" | "medium" | "low",
  confidence = 0.8
) {
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
    reproducibility: overrides.reproducibility
  };
}

export function getOpsBoard(sessionId?: string): OpsBoardPayload {
  const targetIssues = sessionId
    ? getIssuesBySession(sessionId)
    : issueList();

  const openIssues = targetIssues.filter((item) => !item.fixed);
  const fixCandidates: OpsBoardItem[] = openIssues.map((issue) => {
    const isBlocked = issue.sessionId ? getSession(issue.sessionId)?.status === "blocked" : false;
    const urgency = isBlocked ? "high" : issue.severity;
    const impact = issue.type === "compatibility_error" ? "high" : "medium";
    const score = scoreByImpactUrgency(impact, urgency, 0.92);

    return buildPriorityItemBase({
      sourceType: "issue_fix",
      priority: priorityLabel(score),
      title: issue.title,
      impact: issue.severity,
      urgency: urgency,
      risk: "low",
      confidence: 0.92,
      score,
      sessionId: issue.sessionId,
      issueId: issue.id,
      rationale: issue.description,
      suggestedAction: "apply_now",
      availableActions: ["apply_now", "create_follow_up_task", "defer_to_backlog"],
      etaBusinessDays: issue.type === "compatibility_error" ? 1 : 2,
      reproducibility: issue.type === "compatibility_error" ? "sometimes" : "always",
      dependencyEstimate: issue.type === "compatibility_error" ? "None required" : "Option reorder + fallback"
    });
  });

  const roadmapSignals = [
    {
      title: "Add compatibility preflight check in Step 2",
      rationale: "Users currently discover a compatibility issue after baseline selection. A step-2 warning improves first-pass confidence.",
      sourceType: "feature_build" as const,
      impact: "high",
      urgency: "medium",
      risk: "low",
      score: scoreByImpactUrgency("high", "medium", 0.87),
      confidence: 0.87,
      etaBusinessDays: 5
    },
    {
      title: "Introduce budget guardrails in option picker",
      rationale: "Option chips should disable or reorder options that exceed the live budget by default.",
      sourceType: "feature_build" as const,
      impact: "medium",
      urgency: "medium",
      risk: "low",
      score: scoreByImpactUrgency("medium", "medium", 0.82),
      confidence: 0.82,
      etaBusinessDays: 4
    },
    {
      title: "Auto-generate one-click follow-up stories from repeated P0 defects",
      rationale: "Each blocked session should optionally create a prefilled operations backlog ticket for the dev coworker.",
      sourceType: "feature_build" as const,
      impact: "medium",
      urgency: "low",
      risk: "medium",
      score: scoreByImpactUrgency("medium", "low", 0.74),
      confidence: 0.74,
      etaBusinessDays: 8
    }
  ];

  const featureBuildCandidates: OpsBoardItem[] = roadmapSignals
    .map((signal) =>
      buildPriorityItemBase({
        sourceType: "feature_build",
        ...signal,
        title: signal.title,
        rationale: signal.rationale,
        suggestedAction: "create_follow_up_task",
        availableActions: ["create_follow_up_task", "defer_to_backlog"]
      })
    )
    .filter((item) => true);

  const priorityQueue = [...fixCandidates, ...featureBuildCandidates]
    .sort((a, b) => {
      if (b.score === a.score) {
        return b.confidence - a.confidence;
      }
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
    actionRecommendations: priorityQueue.map((item) =>
      item.sourceType === "issue_fix"
        ? `Bug fix: Apply ${item.title} now for session ${item.sessionId ?? "N/A"} (${item.etaBusinessDays ?? 0} day ETA).`
        : `Feature idea: Create follow-up task for ${item.title} (${item.etaBusinessDays ?? 0} day ETA).`
    )
  };
}

export function getKpis() {
  const total = store.sessions.size;
  const submitted = Array.from(store.sessions.values()).filter((s) => s.status === "submitted").length;
  const blocked = Array.from(store.sessions.values()).filter((s) => s.status === "blocked").length;
  const resolved = Array.from(store.sessions.values()).filter((s) => s.status === "resolved").length;
  return {
    totalSessions: total,
    submitted,
    blocked,
    resolved,
    issueCount: store.issues.size
  };
}

export function seedStateSummary() {
  return {
    vanCount: vans.length,
    optionCount: options.length,
    activeSessions: store.sessions.size,
    activeIssues: store.issues.size
  };
}

export function resetDemoState() {
  store.sessions.clear();
  store.issues.clear();
  store.activeFixes.clear();
  return { status: "reset" };
}
