export interface SseEventPayload {
  type:
    | "agent_started"
    | "agent_status"
    | "agent_handoff"
    | "tool_started"
    | "tool_completed"
    | "artifact_ready"
    | "agent_completed"
    | "agent_failed";
  sessionId: string;
  agentName: string;
  runId: string;
  status?: string;
  detail?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class SseBroker {
  private readonly clients = new Set<import("express").Response>();

  addClient(response: import("express").Response) {
    this.clients.add(response);
  }

  removeClient(response: import("express").Response) {
    this.clients.delete(response);
  }

  broadcast(payload: SseEventPayload) {
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      client.write(message);
    }
  }
}

