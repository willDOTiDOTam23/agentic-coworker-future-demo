import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./server.js";
import { CONFIGURATE_RESOURCE_URI, CONTROL_RESOURCE_URI } from "./mcp/tools.js";

function rpc(method: string, params?: Record<string, unknown>, id = 1) {
  return request(app)
    .post("/api/mcp")
    .send({ jsonrpc: "2.0", id, method, params })
    .set("Content-Type", "application/json");
}

describe("mcp dual-mode protocol", () => {
  it("supports initialize + resource capabilities", async () => {
    const response = await rpc("initialize", { clientInfo: { name: "test" } }, 10);

    expect(response.status).toBe(200);
    expect(response.body.result.capabilities.tools).toBeDefined();
    expect(response.body.result.capabilities.resources).toBeDefined();
  });

  it("exposes render tool metadata in tools/list", async () => {
    const response = await rpc("tools/list", {}, 11);
    const tools = response.body.result.tools as Array<Record<string, unknown>>;
    const renderTool = tools.find((tool) => tool.name === "configurate.renderJourney");

    expect(response.status).toBe(200);
    expect(renderTool).toBeDefined();
    expect(renderTool?._meta).toBeDefined();
    expect((renderTool?._meta as { ui?: { resourceUri?: string } }).ui?.resourceUri).toBe(CONFIGURATE_RESOURCE_URI);
  });

  it("supports resources/list and resources/read", async () => {
    const listed = await rpc("resources/list", {}, 12);
    expect(listed.status).toBe(200);
    const resources = listed.body.result.resources as Array<Record<string, string>>;
    const target = resources.find((item) => item.uri === CONFIGURATE_RESOURCE_URI);
    expect(target).toBeDefined();

    const read = await rpc("resources/read", { uri: CONFIGURATE_RESOURCE_URI }, 13);
    expect(read.status).toBe(200);
    const content = read.body.result.contents[0];
    expect(content.mimeType).toContain("text/html");
    expect(content.text).toContain("Configurate");
  });

  it("returns template metadata and structured journey fields on customer.startSession", async () => {
    const started = await rpc("tools/call", { name: "customer.startSession", arguments: { customerName: "Demo" } }, 14);

    expect(started.status).toBe(200);
    expect(started.body.result._meta?.["openai/outputTemplate"]).toBe(CONFIGURATE_RESOURCE_URI);
    expect(started.body.result.structuredContent.step).toBeDefined();
    expect(started.body.result.structuredContent.nextQuestion).toBeDefined();
    expect(started.body.result._meta?.widgetPayload?.data?.journeyState).toBeDefined();
    expect(started.body.result._meta?.widgetPayload?.data?.session).toBeDefined();
  });

  it("attaches template metadata for non-render helper tools to keep widget-first UX", async () => {
    const catalog = await rpc("tools/call", { name: "catalog.getCatalog", arguments: {} }, 18);
    expect(catalog.status).toBe(200);
    expect(catalog.body.result._meta?.["openai/outputTemplate"]).toBe(CONFIGURATE_RESOURCE_URI);

    const board = await rpc("tools/call", { name: "ops.getKpis", arguments: {} }, 19);
    expect(board.status).toBe(200);
    expect(board.body.result._meta?.["openai/outputTemplate"]).toBe(CONTROL_RESOURCE_URI);
  });

  it("scopes part-1 to guided UI tools to avoid text-first helper calls", async () => {
    const response = await request(app).get("/api/apps/part-1/mcp/tools");
    expect(response.status).toBe(200);

    const toolNames = new Set((response.body as Array<{ name: string }>).map((tool) => tool.name));
    expect(toolNames.has("customer.startSession")).toBe(true);
    expect(toolNames.has("customer.advanceSession")).toBe(true);
    expect(toolNames.has("customer.getVanTemplates")).toBe(false);
    expect(toolNames.has("catalog.getCatalog")).toBe(false);
  });

  it("runs deterministic issue flow and applies Customize fix", async () => {
    await request(app).post("/api/admin/reset").send({});

    const seeded = await rpc("tools/call", { name: "ops.seedDeterministicIssue", arguments: { customerName: "Demo" } }, 15);
    expect(seeded.status).toBe(200);

    const seededData = seeded.body.result._meta.widgetPayload.data;
    const issueId = seededData.issue.id as string;
    const sessionId = seededData.sessionId as string;

    const rendered = await rpc("tools/call", { name: "control.renderBoard", arguments: { sessionId } }, 16);
    expect(rendered.status).toBe(200);
    expect(rendered.body.result._meta.ui.resourceUri).toBe(CONTROL_RESOURCE_URI);

    const fixed = await rpc("tools/call", { name: "dev.fixIssue", arguments: { issueId } }, 17);
    expect(fixed.status).toBe(200);
    expect(fixed.body.result.structuredContent.fixed).toBe(true);
    expect(fixed.body.result._meta.widgetPayload.data.issue.fixed).toBe(true);
  });
});
