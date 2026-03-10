import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/server.js";
import { parseAppConfig } from "../src/lib/config.js";
import { createDatabase } from "../src/lib/database.js";
import { SqliteRepository } from "../src/lib/repository.js";
import { SseBroker } from "../src/lib/sse.js";
import type { OpsOrchestrator } from "../src/agents/orchestrator.js";
import type { VisualizationOrchestrator } from "../src/agents/visualizer-orchestrator.js";

function createTestRuntime() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-server-test-"));
  const dbPath = path.join(tempDir, "demo.db");
  const config = parseAppConfig({
    NODE_ENV: "test",
    PORT: "3100",
    SQLITE_PATH: dbPath,
    OPENAI_REASONING_EFFORT: "medium"
  });
  const db = createDatabase(dbPath);
  const repository = new SqliteRepository(db);
  const sse = new SseBroker();
  const queueRun = vi.fn();
  const queueVisualRun = vi.fn();
  const orchestrator = { queueRun } satisfies OpsOrchestrator;
  const visualizer = { queueRun: queueVisualRun } satisfies VisualizationOrchestrator;
  const app = createApp({
    config,
    db,
    repository,
    sse,
    orchestrator,
    visualizer
  });

  return { app, db, repository, queueRun, queueVisualRun, tempDir };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("server API", () => {
  it("persists session steps, submission state, and artifact history", async () => {
    const runtime = createTestRuntime();
    const session = runtime.repository.createSession("session-123");

    const visionResponse = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "vision",
      values: {
        useCaseAndVision: {
          useCase: "Weekend escapes",
          vibeKeywords: ["Warm", "quiet"]
        }
      },
      paletteChoice: "Forest Calm",
      visualTone: "Quiet expedition",
      summary: "Customer wants a warm and quiet weekend escape van."
    }).expect(200);

    expect(visionResponse.body.visualSpec.currentStep).toBe("exterior");
    expect(visionResponse.body.visualSpec.theme.backgroundLocked).toBe(false);

    const exteriorResponse = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "exterior",
      values: {
        exteriorSpec: {
          exteriorColor: "Forest green",
          powerPreference: "All-wheel drive",
          wheelSize: "33 inch"
        }
      },
      summary: "Customer prefers forest green with all-wheel drive."
    }).expect(200);

    expect(exteriorResponse.body.visualSpec.currentStep).toBe("interior");
    expect(exteriorResponse.body.visualSpec.theme.backgroundLocked).toBe(true);
    expect(exteriorResponse.body.visualSpec.theme.requestedExteriorColor).toBe("Forest green");
    expect(exteriorResponse.body.visualSpec.theme.resolvedExteriorColor).toBe("#6c876f");
    expect(exteriorResponse.body.visualSpec.exteriorScene.wheelRadius).toBe(32);
    expect(exteriorResponse.body.visualSpec.exteriorScene.wheelVariant).toBe("off-road");
    const lockedBackground = {
      a: exteriorResponse.body.visualSpec.theme.backgroundA,
      b: exteriorResponse.body.visualSpec.theme.backgroundB
    };

    const interiorResponse = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "interior",
      values: {
        interiorSpec: {
          fixtureColor: "Warm birch",
          primaryTexture: "Matte linen",
          secondaryTexture: "Stone wool",
          stitchingColor: "Sand stitch",
          seatFinish: "Weatherproof camel"
        }
      },
      summary: "Customer wants soft birch fixtures and warm woven materials."
    }).expect(200);

    expect(interiorResponse.body.visualSpec.currentStep).toBe("layout");
    expect(interiorResponse.body.visualSpec.theme.backgroundA).toBe(lockedBackground.a);
    expect(interiorResponse.body.visualSpec.theme.backgroundB).toBe(lockedBackground.b);
    expect(interiorResponse.body.visualSpec.interiorSwatches.fixtureColor).toBe("Warm birch");
    expect(interiorResponse.body.visualSpec.layoutFloorplan.legend.length).toBeGreaterThanOrEqual(4);

    runtime.repository.createArtifact({
      sessionId: session.id,
      agentName: "Design Planner",
      templateType: "design-brief",
      renderedContent: "<article>First brief</article>"
    });
    runtime.repository.createArtifact({
      sessionId: session.id,
      agentName: "Design Planner",
      templateType: "design-brief",
      renderedContent: "<article>Second brief</article>"
    });

    await request(runtime.app).post(`/api/configurations/${session.id}/submit`).expect(200);

    const detailResponse = await request(runtime.app).get(`/api/configurations/${session.id}`).expect(200);
    expect(detailResponse.body.session.status).toBe("submitted");
    expect(detailResponse.body.session.currentStep).toBe(5);
    expect(detailResponse.body.session.state.vision.useCase).toBe("Weekend escapes");
    expect(detailResponse.body.session.state.exterior.exteriorColor).toBe("Forest green");
    expect(detailResponse.body.visualSpec.theme.backgroundLocked).toBe(true);
    expect(detailResponse.body.turns[0].text).toContain("Configuration submitted");

    const listResponse = await request(runtime.app).get("/api/configurations").expect(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.items[0].artifactCount).toBe(2);

    const artifactResponse = await request(runtime.app)
      .get(`/api/configurations/${session.id}/artifacts`)
      .expect(200);
    expect(artifactResponse.body.items.map((item: { renderedContent: string }) => item.renderedContent)).toEqual([
      "<article>Second brief</article>",
      "<article>First brief</article>"
    ]);

    expect(runtime.queueRun).toHaveBeenCalledWith(session.id, "step:vision");
    expect(runtime.queueRun).toHaveBeenCalledWith(session.id, "step:exterior");
    expect(runtime.queueRun).toHaveBeenCalledWith(session.id, "step:interior");
    expect(runtime.queueRun).toHaveBeenCalledWith(session.id, "submit");
    expect(runtime.queueVisualRun).toHaveBeenCalledWith(session.id, "step:vision");
    expect(runtime.queueVisualRun).toHaveBeenCalledWith(session.id, "step:exterior");
    expect(runtime.queueVisualRun).toHaveBeenCalledWith(session.id, "step:interior");
    expect(runtime.queueVisualRun).toHaveBeenCalledWith(session.id, "submit");

    await request(runtime.app).post("/api/admin/reset").expect(200);
    const afterReset = await request(runtime.app).get("/api/configurations").expect(200);
    expect(afterReset.body.items).toHaveLength(0);

    runtime.db.close();
    fs.rmSync(runtime.tempDir, { recursive: true, force: true });
  });

  it("surfaces a clear realtime error when OPENAI_API_KEY is missing", async () => {
    const runtime = createTestRuntime();
    const response = await request(runtime.app).post("/api/realtime/session").expect(500);
    expect(response.body.error).toContain("OPENAI_API_KEY");
    runtime.db.close();
    fs.rmSync(runtime.tempDir, { recursive: true, force: true });
  });

  it("rejects out-of-sequence step saves with a clear 409 error", async () => {
    const runtime = createTestRuntime();
    const session = runtime.repository.createSession("session-out-of-sequence");

    const response = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "layout",
      values: {
        layoutFloorplan: {
          driveSide: "left-hand drive"
        }
      },
      summary: "Customer jumped ahead to layout."
    }).expect(409);

    expect(response.body.error).toContain("Expected to save vision next");
    expect(response.body.expectedStep).toBe("vision");
    expect(response.body.receivedStep).toBe("layout");

    runtime.db.close();
    fs.rmSync(runtime.tempDir, { recursive: true, force: true });
  });

  it("supports draft step saves so visuals can update before the guide advances", async () => {
    const runtime = createTestRuntime();
    const session = runtime.repository.createSession("session-draft-saves");

    const draftVision = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "vision",
      values: {
        useCase: "Quick surf weekender"
      },
      summary: "Quick surf weekender.",
      advance: false
    }).expect(200);

    expect(draftVision.body.advanced).toBe(false);
    expect(draftVision.body.session.currentStep).toBe(1);
    expect(draftVision.body.session.state.vision.useCase).toBe("Quick surf weekender");
    expect(draftVision.body.visualSpec.currentStep).toBe("vision");

    const completedVision = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "vision",
      values: {
        vibeKeywords: ["Calm", "coastal"]
      },
      summary: "Calm, coastal vibe.",
      advance: true
    }).expect(200);

    expect(completedVision.body.advanced).toBe(true);
    expect(completedVision.body.session.currentStep).toBe(2);
    expect(completedVision.body.session.state.vision.useCase).toBe("Quick surf weekender");
    expect(completedVision.body.session.state.vision.vibeKeywords).toEqual(["Calm", "coastal"]);

    const draftExterior = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "exterior",
      values: {
        exteriorColor: "Forest green"
      },
      summary: "Forest green exterior.",
      advance: false
    }).expect(200);

    expect(draftExterior.body.advanced).toBe(false);
    expect(draftExterior.body.session.currentStep).toBe(2);
    expect(draftExterior.body.visualSpec.theme.backgroundLocked).toBe(true);
    expect(draftExterior.body.visualSpec.theme.requestedExteriorColor).toBe("Forest green");
    expect(draftExterior.body.visualSpec.currentStep).toBe("exterior");

    runtime.db.close();
    fs.rmSync(runtime.tempDir, { recursive: true, force: true });
  });

  it("extracts exterior visuals from a summary-only save when the model omits flat keys", async () => {
    const runtime = createTestRuntime();
    const session = runtime.repository.createSession("session-summary-exterior");

    await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "vision",
      values: {
        useCase: "Modern, oceanic vibe for weekend mountain biking and scuba trips."
      },
      summary: "Modern, oceanic vibe for weekend mountain biking and scuba trips."
    }).expect(200);

    const exteriorResponse = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "exterior",
      values: {},
      summary: "Marine blue exterior with a subtle tone, satin finish, low-profile roof rack, and front bar lights."
    }).expect(200);

    expect(exteriorResponse.body.session.state.exterior.exteriorColor).toBe("Marine Blue");
    expect(exteriorResponse.body.session.state.exterior.finish).toBe("Satin finish");
    expect(exteriorResponse.body.session.state.exterior.auxLights).toBe("Front Bar Lights");
    expect(exteriorResponse.body.visualSpec.theme.backgroundLocked).toBe(true);
    expect(exteriorResponse.body.visualSpec.theme.requestedExteriorColor).toBe("Marine Blue");
    expect(exteriorResponse.body.visualSpec.theme.resolvedExteriorColor).toBe("#56788f");
    expect(exteriorResponse.body.visualSpec.exteriorScene.renderColor).toBe("#56788f");

    runtime.db.close();
    fs.rmSync(runtime.tempDir, { recursive: true, force: true });
  });

  it("rejects an empty save instead of advancing the flow without usable values", async () => {
    const runtime = createTestRuntime();
    const session = runtime.repository.createSession("session-empty-step");

    const response = await request(runtime.app).post(`/api/configurations/${session.id}/steps`).send({
      step: "vision",
      values: {}
    }).expect(422);

    expect(response.body.error).toContain("No usable vision choices");
    expect(response.body.step).toBe("vision");

    const detail = runtime.repository.getConfigurationDetail(session.id);
    expect(detail?.session.currentStep).toBe(1);

    runtime.db.close();
    fs.rmSync(runtime.tempDir, { recursive: true, force: true });
  });
});
