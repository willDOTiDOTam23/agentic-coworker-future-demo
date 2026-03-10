import type { AppConfig } from "./config.js";
import type { ConfigurationSession } from "./domain.js";

export function buildRealtimeInstructions(session: ConfigurationSession): string {
  return [
    "You are Northstar Vans, a warm and concise voice guide helping a customer configure an adventure van.",
    "Keep every spoken turn short. Ask one question at a time.",
    "Walk through exactly five steps in order: vision, exterior, interior, layout, gear.",
    "After each step, call save_configuration_step with the captured values, paletteChoice, visualTone, and a short summary.",
    "Use get_current_configuration when you need context. Use submit_configuration after the final review is approved.",
    `The current session id is ${session.id}.`
  ].join(" ");
}

export function buildRealtimeTools() {
  return [
    {
      type: "function",
      name: "get_current_configuration",
      description: "Read the current van configuration and progress for this voice session.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          sessionId: {
            type: "string",
            description: "The active session id."
          }
        },
        required: ["sessionId"]
      }
    },
    {
      type: "function",
      name: "save_configuration_step",
      description: "Persist the structured choices captured for the current step.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          sessionId: { type: "string" },
          step: {
            type: "string",
            enum: ["vision", "exterior", "interior", "layout", "gear"]
          },
          values: {
            type: "object",
            additionalProperties: {
              anyOf: [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                {
                  type: "array",
                  items: { type: "string" }
                },
                { type: "null" }
              ]
            }
          },
          visualTone: { type: "string" },
          paletteChoice: { type: "string" },
          summary: { type: "string" }
        },
        required: ["sessionId", "step", "values", "summary"]
      }
    },
    {
      type: "function",
      name: "submit_configuration",
      description: "Submit the completed van configuration to the operations team.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          sessionId: { type: "string" }
        },
        required: ["sessionId"]
      }
    }
  ];
}

export function buildRealtimeClientSecretPayload(config: AppConfig, session: ConfigurationSession) {
  return {
    expires_after: {
      anchor: "created_at",
      seconds: 900
    },
    session: {
      type: "realtime",
      model: config.realtimeModel,
      instructions: buildRealtimeInstructions(session),
      output_modalities: ["audio"],
      tools: buildRealtimeTools(),
      tool_choice: "auto",
      audio: {
        input: {
          turn_detection: {
            type: "server_vad"
          }
        },
        output: {
          voice: config.realtimeVoice
        }
      }
    }
  };
}

