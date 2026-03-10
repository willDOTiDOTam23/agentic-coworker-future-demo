import express from "express";
import { randomBytes, randomUUID } from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  assembleDashboardPayload,
  createSession,
  getCatalog,
  getSession,
  getKpis,
  getOpsBoard,
  getIssuesBySession,
  getVisualAssetManifest,
  getVanTemplates,
  issueList,
  resetDemoState,
  setSelectedOption,
  submitSession
} from "./data/store.js";
import { part1Manifest, part2Manifest } from "./apps/manifests.js";
import {
  CONFIGURATE_RESOURCE_URI,
  CONTROL_RESOURCE_URI,
  McpPartScope,
  getToolDescriptor,
  invokeTool,
  isToolAllowed,
  toolsForScope
} from "./mcp/tools.js";
import { listUiResources, listUiResourceTemplates, readUiResource } from "./mcp/resources.js";
import { summarizeSession } from "./agents/openai.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.join(__dirname, "../public");
app.use(express.static(staticRoot));
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", now: new Date().toISOString() });
});

const MCP_PROTOCOL_VERSION = "2024-11-05";
const MCP_CLIENT_ID = process.env.MCP_CLIENT_ID ?? "agentic-coworker-future-demo";
const MCP_CLIENT_SECRET = process.env.MCP_CLIENT_SECRET ?? "local-dev-secret";
const MCP_STRICT_AUTH = process.env.MCP_STRICT_AUTH === "true";
const ACCESS_TOKEN_TTL_SECONDS = 3600;
const AUTH_CODE_TTL_SECONDS = 300;
const TOKEN_TTL = ACCESS_TOKEN_TTL_SECONDS * 1000;
const AUTH_CODE_TTL = AUTH_CODE_TTL_SECONDS * 1000;
const MCP_DISCOVERY_HEADER = "2024-11-05";

interface OAuthCodeRecord {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: number;
  used: boolean;
}

interface OAuthTokenRecord {
  token: string;
  scope: string;
  expiresAt: number;
}

const authCodes = new Map<string, OAuthCodeRecord>();
const accessTokens = new Map<string, OAuthTokenRecord>();

function getBaseUrl(req: express.Request) {
  const host = req.get("host");
  if (!host) return "http://localhost:3000";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${protocol}://${host}`;
}

function emitOAuthDiscoveryJson(req: express.Request) {
  const base = getBaseUrl(req);
  return {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    response_modes_supported: ["query", "form_post"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    scopes_supported: ["openid", "profile", "offline_access", "mcp:tools:read", "mcp:tools:write"]
  };
}

function emitProtectedResourceMetadata(req: express.Request) {
  const base = getBaseUrl(req);
  return {
    resource: base,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp:tools:read", "mcp:tools:write"]
  };
}

function respondDiscoveryJson(res: express.Response, payload: unknown) {
  res.setHeader("MCP-Protocol-Version", MCP_DISCOVERY_HEADER);
  res.setHeader("Cache-Control", "no-store");
  res.json(payload);
}

function emitMcpTools(scope?: McpPartScope) {
  const scopedTools = toolsForScope(scope);
  return scopedTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: (tool as { inputSchema?: unknown }).inputSchema ?? { type: "object", properties: {}, additionalProperties: true },
    annotations: (tool as { annotations?: unknown }).annotations,
    _meta: (tool as { _meta?: unknown })._meta
  }));
}

function buildWidgetEnvelope(toolName: string, data: unknown) {
  const payload = (data as Record<string, unknown>) ?? {};
  const journeyState = (payload.journeyState as Record<string, unknown> | undefined) ?? undefined;
  const quickActions = journeyState?.quickActions;
  const stepCards = journeyState?.stepCards;

  if (journeyState) {
    const actionSet = Array.isArray(quickActions) ? quickActions.slice(0, 2) : [];
    return {
      renderMode: "card_stack",
      appPart: "part-1",
      action: toolName,
      sessionId: (payload.session as { id?: string })?.id ?? (payload.sessionId as string | undefined),
      view: {
        nextQuestion: (payload.nextQuestion as string) ?? journeyState.nextQuestion,
        step: (journeyState.step as number | undefined) ?? 1,
        requiredInputs: (payload.requiredInputs as string[]) ?? (journeyState.requiredInputs as string[]),
        quickActions: actionSet,
        stepCards: Array.isArray(stepCards) ? stepCards : [],
        chips: Array.isArray((payload.stepCards as Array<{ chipHints?: string[] }>))
          ? (payload.stepCards as Array<{ chipHints?: string[] }>)
          : Array.isArray(stepCards)
            ? (stepCards as Array<{ chipHints?: string[] }>)
            : []
      },
      data
    };
  }

  if (payload.priorityQueue && Array.isArray(payload.priorityQueue)) {
    return {
      renderMode: "priority_board",
      appPart: "part-2",
      action: toolName,
      lanes: {
        p0: (payload.priorityQueue as Array<Record<string, unknown>>).filter((item) => (item as { priority?: string }).priority === "P0"),
        p1: (payload.priorityQueue as Array<Record<string, unknown>>).filter((item) => (item as { priority?: string }).priority === "P1"),
        p2: (payload.priorityQueue as Array<Record<string, unknown>>).filter((item) => (item as { priority?: string }).priority === "P2")
      },
      immediateFixes: payload.immediateFixes,
      actionRecommendations: payload.actionRecommendations,
      data
    };
  }

  if (payload.board && Array.isArray((payload.board as { priorityQueue?: unknown[] }).priorityQueue)) {
    const board = payload.board as {
      priorityQueue: Array<Record<string, unknown>>;
      immediateFixes?: unknown;
      actionRecommendations?: unknown;
      fixCandidates?: unknown;
      featureBuildCandidates?: unknown;
    };
    return {
      renderMode: "priority_board",
      appPart: "part-2",
      action: toolName,
      lanes: {
        p0: board.priorityQueue.filter((item) => (item as { priority?: string }).priority === "P0"),
        p1: board.priorityQueue.filter((item) => (item as { priority?: string }).priority === "P1"),
        p2: board.priorityQueue.filter((item) => (item as { priority?: string }).priority === "P2")
      },
      immediateFixes: board.immediateFixes,
      actionRecommendations: board.actionRecommendations,
      kpis: (payload.kpis as unknown) ?? undefined,
      data
    };
  }

  return {
    renderMode: "compact_payload",
    appPart: toolName.startsWith("ops.") ? "part-2" : "part-1",
    action: toolName,
    data
  };
}

function toolSummaryLine(toolName: string, data: unknown) {
  if (toolName.startsWith("customer.") || toolName.startsWith("configurate.") || toolName.startsWith("catalog.")) {
    return "Configurate updated in the app card.";
  }

  if (toolName.startsWith("ops.") || toolName.startsWith("control.") || toolName.startsWith("dev.")) {
    return "Control updated in the app card.";
  }

  const payload = (data as Record<string, unknown>) ?? {};

  if (payload.journeyState) {
    const journey = payload.journeyState as { step?: number; nextQuestion?: string };
    return `Step ${journey.step ?? 1}: ${(journey.nextQuestion as string) ?? "Continue with one focused step."}`;
  }

  if (payload.priorityQueue && Array.isArray(payload.priorityQueue)) {
    const queue = payload.priorityQueue as Array<Record<string, unknown>>;
    const immediate = Array.isArray(payload.immediateFixes) ? payload.immediateFixes.length : 0;
    return `Ops board ready. ${queue.length} ranked items, ${immediate} immediate fix(es).`;
  }

  if ((payload as { session?: { status?: string } }).session && typeof (payload as { session?: { status?: string } }).session?.status === "string") {
    return `Session ${(payload.session as { status?: string }).status ?? "updated"} with latest status update.`;
  }

  if (Array.isArray(payload)) {
    return `${toolName} returned ${payload.length} item(s).`;
  }

  if (toolName === "catalog.getCatalog") {
    const payloadAny = payload as { vans?: unknown[]; options?: unknown[] };
    const vanCount = Array.isArray(payloadAny?.vans) ? payloadAny.vans.length : 0;
    const optionCount = Array.isArray(payloadAny?.options) ? payloadAny.options.length : 0;
    return `Loaded catalog: ${vanCount} vans, ${optionCount} options.`;
  }

  return `${toolName} completed.`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toCompactStructuredContent(toolName: string, data: unknown) {
  const payload = asRecord(data);
  const compactBase: Record<string, unknown> = {
    appPart: toolName.startsWith("ops.") || toolName.startsWith("control.") || toolName.startsWith("dev.") ? "part-2" : "part-1",
    tool: toolName,
    status: "ok",
    summary: toolSummaryLine(toolName, data)
  };

  if (toolName === "catalog.getCatalog") {
    const vanCount = Array.isArray((payload as { vans?: unknown[] }).vans) ? ((payload as { vans?: unknown[] }).vans as unknown[]).length : 0;
    const optionCount = Array.isArray((payload as { options?: unknown[] }).options)
      ? ((payload as { options?: unknown[] }).options as unknown[]).length
      : 0;
    return { ...compactBase, vanCount, optionCount };
  }

  if (toolName === "customer.getVanTemplates") {
    const templates = Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
    return {
      ...compactBase,
      templateCount: templates.length
    };
  }

  const journeyState = asRecord(payload.journeyState);
  if (Object.keys(journeyState).length > 0) {
    const quickActions = asList(journeyState.quickActions).slice(0, 2);
    const stepCards = asList(payload.stepCards).length > 0 ? asList(payload.stepCards) : asList(journeyState.stepCards);
    const requiredInputs =
      asList(payload.requiredInputs).length > 0 ? asList(payload.requiredInputs) : asList(journeyState.requiredInputs);
    const nextQuestion =
      typeof payload.nextQuestion === "string"
        ? payload.nextQuestion
        : typeof journeyState.nextQuestion === "string"
          ? (journeyState.nextQuestion as string)
          : "Continue configuring your build.";
    const session = asRecord(payload.session);
    const sessionConfig = asRecord(session.config);
    const sessionExterior = asRecord(sessionConfig.exterior);
    const sessionInterior = asRecord(sessionConfig.interior);
    const sessionPower = asRecord(sessionConfig.power);
    const sessionAccessories = asRecord(sessionConfig.accessories);
    const selectedAccessoryIds = asList(sessionAccessories.selectedAccessoryIds).filter((item) => typeof item === "string");
    const uiCatalogRaw = asRecord(getCatalog());
    const uiCatalog = {
      vanTemplates: asList(uiCatalogRaw.vanTemplates).slice(0, 4),
      exteriorOptions: asRecord(uiCatalogRaw.exteriorOptions),
      interiorOptions: asList(uiCatalogRaw.interiorOptions).slice(0, 6),
      lifestyleModes: asList(uiCatalogRaw.lifestyleModes).slice(0, 6),
      powerOptions: asList(uiCatalogRaw.powerOptions).slice(0, 4)
    };
    return {
      ...compactBase,
      renderMode: "card_stack",
      sessionId: typeof session.id === "string" ? session.id : payload.sessionId,
      sessionStatus: typeof session.status === "string" ? session.status : "draft",
      step: journeyState.step ?? 1,
      nextQuestion,
      requiredInputs,
      stepCards,
      quickActions,
      session: {
        id: typeof session.id === "string" ? session.id : payload.sessionId,
        status: typeof session.status === "string" ? session.status : "draft",
        templateId: session.templateId,
        isFromScratch: Boolean(session.isFromScratch),
        totalPrice: session.totalPrice,
        config: {
          exterior: {
            paintColor: sessionExterior.paintColor,
            roofRack: sessionExterior.roofRack,
            wheels: sessionExterior.wheels,
            lights: sessionExterior.lights
          },
          interior: {
            level: sessionInterior.level,
            lifestyleMode: sessionInterior.lifestyleMode
          },
          power: {
            drivetrain: sessionPower.drivetrain
          },
          accessories: {
            selectedAccessoryIds
          }
        }
      },
      journeyState: {
        step: journeyState.step ?? 1,
        nextQuestion,
        requiredInputs,
        stepCards,
        quickActions,
        completed: Boolean(journeyState.completed)
      },
      availableOptions: asList(payload.availableOptions).slice(0, 24),
      uiCatalog
    };
  }

  const board = asRecord(payload.board);
  const priorityQueue = Array.isArray(payload.priorityQueue)
    ? (payload.priorityQueue as Array<Record<string, unknown>>)
    : Array.isArray(board.priorityQueue)
      ? (board.priorityQueue as Array<Record<string, unknown>>)
      : undefined;
  if (priorityQueue) {
    const immediateFixes = Array.isArray(payload.immediateFixes)
      ? payload.immediateFixes
      : Array.isArray(board.immediateFixes)
        ? board.immediateFixes
        : [];
    return {
      ...compactBase,
      renderMode: "priority_board",
      issueCount: priorityQueue.length,
      immediateFixCount: Array.isArray(immediateFixes) ? immediateFixes.length : 0,
      topIssues: priorityQueue.slice(0, 3).map((issue) => ({
        id: issue.id,
        priority: issue.priority,
        title: issue.title
      }))
    };
  }

  if (toolName === "ops.getKpis") {
    return {
      ...compactBase,
      kpis: {
        activeSessions: (payload as { activeSessions?: unknown }).activeSessions,
        openIssues: (payload as { openIssues?: unknown }).openIssues,
        p0Open: (payload as { p0Open?: unknown }).p0Open
      }
    };
  }

  if (toolName === "dev.fixIssue") {
    const issue = (payload.issue as Record<string, unknown> | undefined) ?? undefined;
    const session = (payload.session as Record<string, unknown> | undefined) ?? undefined;
    return {
      ...compactBase,
      issueId: issue?.id,
      fixed: issue?.fixed === true,
      sessionId: session?.id
    };
  }

  if (Array.isArray(payload)) {
    return {
      ...compactBase,
      count: payload.length
    };
  }

  return compactBase;
}

function inferTemplateMeta(toolName: string) {
  const part2Tool = toolName.startsWith("ops.") || toolName.startsWith("control.") || toolName.startsWith("dev.");
  const part1Tool = toolName.startsWith("customer.") || toolName.startsWith("catalog.") || toolName.startsWith("configurate.");
  if (!part1Tool && !part2Tool) {
    return null;
  }
  const resourceUri = part2Tool ? CONTROL_RESOURCE_URI : CONFIGURATE_RESOURCE_URI;
  return {
    ui: {
      resourceUri
    },
    "openai/outputTemplate": resourceUri
  } as const;
}

function toWidgetMcpResult(id: string | number | null | undefined, toolName: string, data: unknown) {
  const descriptor = getToolDescriptor(toolName);
  const widgetPayload = buildWidgetEnvelope(toolName, data);
  const compactStructured = toCompactStructuredContent(toolName, data);
  const resultMeta: Record<string, unknown> = descriptor?._meta ? { ...descriptor._meta } : {};
  const inferredMeta = inferTemplateMeta(toolName);

  if (inferredMeta) {
    const existingUi = (resultMeta.ui as Record<string, unknown> | undefined) ?? {};
    resultMeta.ui = {
      ...existingUi,
      resourceUri: existingUi.resourceUri ?? inferredMeta.ui.resourceUri
    };
    if (!resultMeta["openai/outputTemplate"]) {
      resultMeta["openai/outputTemplate"] = inferredMeta["openai/outputTemplate"];
    }
  }

  resultMeta.widgetPayload = widgetPayload;

  const result: Record<string, unknown> = {
    content: [{ type: "text", text: toolSummaryLine(toolName, data) }],
    structuredContent: compactStructured
  };

  result._meta = resultMeta;

  return toMcpResult(id, result);
}

function toMcpError(id: string | number | null | undefined, code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}

function toMcpResult(id: string | number | null | undefined, result: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function parseOAuthForm(req: express.Request) {
  const body = (req.body ?? {}) as Record<string, string>;
  const query = req.query as Record<string, string | string[] | undefined>;
  return {
    client_id: typeof body.client_id === "string" ? body.client_id : typeof query.client_id === "string" ? query.client_id : MCP_CLIENT_ID,
    client_secret: typeof body.client_secret === "string" ? body.client_secret : typeof query.client_secret === "string" ? query.client_secret : undefined,
    redirect_uri: typeof body.redirect_uri === "string" ? body.redirect_uri : typeof query.redirect_uri === "string" ? query.redirect_uri : undefined,
    code: typeof body.code === "string" ? body.code : typeof query.code === "string" ? query.code : undefined,
    code_verifier: typeof body.code_verifier === "string" ? body.code_verifier : typeof query.code_verifier === "string" ? query.code_verifier : undefined,
    grant_type: typeof body.grant_type === "string" ? body.grant_type : typeof query.grant_type === "string" ? query.grant_type : undefined,
    refresh_token: typeof body.refresh_token === "string" ? body.refresh_token : typeof query.refresh_token === "string" ? query.refresh_token : undefined,
    scope: typeof body.scope === "string" ? body.scope : typeof query.scope === "string" ? query.scope : "mcp:tools:read mcp:tools:write"
  };
}

function issueTokenForCode(scope = "mcp:tools:read mcp:tools:write") {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + TOKEN_TTL;
  accessTokens.set(token, { token, scope, expiresAt });
  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope
  };
}

function isValidBearerToken(token?: string) {
  if (!token) return false;
  const record = accessTokens.get(token);
  if (!record) return false;
  return record.expiresAt > Date.now();
}

function extractBearerToken(req: express.Request) {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim();
}

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  respondDiscoveryJson(res, emitOAuthDiscoveryJson(req));
});

app.get("/.well-known/openid-configuration", (req, res) => {
  respondDiscoveryJson(res, emitOAuthDiscoveryJson(req));
});

app.get("/.well-known/oauth-protected-resource", (req, res) => {
  respondDiscoveryJson(res, emitProtectedResourceMetadata(req));
});

app.get(/\/\.well-known\/oauth-authorization-server$/, (req, res) => {
  respondDiscoveryJson(res, emitOAuthDiscoveryJson(req));
});

app.get(/\/\.well-known\/openid-configuration$/, (req, res) => {
  respondDiscoveryJson(res, emitOAuthDiscoveryJson(req));
});

app.get(/\/\.well-known\/oauth-protected-resource$/, (req, res) => {
  respondDiscoveryJson(res, emitProtectedResourceMetadata(req));
});

app.get("/register", (_req, res) => {
  res.status(405).json({ error: "unsupported_method", error_description: "Register requires POST." });
});

app.get("/authorize", (req, res) => {
  const query = req.query as Record<string, string | undefined>;
  const clientId = query.client_id || MCP_CLIENT_ID;
  const redirectUri = query.redirect_uri;
  const scope = query.scope || "mcp:tools:read mcp:tools:write";
  const state = query.state;
  const codeChallenge = query.code_challenge;
  const codeChallengeMethod = query.code_challenge_method;

  if (!redirectUri) {
    return res.status(400).send("Missing required redirect_uri");
  }

  const code = randomBytes(16).toString("hex");
  const record: OAuthCodeRecord = {
    clientId: String(clientId),
    redirectUri: String(redirectUri),
    scope: String(scope),
    codeChallenge: codeChallenge ? String(codeChallenge) : undefined,
    codeChallengeMethod: codeChallengeMethod ? String(codeChallengeMethod) : undefined,
    expiresAt: Date.now() + AUTH_CODE_TTL,
    used: false
  };
  authCodes.set(code, record);
  const callback = new URL(String(redirectUri));
  callback.searchParams.set("code", code);
  if (state) callback.searchParams.set("state", String(state));
  return res.redirect(callback.toString());
});

const handleTokenEndpoint = (req: express.Request, res: express.Response) => {
  const payload = parseOAuthForm(req);
  const grantType = payload.grant_type;

  if (!grantType) {
    return res.status(400).json({ error: "invalid_request", error_description: "grant_type is required." });
  }

  if (payload.client_secret && payload.client_secret !== MCP_CLIENT_SECRET) {
    return res.status(401).json({ error: "invalid_client", error_description: "Invalid client_secret." });
  }

  if (grantType === "authorization_code") {
    if (!payload.code || !payload.redirect_uri) {
      return res.status(400).json({ error: "invalid_request", error_description: "code and redirect_uri are required." });
    }
    const record = authCodes.get(payload.code);
    if (!record || record.used || record.expiresAt < Date.now() || record.clientId !== payload.client_id || record.redirectUri !== payload.redirect_uri) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code is invalid or expired." });
    }
    record.used = true;
    authCodes.set(payload.code, record);
    return res.json(issueTokenForCode(record.scope));
  }

  if (grantType === "refresh_token") {
    if (!payload.refresh_token) {
      return res.status(400).json({ error: "invalid_request", error_description: "refresh_token is required." });
    }
    return res.json(issueTokenForCode("mcp:tools:read mcp:tools:write"));
  }

  return res.status(400).json({ error: "unsupported_grant_type", error_description: "Only authorization_code and refresh_token are supported." });
};

app.post("/token", handleTokenEndpoint);
app.post("/oauth/token", handleTokenEndpoint);

app.post("/register", (req, res) => {
  const payload = req.body ?? {};
  const clientId = randomUUID();
  res.status(201).json({
    client_id: String(clientId),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: payload.token_endpoint_auth_method || "none",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: payload.redirect_uris || []
  });
});

const handleMcpRequest = (scope?: McpPartScope) => async (req: express.Request, res: express.Response) => {
  res.setHeader("MCP-Protocol-Version", MCP_DISCOVERY_HEADER);
  const token = extractBearerToken(req);
  const bearerPresent = Boolean(token);
  if (MCP_STRICT_AUTH && bearerPresent && !isValidBearerToken(token)) {
    return res.status(401).json({
      error: "invalid_token",
      error_description: "OAuth access token is missing or expired."
    });
  }

  const body = req.body as {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
  };

  if (!body || typeof body !== "object" || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return res.status(400).json(toMcpError(body?.id, -32600, "Invalid JSON-RPC 2.0 payload."));
  }

  const id = body.id;
  const method = body.method.replace(/\./g, "/");

  if (method === "initialize") {
    return res.json(toMcpResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {
          listChanged: false
        },
        resources: {
          subscribe: false,
          listChanged: false
        }
      },
      serverInfo: {
        name: "agentic-coworker-future-demo",
        version: "0.1.0"
      }
    }));
  }

  if (method === "notifications/initialized") {
    return res.status(204).send();
  }

  if (method === "tools/list") {
    return res.json(toMcpResult(id, { tools: emitMcpTools(scope) }));
  }

  if (method === "resources/list") {
    return res.json(toMcpResult(id, { resources: listUiResources(scope) }));
  }

  if (method === "resources/templates/list") {
    return res.json(toMcpResult(id, { resourceTemplates: listUiResourceTemplates(scope) }));
  }

  if (method === "resources/read") {
    const params = (body.params ?? {}) as { uri?: string };
    if (!params.uri) {
      return res.status(400).json(toMcpError(id, -32602, "resources/read missing uri."));
    }
    const resource = readUiResource(params.uri, scope);
    if (!resource) {
      return res.status(404).json(toMcpError(id, -32004, `Resource not found: ${params.uri}`));
    }
    return res.json(toMcpResult(id, {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: resource.text,
          _meta: resource._meta
        }
      ]
    }));
  }

  if (method === "tools/call") {
    const params = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    if (!params.name) {
      return res.status(400).json(toMcpError(id, -32602, "Tool call missing tool name."));
    }
    if (!isToolAllowed(scope, params.name)) {
      return res.status(400).json(toMcpError(id, -32601, `Tool ${params.name} is not available for this app scope.`));
    }
    const call = await invokeTool(params.name, params.arguments ?? {});
    if (!call.success) {
      return res.status(400).json(toMcpError(id, -32003, call.error || "Tool execution failed"));
    }
    return res.json(toWidgetMcpResult(id, params.name, call.data));
  }

  if (method === "ping") {
    return res.json(toMcpResult(id, {}));
  }

  return res.status(400).json(toMcpError(id, -32601, `Method not supported: ${body.method}`));
};

const unifiedMcpHandler = handleMcpRequest();
const part1McpHandler = handleMcpRequest("part-1");
const part2McpHandler = handleMcpRequest("part-2");

app.get(["/api/mcp", "/sse"], (_req, res) => {
  res.status(200).send("MCP endpoint ready. Use POST JSON-RPC 2.0 for initialize, tools/list, tools/call, resources/list, resources/templates/list, and resources/read.");
});
app.post(["/api/mcp", "/sse"], unifiedMcpHandler);
// Part-specific MCP namespaces (for two distinct ChatGPT experiences).
app.post("/api/apps/part-1/mcp", part1McpHandler);
app.post("/api/apps/part-2/mcp", part2McpHandler);

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
    tripStyle: payload.tripStyle,
    templateId: payload.templateId,
    startFromScratch: payload.startFromScratch
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

app.get("/api/ops/dashboard", (_req, res) => {
  res.json(assembleDashboardPayload());
});

app.get("/api/van/templates", (_req, res) => {
  res.json(getVanTemplates());
});

app.get("/api/assets/visual-manifest", (_req, res) => {
  res.json(getVisualAssetManifest());
});

app.get("/api/part1/flowState", (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId required" });
  }
  const data = getSession(sessionId);
  if (!data) return res.status(404).json({ error: "Session not found" });
  res.json({
    sessionId: data.id,
    journey: data.journey,
    config: data.config,
    selectedOptions: data.selectedOptionIds,
    totalPrice: data.totalPrice,
    status: data.status,
    templateId: data.templateId,
    isFromScratch: data.isFromScratch
  });
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
  res.json(emitMcpTools());
});

app.get("/api/apps/part-1/mcp/tools", (_req, res) => {
  res.json(emitMcpTools("part-1"));
});

app.get("/api/apps/part-2/mcp/tools", (_req, res) => {
  res.json(emitMcpTools("part-2"));
});

app.post("/api/mcp/tools/:toolName/call", async (req, res) => {
  const call = await invokeTool(req.params.toolName, req.body ?? {});
  if (!call.success) {
    res.status(400).json({ ok: false, error: call.error });
    return;
  }
  const descriptor = getToolDescriptor(req.params.toolName);

  res.json({
    ok: true,
    tool: req.params.toolName,
    summary: toolSummaryLine(req.params.toolName, call.data),
    payload: buildWidgetEnvelope(req.params.toolName, call.data),
    meta: descriptor?._meta,
    data: call.data
  });
});

app.get("/", (_req, res) => {
  res.send("Configurate / Control / Customize demo running. Manifests: /api/apps/part-1/manifest and /api/apps/part-2/manifest. MCP endpoints: /api/mcp (unified) or /api/apps/part-1/mcp and /api/apps/part-2/mcp.");
});

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
