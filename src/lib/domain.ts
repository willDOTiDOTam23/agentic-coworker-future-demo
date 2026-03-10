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

