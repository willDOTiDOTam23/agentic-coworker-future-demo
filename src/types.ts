export type Terrain = "mountain" | "beach" | "forest" | "winter" | "city" | "water";
export type Region = "NW" | "CA" | "CO" | "FL";
export type BudgetBand = "value" | "balanced" | "premium" | "luxury";
export type JourneyStep = 1 | 2 | 3 | 4 | 5;
export type PriorityLane = "P0" | "P1" | "P2";

export interface VanModel {
  id: string;
  name: string;
  basePrice: number;
  maxOccupancy: number;
  rangeKm: number;
  terrains: Terrain[];
  regions: Region[];
  features: string[];
  tags: string[];
  imageHint: string;
}

export interface OptionItem {
  id: string;
  name: string;
  description: string;
  deltaPrice: number;
  category: "propulsion" | "comfort" | "offroad" | "water";
  requiredTags: string[];
  incompatibleTags: string[];
  compatibilityNote: string;
}

export interface SessionLog {
  ts: string;
  event: string;
  message: string;
  severity: "info" | "warn" | "error";
}

export interface GuidedInputCaptureState {
  customerName: boolean;
  tripStyle: boolean;
  budgetBand: boolean;
  terrain: boolean;
  region: boolean;
}

export interface JourneyCard {
  id: string;
  title: string;
  body: string;
  badge?: "info" | "warning" | "success";
  chipHints?: string[];
}

export interface QuickAction {
  id: string;
  label: string;
  value: string;
}

export interface GuidedJourneyState {
  step: JourneyStep;
  nextQuestion: string;
  requiredInputs: string[];
  stepCards: JourneyCard[];
  quickActions: QuickAction[];
  completed: boolean;
}

export interface Session {
  id: string;
  customerName: string;
  budget: number;
  occupancy: number;
  terrain: Terrain;
  region: Region;
  tripStyle?: string;
  moods: string[];
  chosenVanId: string;
  selectedOptionIds: string[];
  totalPrice: number;
  status: "draft" | "needs_attention" | "submitted" | "blocked" | "resolved";
  journey: GuidedJourneyState;
  capturedInputs: GuidedInputCaptureState;
  logs: SessionLog[];
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  sessionId: string;
  type: "compatibility_error" | "budget_pressure" | "config_stall";
  title: string;
  description: string;
  severity: "medium" | "high";
  detectedAt: string;
  fixed: boolean;
  fixHint: string;
}

export interface RecoResult {
  van: VanModel;
  options: OptionItem[];
  estimatedPrice: number;
}

export interface OpsBoardItem {
  id: string;
  sourceType: "issue_fix" | "feature_build";
  priority: PriorityLane;
  title: string;
  impact: "high" | "medium" | "low";
  urgency: "high" | "medium" | "low";
  risk: "high" | "medium" | "low";
  confidence: number;
  score: number;
  rationale: string;
  sessionId?: string;
  issueId?: string;
  suggestedAction: "apply_now" | "create_follow_up_task" | "defer_to_backlog";
  availableActions: ("apply_now" | "create_follow_up_task" | "defer_to_backlog")[];
  etaBusinessDays?: number;
  dependencyEstimate?: string;
  reproducibility?: "rare" | "sometimes" | "reproducible";
}

export interface OpsBoardPayload {
  sessionId?: string;
  priorityQueue: OpsBoardItem[];
  fixCandidates: OpsBoardItem[];
  immediateFixes: OpsBoardItem[];
  featureBuildCandidates: OpsBoardItem[];
  actionRecommendations: string[];
}
