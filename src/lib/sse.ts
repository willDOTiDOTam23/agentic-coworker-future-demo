export interface SseEventPayload {
  type:
    | "agent_started"
    | "agent_status"
    | "agent_handoff"
    | "tool_started"
    | "tool_completed"
    | "artifact_ready"
    | "agent_completed"
    | "agent_failed"
    | "visual_spec_updated"
    | "session_updated";
  sessionId: string;
  agentName: string;
  runId: string;
  status?: string;
  detail?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class SseBroker {
  private readonly clients = new Map<
    import("express").Response,
    ((payload: SseEventPayload) => boolean) | undefined
  >();

  addClient(response: import("express").Response, predicate?: (payload: SseEventPayload) => boolean) {
    this.clients.set(response, predicate);
  }

  removeClient(response: import("express").Response) {
    this.clients.delete(response);
  }

  broadcast(payload: SseEventPayload) {
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const [client, predicate] of this.clients) {
      if (predicate && !predicate(payload)) {
        continue;
      }
      client.write(message);
    }
  }
}
