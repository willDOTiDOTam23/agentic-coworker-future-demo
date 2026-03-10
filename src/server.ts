import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import { createOpsOrchestrator, type OpsOrchestrator } from "./agents/orchestrator.js";
import { appConfig, assertOpenAiConfigured, type AppConfig } from "./lib/config.js";
import { createDatabase, type AppDatabase } from "./lib/database.js";
import { buildRealtimeClientSecretPayload } from "./lib/realtime.js";
import { SqliteRepository } from "./lib/repository.js";
import { SaveConfigurationStepSchema } from "./lib/schemas.js";
import { SseBroker } from "./lib/sse.js";

export interface RuntimeDeps {
  config: AppConfig;
  db: AppDatabase;
  repository: SqliteRepository;
  sse: SseBroker;
  orchestrator: OpsOrchestrator;
}

export function createRuntime(config: AppConfig = appConfig): RuntimeDeps {
  const db = createDatabase(config.sqlitePath);
  const repository = new SqliteRepository(db);
  const sse = new SseBroker();
  const orchestrator = createOpsOrchestrator(config, repository, sse);

  return {
    config,
    db,
    repository,
    sse,
    orchestrator
  };
}

async function createRealtimeClientSecret(config: AppConfig, sessionId: string) {
  assertOpenAiConfigured(config);

  const session = {
    ...buildRealtimeClientSecretPayload(config, {
      id: sessionId,
      status: "draft",
      currentStep: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submittedAt: null,
      latestConfidence: null,
      state: {
        vision: {},
        exterior: {},
        interior: {},
        layout: {},
        gear: {}
      },
      theme: {
        paletteChoice: "Stone Glacier",
        visualTone: "Modern expedition"
      }
    })
  };

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(session)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Realtime client secret request failed (${response.status}): ${body}`);
  }

  return response.json();
}

function attachStaticSites(app: Express) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../dist/client");

  if (!fs.existsSync(clientDist)) {
    return;
  }

  app.use(express.static(clientDist));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(clientDist, "customer.html"));
  });

  app.get("/ops", (_req, res) => {
    res.sendFile(path.join(clientDist, "ops.html"));
  });
}

export function createApp(runtime: RuntimeDeps = createRuntime()): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      model: runtime.config.opsModel,
      realtimeModel: runtime.config.realtimeModel,
      reasoningEffort: runtime.config.reasoningEffort
    });
  });

  app.post("/api/realtime/session", async (_req, res) => {
    try {
      assertOpenAiConfigured(runtime.config);
      const sessionId = randomUUID();
      runtime.repository.createSession(sessionId);
      const clientSecret = await createRealtimeClientSecret(runtime.config, sessionId);

      res.status(201).json({
        sessionId,
        clientSecret: clientSecret.value,
        expiresAt: clientSecret.expires_at,
        session: clientSecret.session
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unable to create realtime session."
      });
    }
  });

  app.get("/api/configurations", (_req, res) => {
    res.json({
      items: runtime.repository.listSessions()
    });
  });

  app.get("/api/configurations/:id", (req, res) => {
    const detail = runtime.repository.getConfigurationDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: "Configuration not found." });
      return;
    }

    res.json(detail);
  });

  app.get("/api/configurations/:id/artifacts", (req, res) => {
    res.json({
      items: runtime.repository.listArtifacts(req.params.id)
    });
  });

  app.post("/api/configurations/:id/steps", (req, res) => {
    const parsed = SaveConfigurationStepSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.flatten()
      });
      return;
    }

    try {
      const session = runtime.repository.saveStep(req.params.id, parsed.data);
      runtime.orchestrator.queueRun(req.params.id, `step:${parsed.data.step}`);
      res.json({ session });
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : "Unable to save step."
      });
    }
  });

  app.post("/api/configurations/:id/submit", (req, res) => {
    try {
      const session = runtime.repository.submitSession(req.params.id);
      runtime.repository.addSystemTurn(
        req.params.id,
        "assistant",
        "Configuration submitted for design planning and supply orchestration."
      );
      runtime.orchestrator.queueRun(req.params.id, "submit");
      res.json({ session });
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : "Unable to submit configuration."
      });
    }
  });

  app.get("/api/ops/stream", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    runtime.sse.addClient(res);
    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);

    res.on("close", () => {
      clearInterval(heartbeat);
      runtime.sse.removeClient(res);
    });
  });

  app.post("/api/admin/reset", (_req, res) => {
    runtime.repository.reset();
    res.json({ ok: true });
  });

  attachStaticSites(app);

  return app;
}

const isMainModule = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");

if (isMainModule) {
  const runtime = createRuntime();
  const app = createApp(runtime);

  app.listen(runtime.config.port, () => {
    console.log(`Northstar Vans demo listening on http://localhost:${runtime.config.port}`);
  });
}
