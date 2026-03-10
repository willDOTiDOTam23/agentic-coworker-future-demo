import type {
  ArtifactRecord,
  ConfigurationDetail,
  ConfigurationListItem,
  ConfigurationSession,
  VisualizationSpec
} from "../../lib/domain.js";
import type { SaveConfigurationStepInput } from "../../lib/schemas.js";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { error?: string };
      throw new Error(parsed.error || `Request failed with status ${response.status}`);
    } catch {
      throw new Error(body || `Request failed with status ${response.status}`);
    }
  }

  return response.json() as Promise<T>;
}

export interface RealtimeSessionResponse {
  sessionId: string;
  clientSecret: string;
  expiresAt: number;
  session: Record<string, unknown>;
}

export async function createRealtimeSession() {
  const response = await fetch("/api/realtime/session", {
    method: "POST"
  });

  return parseJson<RealtimeSessionResponse>(response);
}

export async function getConfigurations() {
  const response = await fetch("/api/configurations");
  return parseJson<{ items: ConfigurationListItem[] }>(response);
}

export async function getConfiguration(sessionId: string) {
  const response = await fetch(`/api/configurations/${sessionId}`);
  return parseJson<ConfigurationDetail>(response);
}

export async function getArtifacts(sessionId: string) {
  const response = await fetch(`/api/configurations/${sessionId}/artifacts`);
  return parseJson<{ items: ArtifactRecord[] }>(response);
}

export async function saveConfigurationStep(sessionId: string, payload: SaveConfigurationStepInput) {
  const response = await fetch(`/api/configurations/${sessionId}/steps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseJson<{ session: ConfigurationSession; visualSpec: VisualizationSpec }>(response);
}

export async function submitConfiguration(sessionId: string) {
  const response = await fetch(`/api/configurations/${sessionId}/submit`, {
    method: "POST"
  });

  return parseJson<{ session: ConfigurationSession; visualSpec: VisualizationSpec }>(response);
}

export async function resetDemo() {
  const response = await fetch("/api/admin/reset", {
    method: "POST"
  });

  return parseJson<{ ok: true }>(response);
}
