import { randomUUID } from "crypto";

export interface SummarizeInput {
  sessionId: string;
  summaryText: string;
}

function shouldUseModel() {
  return (process.env.OPENAI_MODE ?? "auto") !== "fallback";
}

export async function summarizeSession(input: SummarizeInput): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!shouldUseModel() || !key) {
    return fallbackSummary(input);
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        input: `Summarize the customer interaction for support handoff in one compact support card format: ${input.summaryText}`,
        temperature: 0.2
      })
    });

    if (!resp.ok) {
      return fallbackSummary(input);
    }

    const data = await resp.json() as {
      output_text?: string
    };
    return data.output_text ?? fallbackSummary(input);
  } catch {
    return fallbackSummary(input);
  }
}

function fallbackSummary(input: SummarizeInput): string {
  return `[fallback:${input.sessionId.substring(0, 6)}] ${input.summaryText}`;
}

export function agentTraceId() {
  return `trace_${randomUUID()}`;
}
