import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIGURATE_RESOURCE_URI, CONTROL_RESOURCE_URI, McpPartScope } from "./tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

interface UiResourceRecord {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  filePath: string;
  widgetDescription: string;
  scope: McpPartScope | "shared";
}

interface UiTemplateRecord {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
  scope: McpPartScope | "shared";
}

const resources: UiResourceRecord[] = [
  {
    uri: CONFIGURATE_RESOURCE_URI,
    name: "Configurate Session Card",
    description: "Template-backed UI card for Configurate customer journey state.",
    mimeType: "text/html;profile=mcp-app",
    filePath: path.join(rootDir, "public/widgets/configurate-session-card.html"),
    widgetDescription:
      "Interactive Configurate 5-step configurator. The card contains selectable controls for each step and should be the primary UX. Keep assistant prose to one short line and direct the user to use the card controls.",
    scope: "part-1"
  },
  {
    uri: CONTROL_RESOURCE_URI,
    name: "Control Priority Board",
    description: "Template-backed UI card for Control ranked board state.",
    mimeType: "text/html;profile=mcp-app",
    filePath: path.join(rootDir, "public/widgets/control-priority-board.html"),
    widgetDescription: "Interactive Control board with ranked issues and immediate fix visibility.",
    scope: "part-2"
  }
];

const templates: UiTemplateRecord[] = [
  {
    uriTemplate: "ui://configurate/{surface}.html",
    name: "Configurate UI Templates",
    description: "Parameterized template namespace for Configurate UI resources.",
    mimeType: "text/html;profile=mcp-app",
    scope: "part-1"
  },
  {
    uriTemplate: "ui://control/{surface}.html",
    name: "Control UI Templates",
    description: "Parameterized template namespace for Control UI resources.",
    mimeType: "text/html;profile=mcp-app",
    scope: "part-2"
  }
];

function scopeAllows(scope: McpPartScope | undefined, resourceScope: McpPartScope | "shared") {
  if (!scope) return true;
  return resourceScope === "shared" || resourceScope === scope;
}

export function listUiResources(scope?: McpPartScope) {
  return resources
    .filter((resource) => scopeAllows(scope, resource.scope))
    .map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
}

export function listUiResourceTemplates(scope?: McpPartScope) {
  return templates
    .filter((template) => scopeAllows(scope, template.scope))
    .map((template) => ({
      uriTemplate: template.uriTemplate,
      name: template.name,
      description: template.description,
      mimeType: template.mimeType
    }));
}

export function readUiResource(uri: string, scope?: McpPartScope) {
  const resource = resources.find((candidate) => candidate.uri === uri);
  if (!resource || !scopeAllows(scope, resource.scope)) {
    return null;
  }

  if (!fs.existsSync(resource.filePath)) {
    return null;
  }

  return {
    uri: resource.uri,
    mimeType: resource.mimeType,
    text: fs.readFileSync(resource.filePath, "utf8"),
    _meta: {
      ui: {
        prefersBorder: true
      },
      "openai/widgetDescription": resource.widgetDescription
    }
  };
}
