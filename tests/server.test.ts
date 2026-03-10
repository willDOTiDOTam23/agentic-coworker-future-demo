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
});
