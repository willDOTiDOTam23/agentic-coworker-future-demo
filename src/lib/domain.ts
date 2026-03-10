export const STEP_DEFINITIONS = [
  { id: "vision", label: "Vision and use case" },
  { id: "exterior", label: "Exterior spec" },
  { id: "interior", label: "Interior spec" },
  { id: "layout", label: "Layout and sleeping" },
  { id: "gear", label: "Gear, review, and submit" }
] as const;

export type StepId = (typeof STEP_DEFINITIONS)[number]["id"];

export type SessionStatus = "draft" | "submitted";

export type ConfigurationValues = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

export interface ThemeState {
  paletteChoice: string;
  visualTone: string;
}

export type LayoutZoneKind =
  | "driver"
  | "passenger"
  | "galley"
  | "storage"
  | "dinette"
  | "bed"
  | "bath"
  | "utility";

export interface VisualizationTheme {
  paletteName: string;
  backgroundLocked: boolean;
  requestedExteriorColor: string;
  resolvedExteriorColor: string;
  backgroundA: string;
  backgroundB: string;
  accent: string;
  accentAlt: string;
  ink: string;
  bodyColor: string;
  cabinColor: string;
}

export interface StepRailItem {
  step: StepId;
  label: string;
  state: "complete" | "current" | "upcoming";
}

export interface VisionHighlights {
  title: string;
  summary: string;
  chips: string[];
}

export interface ExteriorScene {
  requestedColor: string;
  renderColor: string;
  bodyColor: string;
  finish: string;
  wheelRadius: number;
  wheelStyle: string;
  wheelVariant: "compact" | "touring" | "off-road";
  rackStyle: string;
  auxLights: string;
  powertrain: string;
  driveSide: "left" | "right";
  frontSeatConfig: string;
  roofGear: string;
  rearCarrier: string;
  ladder: boolean;
  campLighting: string;
  showRack: boolean;
  showAuxLights: boolean;
  showRearCarrier: boolean;
  showLadder: boolean;
  suspensionLift: number;
  badges: string[];
  overlays: string[];
}

export interface InteriorSwatches {
  fixtureColor: string;
  primaryTexture: string;
  secondaryTexture: string;
  stitchingColor: string;
  seatFinish: string;
  notes: string[];
}

export interface LayoutZone {
  kind: LayoutZoneKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  shortLabel: string;
  emphasis: "primary" | "secondary" | "support";
}

export interface LayoutLegendItem {
  kind: LayoutZoneKind;
  label: string;
  shortLabel: string;
  emphasis: "primary" | "secondary" | "support";
}

export interface LayoutFloorplan {
  gridColumns: number;
  gridRows: number;
  driveSide: "left" | "right";
  frontSeatConfig: string;
  notes: string[];
  zones: LayoutZone[];
  legend: LayoutLegendItem[];
}

export interface GearModule {
  id: string;
  label: string;
  detail: string;
  status: "active" | "optional" | "inactive";
}

export interface GearScene {
  roofGear: string;
  rearCarrier: string;
  ladder: boolean;
  powerModule: string;
  campLighting: string;
  attachmentStates: Array<{
    id: string;
    label: string;
    active: boolean;
  }>;
  modules: GearModule[];
}

export interface VisualizationSpec {
  generatedBy: "deterministic" | "agent";
  updatedAt: string;
  currentStep: StepId;
  theme: VisualizationTheme;
  stepRail: StepRailItem[];
  visionHighlights: VisionHighlights;
  exteriorScene: ExteriorScene;
  interiorSwatches: InteriorSwatches;
  layoutFloorplan: LayoutFloorplan;
  gearScene: GearScene;
}

export interface ConfigurationState {
  vision: ConfigurationValues;
  exterior: ConfigurationValues;
  interior: ConfigurationValues;
  layout: ConfigurationValues;
  gear: ConfigurationValues;
}

export interface ConfigurationSession {
  id: string;
  status: SessionStatus;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  theme: ThemeState;
  state: ConfigurationState;
  latestConfidence: number | null;
}

export interface ConversationTurn {
  id: number;
  sessionId: string;
  speaker: "customer" | "assistant" | "system";
  text: string;
  step: StepId | null;
  createdAt: string;
}

export interface AgentEvent {
  id: number;
  sessionId: string;
  agentName: string;
  eventType: string;
  status: string;
  displayText: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ArtifactRecord {
  id: number;
  sessionId: string;
  agentName: string;
  templateType: "design-brief" | "supply-order";
  renderedContent: string;
  createdAt: string;
}

export interface ConfigurationDetail {
  session: ConfigurationSession;
  turns: ConversationTurn[];
  agentEvents: AgentEvent[];
  visualSpec: VisualizationSpec;
}

export interface ConfigurationListItem extends ConfigurationSession {
  artifactCount: number;
  lastEventAt: string | null;
}

export function createDefaultTheme(): ThemeState {
  return {
    paletteChoice: "Stone Glacier",
    visualTone: "Modern expedition"
  };
}

export function createDefaultConfigurationState(): ConfigurationState {
  return {
    vision: {},
    exterior: {},
    interior: {},
    layout: {},
    gear: {}
  };
}

export function getStepNumber(stepId: StepId): number {
  return STEP_DEFINITIONS.findIndex((step) => step.id === stepId) + 1;
}

export function getStepLabel(stepId: StepId): string {
  return STEP_DEFINITIONS.find((step) => step.id === stepId)?.label ?? stepId;
}

export function getStepIdForNumber(stepNumber: number): StepId {
  return STEP_DEFINITIONS[Math.min(Math.max(stepNumber - 1, 0), STEP_DEFINITIONS.length - 1)]?.id ?? "vision";
}
