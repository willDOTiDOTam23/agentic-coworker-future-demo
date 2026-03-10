export type Terrain = "mountain" | "beach" | "forest" | "winter" | "city" | "water";
export type Region = "NW" | "CA" | "CO" | "FL";
export type BudgetBand = "value" | "balanced" | "premium" | "luxury";
export type JourneyStep = 1 | 2 | 3 | 4 | 5;
export type PriorityLane = "P0" | "P1" | "P2";
export type ExteriorPaint = "paint-warm-sand" | "paint-matte-graphite" | "paint-forest-olive" | "paint-arctic-white";
export type RoofRackStyle = "rack-sleek" | "rack-touring" | "rack-rugged";
export type WheelStyle = "wheel-all-terrain" | "wheel-urban" | "wheel-slick";
export type LightStyle = "light-led" | "light-auxiliary" | "light-spotlight";
export type InteriorLevel = "basic-empty" | "minimal-build-out" | "moderate-build-out" | "ultra-luxury-build-out";
export type LifestyleMode = "true-adventure" | "relax" | "work-from-home" | "play-hard" | "nomad" | "digital";
export type Drivetrain = "internal-combustion" | "hybrid" | "all-electric";

export interface VanTemplate {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  tags: string[];
  styleHint: string;
  imagePrompt?: string;
  imageStyleKey?: string;
}

export interface ExteriorConfig {
  paintColor: ExteriorPaint;
  roofRack: RoofRackStyle;
  wheels: WheelStyle;
  lights: LightStyle;
}

export interface InteriorConfig {
  level: InteriorLevel;
  lifestyleMode: LifestyleMode;
}

export interface PowerConfig {
  drivetrain: Drivetrain;
}

export interface AccessoryConfig {
  selectedAccessoryIds: string[];
}

export interface ConfiguratorProfile {
  exterior: ExteriorConfig;
  interior: InteriorConfig;
  power: PowerConfig;
  accessories: AccessoryConfig;
  totalPrice: number;
}

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
  imagePath?: string;
}

export interface VisualAssetPrompt {
  prompt: string;
  styleKey: string;
  seedHint?: string;
  generatedAt: string;
  modelHint: string;
  palette: string;
  sourceUrl?: string;
  license?: "unsplash" | "pexels" | "pixabay" | "cc0" | "other";
  attributionRequired?: boolean;
  sourceNote?: string;
}

export type VisualSubjectType = "van_exterior" | "van_interior" | "accessory_detail" | "lifestyle_scene" | "unknown";
export type VisualSceneType = "hero" | "detail" | "in_use" | "studio" | "unknown";
export type VisualAccessoryType =
  | "none"
  | "solar_panels"
  | "shower_module"
  | "fridge_module"
  | "bike_rack"
  | "ski_rack"
  | "gear_locker"
  | "roof_rack"
  | "awning"
  | "storage_module"
  | "unknown";
export type VisualAngleType = "front_three_quarter" | "side_profile" | "rear_three_quarter" | "interior_wide" | "close_up" | "unknown";
export type VisualEnvironmentType = "mountain" | "forest" | "desert" | "coastal" | "urban" | "studio" | "unknown";
export type VisualLightingType = "daylight" | "golden_hour" | "overcast" | "night" | "studio" | "unknown";
export type VisualOccupancySignal = "people_present" | "family_context" | "empty_scene" | "unknown";
export type VisualColorwayType = "warm_sand" | "graphite" | "olive" | "arctic_white" | "mixed" | "unknown";
export type VisualStyleToneType = "rugged" | "premium" | "minimal" | "sport" | "relaxed" | "unknown";

export interface VisualTaxonomy {
  subjectType: VisualSubjectType;
  sceneType: VisualSceneType;
  accessoryType: VisualAccessoryType;
  angle: VisualAngleType;
  environment: VisualEnvironmentType;
  lighting: VisualLightingType;
  occupancySignal: VisualOccupancySignal;
  colorway: VisualColorwayType;
  styleTone: VisualStyleToneType;
  qualityScore: number;
}

export interface VisualRightsMetadata {
  owner: string;
  usageScope: string;
  attributionRequired: boolean;
  source: string;
}

export interface VisualDerivativeSet {
  hero?: string;
  card?: string;
  thumb?: string;
  source?: string;
}

export interface VisualAssetRecord {
  assetId: string;
  assetType: "template" | "option" | "source";
  imagePath: string;
  prompt?: string;
  style?: VisualAssetPrompt;
  taxonomy: VisualTaxonomy;
  rights: VisualRightsMetadata;
  derivatives?: VisualDerivativeSet;
  sourceFile?: string;
  generatedFromIngestion?: boolean;
  sourceUrl?: string;
  license?: "unsplash" | "pexels" | "pixabay" | "cc0" | "other";
  attributionRequired?: boolean;
  sourceNote?: string;
}

export interface VisualSelectionPayload {
  heroTemplateAssetIds: string[];
  templateAssetByTemplateId: Record<string, string>;
  accessoryAssetByOptionId: Record<string, string>;
  fallbackAccessoryImagePath: string;
}

export interface VisualManifestPayload {
  generatedAt: string;
  sourceDropFolder: string;
  rightsFile: string;
  excludedAssets: Array<{ file: string; reason: string }>;
  assets: VisualAssetRecord[];
  selections: VisualSelectionPayload;
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
  templateId?: string;
  isFromScratch: boolean;
  config: ConfiguratorProfile;
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

export interface KpiCard {
  id: string;
  title: string;
  value: string | number;
  delta?: string;
  status: "good" | "warning" | "bad";
}

export interface PerformanceBugCard {
  id: string;
  title: string;
  impact: "high" | "medium" | "low";
  rationale: string;
  sessionId?: string;
  issueId?: string;
}

export interface FeatureIdeaCard {
  id: string;
  title: string;
  rationale: string;
  confidence: number;
  estimatedImpact: "high" | "medium" | "low";
  etaBusinessDays: number;
}

export interface RecentTransaction {
  id: string;
  sessionId: string;
  sessionLabel: string;
  amountUsd: number;
  createdAt: string;
  status: "submitted" | "reversed";
}

export interface PmDashboardPayload {
  kpis: KpiCard[];
  performanceBugs: PerformanceBugCard[];
  featureIdeas: FeatureIdeaCard[];
  recentTransactions: RecentTransaction[];
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
  performanceBugs?: PerformanceBugCard[];
  featureIdeas?: FeatureIdeaCard[];
  recentTransactions?: RecentTransaction[];
  actionRecommendations: string[];
}
