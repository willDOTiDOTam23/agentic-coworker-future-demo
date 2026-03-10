import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_DOCS_NOTICE, AGENT_SYSTEM_SPEC } from "../src/agents/specs.js";

const repoRoot = process.cwd();

function renderRootDoc() {
  const graphLines = AGENT_SYSTEM_SPEC.agents
    .map((agent) => {
      const handoffs = agent.handoffs.length ? agent.handoffs.join("; ") : "No downstream handoffs";
      return `- **${agent.name}**: ${agent.mission} Handoffs: ${handoffs}.`;
    })
    .join("\n");

  return `# Agents System

> ${AGENT_DOCS_NOTICE}

## Agent Graph
${graphLines}

## Shared Models
- Customer voice site: \`${AGENT_SYSTEM_SPEC.shared.realtimeModel}\`
- Ops agents: \`${AGENT_SYSTEM_SPEC.shared.opsModel}\`
- Visualization agent: \`${AGENT_SYSTEM_SPEC.shared.opsModel}\` with fixed \`low\` reasoning

## Shared Tools
${AGENT_SYSTEM_SPEC.shared.sharedTools.length ? AGENT_SYSTEM_SPEC.shared.sharedTools.map((toolName) => `- \`${toolName}\``).join("\n") : "- No shared tools"}

## Shared Input Envelope
- Session snapshot from \`config_sessions\`
- Recent turns from \`conversation_turns\`
- Existing artifact summaries from \`artifacts\`

## Shared Output Envelope
${AGENT_SYSTEM_SPEC.agents
  .map((agent) => `- ${agent.name} returns: ${agent.outputContract.join(", ")}.`)
  .join("\n")}

## Handoff Thresholds
${AGENT_SYSTEM_SPEC.shared.handoffThresholds.map((line) => `- ${line}`).join("\n")}

## Artifact Ownership
- Configuration Visualizer owns \`config_sessions.visual_spec_json\` updates.
- Design Planner owns \`design-brief\` artifact generation.
- Supply Orchestrator owns \`supply-order\` artifact generation.
- Artifacts are append-only revisions stored in \`artifacts\`.

## SSE Event Taxonomy
${AGENT_SYSTEM_SPEC.shared.sseEventTypes.map((eventType) => `- \`${eventType}\``).join("\n")}

## SQLite Tables
${AGENT_SYSTEM_SPEC.shared.sqliteTables.map((tableName) => `- \`${tableName}\``).join("\n")}

## Reasoning Configuration
- Env var: \`${AGENT_SYSTEM_SPEC.shared.reasoningEnvVar}\`
- Allowed values: ${AGENT_SYSTEM_SPEC.shared.reasoningValues.map((value) => `\`${value}\``).join(", ")}
- Default: \`high\`
`;
}

function renderAgentDoc(agent: (typeof AGENT_SYSTEM_SPEC.agents)[number]) {
  return `# ${agent.name}

> ${AGENT_DOCS_NOTICE}

## Mission
${agent.mission}

## System Prompt Summary
${agent.systemPromptSummary}

## Tool Definitions
${(agent.tools.length ? agent.tools : ["No tools"]).map((toolName) => `- \`${toolName}\``).join("\n")}

## Input Contract
${agent.inputContract.map((line) => `- ${line}`).join("\n")}

## Output Contract
${agent.outputContract.map((line) => `- ${line}`).join("\n")}

## Handoff Conditions
${(agent.handoffs.length ? agent.handoffs : ["No downstream handoffs"]).map((line) => `- ${line}`).join("\n")}

## Artifact Responsibilities
${(agent.artifactOutputs.length ? agent.artifactOutputs : ["No artifact output"]).map((line) => `- ${line}`).join("\n")}

## Failure Behavior
${agent.failureBehavior}

## Example Run Triggers
${agent.exampleTriggers.map((line) => `- ${line}`).join("\n")}
`;
}

async function main() {
  await fs.writeFile(path.join(repoRoot, "agents.md"), renderRootDoc(), "utf8");

  await Promise.all(
    AGENT_SYSTEM_SPEC.agents.map((agent) =>
      fs.writeFile(path.join(repoRoot, agent.folder, "agents.md"), renderAgentDoc(agent), "utf8")
    )
  );
}

void main();
