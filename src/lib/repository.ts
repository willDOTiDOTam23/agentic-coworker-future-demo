import type { Database } from "better-sqlite3";
import {
  type AgentEvent,
  type ArtifactRecord,
  type ConfigurationDetail,
  type ConfigurationListItem,
  type ConfigurationSession,
  type ConfigurationState,
  type VisualizationSpec,
  createDefaultConfigurationState,
  createDefaultTheme,
  getStepIdForNumber,
  getStepNumber,
  type SessionStatus,
  type StepId,
  type ThemeState
} from "./domain.js";
import type { SaveConfigurationStepInput } from "./schemas.js";
import { deriveVisualizationSpec, VisualizationSpecSchema } from "./visualization.js";

function now(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function hydrateSession(row: Record<string, unknown>): ConfigurationSession {
  return {
    id: String(row.id),
    status: row.status as SessionStatus,
    currentStep: Number(row.current_step),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    theme: parseJson<ThemeState>(String(row.theme_json), createDefaultTheme()),
    state: parseJson<ConfigurationState>(String(row.state_json), createDefaultConfigurationState()),
    latestConfidence: row.latest_confidence === null || row.latest_confidence === undefined ? null : Number(row.latest_confidence)
  };
}

export class StepSequenceError extends Error {
  readonly expectedStep: StepId;
  readonly receivedStep: StepId;

  constructor(expectedStep: StepId, receivedStep: StepId) {
    super(`Expected to save ${expectedStep} next, but received ${receivedStep}.`);
    this.name = "StepSequenceError";
    this.expectedStep = expectedStep;
    this.receivedStep = receivedStep;
  }
}

export class SqliteRepository {
  constructor(private readonly db: Database) {}

  private persistVisualSpec(sessionId: string, visualSpec: VisualizationSpec) {
    this.db
      .prepare(
        `
          UPDATE config_sessions
          SET visual_spec_json = @visual_spec_json,
              visual_updated_at = @visual_updated_at
          WHERE id = @id
        `
      )
      .run({
        id: sessionId,
        visual_spec_json: JSON.stringify(visualSpec),
        visual_updated_at: visualSpec.updatedAt
      });

    return visualSpec;
  }

  createSession(sessionId: string): ConfigurationSession {
    const createdAt = now();
    const theme = createDefaultTheme();
    const state = createDefaultConfigurationState();

    this.db
      .prepare(
        `INSERT INTO config_sessions (
          id, status, current_step, state_json, theme_json, visual_spec_json, visual_updated_at, latest_confidence, created_at, updated_at, submitted_at
        ) VALUES (
          @id, 'draft', 1, @state_json, @theme_json, @visual_spec_json, @visual_updated_at, NULL, @created_at, @updated_at, NULL
        )`
      )
      .run({
        id: sessionId,
        state_json: JSON.stringify(state),
        theme_json: JSON.stringify(theme),
        visual_spec_json: null,
        visual_updated_at: null,
        created_at: createdAt,
        updated_at: createdAt
      });

    const session: ConfigurationSession = {
      id: sessionId,
      status: "draft",
      currentStep: 1,
      createdAt,
      updatedAt: createdAt,
      submittedAt: null,
      theme,
      state,
      latestConfidence: null
    };

    this.persistVisualSpec(sessionId, deriveVisualizationSpec(session));

    return session;
  }

  getSession(sessionId: string): ConfigurationSession | null {
    const row = this.db
      .prepare("SELECT * FROM config_sessions WHERE id = ?")
      .get(sessionId) as Record<string, unknown> | undefined;

    return row ? hydrateSession(row) : null;
  }

  getConfigurationDetail(sessionId: string): ConfigurationDetail | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const visualSpec = this.getVisualSpec(sessionId) ?? this.refreshVisualSpec(sessionId);

    const turns = this.db
      .prepare("SELECT * FROM conversation_turns WHERE session_id = ? ORDER BY created_at DESC, id DESC")
      .all(sessionId)
      .map((row) => ({
        id: Number((row as Record<string, unknown>).id),
        sessionId: String((row as Record<string, unknown>).session_id),
        speaker: (row as Record<string, unknown>).speaker as "customer" | "assistant" | "system",
        text: String((row as Record<string, unknown>).text),
        step: ((row as Record<string, unknown>).step as StepId | null) ?? null,
        createdAt: String((row as Record<string, unknown>).created_at)
      }));

    const agentEvents = this.db
      .prepare("SELECT * FROM agent_events WHERE session_id = ? ORDER BY created_at DESC, id DESC")
      .all(sessionId)
      .map((row) => ({
        id: Number((row as Record<string, unknown>).id),
        sessionId: String((row as Record<string, unknown>).session_id),
        agentName: String((row as Record<string, unknown>).agent_name),
        eventType: String((row as Record<string, unknown>).event_type),
        status: String((row as Record<string, unknown>).status),
        displayText: String((row as Record<string, unknown>).display_text),
        details: (row as Record<string, unknown>).details_json
          ? parseJson<Record<string, unknown>>(String((row as Record<string, unknown>).details_json), {})
          : null,
        createdAt: String((row as Record<string, unknown>).created_at)
      })) satisfies AgentEvent[];

    return {
      session,
      turns,
      agentEvents,
      visualSpec
    };
  }

  getVisualSpec(sessionId: string): VisualizationSpec | null {
    const row = this.db
      .prepare("SELECT visual_spec_json FROM config_sessions WHERE id = ?")
      .get(sessionId) as { visual_spec_json?: string | null } | undefined;

    if (!row?.visual_spec_json) {
      return null;
    }

    const parsed = parseJson<unknown>(row.visual_spec_json, null);
    const result = VisualizationSpecSchema.safeParse(parsed);
    return result.success ? result.data : null;
  }

  saveVisualSpec(sessionId: string, visualSpec: VisualizationSpec) {
    return this.persistVisualSpec(sessionId, VisualizationSpecSchema.parse(visualSpec));
  }

  refreshVisualSpec(sessionId: string) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    const nextSpec = deriveVisualizationSpec(session, this.getVisualSpec(sessionId));
    return this.persistVisualSpec(sessionId, nextSpec);
  }

  listSessions(): ConfigurationListItem[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            s.*,
            COUNT(DISTINCT a.id) AS artifact_count,
            MAX(e.created_at) AS last_event_at
          FROM config_sessions s
          LEFT JOIN artifacts a ON a.session_id = s.id
          LEFT JOIN agent_events e ON e.session_id = s.id
          GROUP BY s.id
          ORDER BY s.updated_at DESC
        `
      )
      .all() as Record<string, unknown>[];

    return rows.map((row) => ({
      ...hydrateSession(row),
      artifactCount: Number(row.artifact_count ?? 0),
      lastEventAt: row.last_event_at ? String(row.last_event_at) : null
    }));
  }

  saveStep(sessionId: string, input: SaveConfigurationStepInput): ConfigurationSession {
    const current = this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    const activeStep = getStepIdForNumber(current.currentStep);
    const incomingStepNumber = getStepNumber(input.step);
    const activeStepNumber = getStepNumber(activeStep);

    if (incomingStepNumber > activeStepNumber) {
      throw new StepSequenceError(activeStep, input.step);
    }

    const mergedState = {
      ...current.state,
      [input.step]: {
        ...current.state[input.step],
        ...input.values
      }
    };

    const mergedTheme = {
      ...current.theme,
      visualTone:
        activeStep === "exterior" && input.step === "exterior"
          ? input.visualTone ?? current.theme.visualTone
          : current.theme.visualTone,
      paletteChoice:
        activeStep === "exterior" && input.step === "exterior"
          ? input.paletteChoice ?? current.theme.paletteChoice
          : current.theme.paletteChoice
    };

    const updatedAt = now();
    const currentStep =
      input.step === activeStep && current.currentStep < 5 ? current.currentStep + 1 : current.currentStep;

    this.db
      .prepare(
        `
          UPDATE config_sessions
          SET current_step = @current_step,
              state_json = @state_json,
              theme_json = @theme_json,
              updated_at = @updated_at
          WHERE id = @id
        `
      )
      .run({
        id: sessionId,
        current_step: currentStep,
        state_json: JSON.stringify(mergedState),
        theme_json: JSON.stringify(mergedTheme),
        updated_at: updatedAt
      });

    if (input.summary) {
      this.db
        .prepare(
          `
            INSERT INTO conversation_turns (session_id, speaker, text, step, created_at)
            VALUES (@session_id, 'customer', @text, @step, @created_at)
          `
        )
        .run({
          session_id: sessionId,
          text: input.summary,
          step: input.step,
          created_at: updatedAt
        });
    }

    return this.getSession(sessionId)!;
  }

  submitSession(sessionId: string): ConfigurationSession {
    const current = this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    const submittedAt = now();
    this.db
      .prepare(
        `
          UPDATE config_sessions
          SET status = 'submitted',
              current_step = 5,
              submitted_at = @submitted_at,
              updated_at = @updated_at
          WHERE id = @id
        `
      )
      .run({
        id: sessionId,
        submitted_at: submittedAt,
        updated_at: submittedAt
      });

    return this.getSession(sessionId)!;
  }

  updateLatestConfidence(sessionId: string, confidenceScore: number) {
    this.db
      .prepare(
        `
          UPDATE config_sessions
          SET latest_confidence = @latest_confidence,
              updated_at = @updated_at
          WHERE id = @id
        `
      )
      .run({
        id: sessionId,
        latest_confidence: confidenceScore,
        updated_at: now()
      });
  }

  addAgentEvent(input: {
    sessionId: string;
    agentName: string;
    eventType: string;
    status: string;
    displayText: string;
    details?: Record<string, unknown>;
  }): AgentEvent {
    const createdAt = now();
    const result = this.db
      .prepare(
        `
          INSERT INTO agent_events (session_id, agent_name, event_type, status, display_text, details_json, created_at)
          VALUES (@session_id, @agent_name, @event_type, @status, @display_text, @details_json, @created_at)
        `
      )
      .run({
        session_id: input.sessionId,
        agent_name: input.agentName,
        event_type: input.eventType,
        status: input.status,
        display_text: input.displayText,
        details_json: input.details ? JSON.stringify(input.details) : null,
        created_at: createdAt
      });

    return {
      id: Number(result.lastInsertRowid),
      sessionId: input.sessionId,
      agentName: input.agentName,
      eventType: input.eventType,
      status: input.status,
      displayText: input.displayText,
      details: input.details ?? null,
      createdAt
    };
  }

  addSystemTurn(sessionId: string, speaker: "assistant" | "system", text: string, step: StepId | null = null) {
    this.db
      .prepare(
        `
          INSERT INTO conversation_turns (session_id, speaker, text, step, created_at)
          VALUES (@session_id, @speaker, @text, @step, @created_at)
        `
      )
      .run({
        session_id: sessionId,
        speaker,
        text,
        step,
        created_at: now()
      });
  }

  createArtifact(input: {
    sessionId: string;
    agentName: string;
    templateType: ArtifactRecord["templateType"];
    renderedContent: string;
  }): ArtifactRecord {
    const createdAt = now();
    const result = this.db
      .prepare(
        `
          INSERT INTO artifacts (session_id, agent_name, template_type, rendered_content, created_at)
          VALUES (@session_id, @agent_name, @template_type, @rendered_content, @created_at)
        `
      )
      .run({
        session_id: input.sessionId,
        agent_name: input.agentName,
        template_type: input.templateType,
        rendered_content: input.renderedContent,
        created_at: createdAt
      });

    return {
      id: Number(result.lastInsertRowid),
      sessionId: input.sessionId,
      agentName: input.agentName,
      templateType: input.templateType,
      renderedContent: input.renderedContent,
      createdAt
    };
  }

  listArtifacts(sessionId: string): ArtifactRecord[] {
    return this.db
      .prepare("SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at DESC, id DESC")
      .all(sessionId)
      .map((row) => ({
        id: Number((row as Record<string, unknown>).id),
        sessionId: String((row as Record<string, unknown>).session_id),
        agentName: String((row as Record<string, unknown>).agent_name),
        templateType: (row as Record<string, unknown>).template_type as ArtifactRecord["templateType"],
        renderedContent: String((row as Record<string, unknown>).rendered_content),
        createdAt: String((row as Record<string, unknown>).created_at)
      }));
  }

  reset() {
    this.db.exec(`
      DELETE FROM artifacts;
      DELETE FROM agent_events;
      DELETE FROM conversation_turns;
      DELETE FROM config_sessions;
    `);
  }
}
