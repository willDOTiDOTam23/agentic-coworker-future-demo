import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createSession, getCatalog, getSession, getKpis, getOpsBoard, getIssuesBySession, issueList, resetDemoState, setSelectedOption, submitSession } from "./data/store";
import { part1Manifest, part2Manifest } from "./apps/manifests";
import { mcpTools, invokeTool } from "./mcp/tools";
import { summarizeSession } from "./agents/openai";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.join(__dirname, "../public");
app.use(express.static(staticRoot));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", now: new Date().toISOString() });
});

app.get("/api/catalog", (_req, res) => {
  res.json(getCatalog());
});

app.get("/api/apps", (_req, res) => {
  res.json({ part1: part1Manifest, part2: part2Manifest });
});

app.get("/api/apps/part-1/manifest", (_req, res) => {
  res.json(part1Manifest);
});

app.get("/api/apps/part-2/manifest", (_req, res) => {
  res.json(part2Manifest);
});

app.post("/api/sessions", (req, res) => {
  const payload = req.body;
  const result = createSession({
    customerName: payload.customerName ?? "Guest",
    budget: Number(payload.budget ?? 0),
    occupancy: Number(payload.occupancy ?? 2),
    terrain: payload.terrain ?? "city",
    region: payload.region ?? "CO",
    moods: Array.isArray(payload.moods) ? payload.moods : [],
    tripStyle: payload.tripStyle
  });
  res.json(result);
});

app.get("/api/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  return res.json(session);
});

app.post("/api/sessions/:id/options/:optionId", (req, res) => {
  const session = setSelectedOption(req.params.id, req.params.optionId);
  if (!session) return res.status(404).json({ error: "Session or option not found." });
  return res.json(session);
});

app.post("/api/sessions/:id/submit", async (req, res) => {
  const result = submitSession(req.params.id);
  if (!result) return res.status(404).json({ error: "Session not found" });

  const summaryText = JSON.stringify({
    sessionId: req.params.id,
    status: result.status || "unknown",
    issueCount: result.issue ? 1 : 0
  });
  const summary = await summarizeSession({ sessionId: req.params.id, summaryText });

  return res.json({ ...result, summary });
});

app.post("/api/admin/reset", (_req, res) => {
  res.json(resetDemoState());
});

app.get("/api/ops/kpis", (_req, res) => {
  res.json(getKpis());
});

app.get("/api/ops/board", (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  res.json(getOpsBoard(sessionId));
});

app.get("/api/ops/sessions/:id/issues", (req, res) => {
  res.json(getIssuesBySession(req.params.id));
});

app.get("/api/ops/issues", (_req, res) => {
  res.json(issueList());
});

app.get("/api/mcp/tools", (_req, res) => {
  res.json(mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: (tool as { inputSchema?: unknown }).inputSchema
  })));
});

app.post("/api/mcp/tools/:toolName/call", async (req, res) => {
  const call = await invokeTool(req.params.toolName, req.body ?? {});
  res.json(call);
});

app.get("/", (_req, res) => {
  res.send(`Agentic Coworker Demo running. Open the ChatGPT App surfaces defined in /api/apps/part-1/manifest and /api/apps/part-2/manifest.`);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
