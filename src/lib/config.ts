import dotenv from "dotenv";
import { z } from "zod";
import { ReasoningEffortSchema } from "./schemas.js";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  SQLITE_PATH: z.string().trim().min(1).default("northstar-demo.db"),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_REASONING_EFFORT: ReasoningEffortSchema.default("high")
});

export interface AppConfig {
  port: number;
  nodeEnv: "development" | "test" | "production";
  sqlitePath: string;
  openAiApiKey?: string;
  hasOpenAiKey: boolean;
  opsModel: "gpt-5.4";
  realtimeModel: "gpt-realtime";
  realtimeVoice: "marin";
  reasoningEffort: z.infer<typeof ReasoningEffortSchema>;
}

export function parseAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsedEnv = EnvSchema.parse(env);

  return {
    port: parsedEnv.PORT,
    nodeEnv: parsedEnv.NODE_ENV ?? "development",
    sqlitePath: parsedEnv.SQLITE_PATH,
    openAiApiKey: parsedEnv.OPENAI_API_KEY,
    hasOpenAiKey: Boolean(parsedEnv.OPENAI_API_KEY),
    opsModel: "gpt-5.4",
    realtimeModel: "gpt-realtime",
    realtimeVoice: "marin",
    reasoningEffort: parsedEnv.OPENAI_REASONING_EFFORT
  };
}

export const appConfig: AppConfig = parseAppConfig(process.env);

export function assertOpenAiConfigured(config: AppConfig): asserts config is AppConfig & { openAiApiKey: string } {
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required for Realtime and Ops agent calls.");
  }
}
