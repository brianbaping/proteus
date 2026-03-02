import {
  consumeInboxMessages
} from "./chunk-OXAFMJZU.js";

// src/config/global.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
var FORGE_DIR = join(homedir(), ".proteus-forge");
var CONFIG_PATH = join(FORGE_DIR, "config.json");
function getForgeDir() {
  return FORGE_DIR;
}
function getGlobalConfigPath() {
  return CONFIG_PATH;
}
async function ensureForgeDir() {
  if (!existsSync(FORGE_DIR)) {
    await mkdir(FORGE_DIR, { recursive: true });
  }
}
function getDefaultGlobalConfig() {
  return {
    forgeVersion: "1.0.0",
    providers: {
      anthropic: {
        type: "anthropic",
        apiKey: "$ANTHROPIC_API_KEY"
      }
    },
    tiers: {
      fast: { provider: "anthropic", model: "claude-haiku-4-5" },
      standard: { provider: "anthropic", model: "claude-sonnet-4-6" },
      advanced: { provider: "anthropic", model: "claude-opus-4-6" }
    },
    roles: {
      scout: "fast",
      "build-team": "fast",
      "inspect-specialist": "standard",
      synthesizer: "standard",
      "style-lead": "standard",
      "design-specialist": "advanced",
      "plan-generator": "standard",
      "execute-agent": "advanced",
      "qa-agent": "standard",
      "verify-fix": "standard"
    }
  };
}
async function readGlobalConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }
  const content = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(content);
}
async function writeGlobalConfig(config) {
  await ensureForgeDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}
function globalConfigExists() {
  return existsSync(CONFIG_PATH);
}

// src/session/launcher.ts
import { query } from "@anthropic-ai/claude-agent-sdk";

// src/utils/api-key.ts
async function resolveApiKey() {
  const config = await readGlobalConfig();
  const apiKey = config?.providers?.anthropic?.apiKey;
  if (!apiKey) return process.env.ANTHROPIC_API_KEY;
  if (apiKey.startsWith("$")) return process.env[apiKey.slice(1)];
  return apiKey;
}

// src/session/launcher.ts
async function launchSession(options) {
  const startTime = Date.now();
  let sessionId = "";
  let resultMessage;
  const apiKey = await resolveApiKey();
  const sdkOptions = {
    cwd: options.cwd,
    additionalDirectories: options.additionalDirectories,
    model: options.model,
    maxBudgetUsd: options.maxBudgetUsd,
    permissionMode: options.permissionMode ?? "acceptEdits",
    settingSources: ["user", "project"],
    persistSession: false,
    ...apiKey ? { env: { ...process.env, ANTHROPIC_API_KEY: apiKey } } : {}
  };
  try {
    const session = query({ prompt: options.prompt, options: sdkOptions });
    let inboxCleanup;
    if (options.inboxDir) {
      const abortController = new AbortController();
      inboxCleanup = () => abortController.abort();
      const inboxStream = createInboxStream(
        options.inboxDir,
        abortController.signal
      );
      session.streamInput(inboxStream).catch(() => {
      });
    }
    for await (const message of session) {
      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        sessionId = message.session_id;
      }
      if (message.type === "result") {
        resultMessage = message;
      }
      if (options.onMessage) {
        options.onMessage(message);
      }
    }
    if (inboxCleanup) inboxCleanup();
  } catch (err) {
    const durationMs2 = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : "Unknown error during session";
    console.error(`
  Session error: ${errorMsg}`);
    return {
      success: false,
      sessionId,
      errors: [errorMsg],
      cost: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        teammates: 0,
        tier: options.model ?? "default",
        duration: formatDuration(durationMs2),
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: resultMessage?.total_cost_usd ?? 0
      }
    };
  }
  const durationMs = Date.now() - startTime;
  const durationStr = formatDuration(durationMs);
  if (resultMessage && resultMessage.subtype === "success") {
    const totalInputTokens = Object.values(resultMessage.modelUsage).reduce(
      (sum, u) => sum + u.inputTokens,
      0
    );
    const totalOutputTokens = Object.values(resultMessage.modelUsage).reduce(
      (sum, u) => sum + u.outputTokens,
      0
    );
    return {
      success: true,
      sessionId,
      result: resultMessage.result,
      cost: {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        teammates: 0,
        tier: options.model ?? "default",
        duration: durationStr,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCost: resultMessage.total_cost_usd
      }
    };
  }
  const errors = resultMessage && "errors" in resultMessage ? resultMessage.errors : [];
  return {
    success: false,
    sessionId,
    errors,
    cost: {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      teammates: 0,
      tier: options.model ?? "default",
      duration: durationStr,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: resultMessage?.total_cost_usd ?? 0
    }
  };
}
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1e3);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
async function* createInboxStream(inboxDir, signal, pollIntervalMs = 3e3) {
  const targetPath = inboxDir.replace(
    /\/.proteus-forge\/05-execute\/inbox\/?$/,
    ""
  );
  while (!signal.aborted) {
    const messages = await consumeInboxMessages(targetPath);
    for (const msg of messages) {
      const text = `[USER MESSAGE for teammate "${msg.targetAgent}"] The user wants you to relay this to the "${msg.targetAgent}" teammate immediately: ${msg.message}`;
      yield {
        type: "user",
        message: { role: "user", content: text },
        parent_tool_use_id: null,
        session_id: ""
      };
    }
    await new Promise((resolve2) => {
      const timer = setTimeout(resolve2, pollIntervalMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve2();
      }, { once: true });
    });
  }
}

// src/config/registry.ts
import { readFile as readFile2, writeFile as writeFile2 } from "fs/promises";
import { existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
var REGISTRY_PATH = join2(getForgeDir(), "projects.json");
function getDefaultRegistry() {
  return {
    activeProject: null,
    projects: {}
  };
}
async function readRegistry() {
  if (!existsSync2(REGISTRY_PATH)) {
    return getDefaultRegistry();
  }
  const content = await readFile2(REGISTRY_PATH, "utf-8");
  return JSON.parse(content);
}
async function writeRegistry(registry) {
  await ensureForgeDir();
  await writeFile2(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
}
async function registerProject(name, entry) {
  const registry = await readRegistry();
  registry.projects[name] = entry;
  registry.activeProject = name;
  await writeRegistry(registry);
}
async function unregisterProject(name) {
  const registry = await readRegistry();
  delete registry.projects[name];
  if (registry.activeProject === name) {
    const remaining = Object.keys(registry.projects);
    registry.activeProject = remaining.length > 0 ? remaining[0] : null;
  }
  await writeRegistry(registry);
}
async function setActiveProject(name) {
  const registry = await readRegistry();
  if (!registry.projects[name]) {
    throw new Error(`Project "${name}" not found. Run \`proteus-forge list\` to see available projects.`);
  }
  registry.activeProject = name;
  await writeRegistry(registry);
}
async function getActiveProject() {
  const registry = await readRegistry();
  if (!registry.activeProject || !registry.projects[registry.activeProject]) {
    return null;
  }
  return {
    name: registry.activeProject,
    entry: registry.projects[registry.activeProject]
  };
}
async function getProject(name) {
  const registry = await readRegistry();
  return registry.projects[name] ?? null;
}
async function updateProject(name, updates) {
  const registry = await readRegistry();
  if (!registry.projects[name]) {
    throw new Error(
      `Project "${name}" not found. Run \`proteus-forge list\` to see available projects.`
    );
  }
  registry.projects[name] = { ...registry.projects[name], ...updates };
  await writeRegistry(registry);
}

// src/config/project.ts
import { readFile as readFile3, writeFile as writeFile3, mkdir as mkdir2 } from "fs/promises";
import { existsSync as existsSync3 } from "fs";
import { join as join3 } from "path";
function getProjectForgeDir(targetPath) {
  return join3(targetPath, ".proteus-forge");
}
function getProjectConfigPath(targetPath) {
  return join3(targetPath, ".proteus-forge", "config.json");
}
async function ensureProjectDir(targetPath) {
  const forgeDir = getProjectForgeDir(targetPath);
  if (!existsSync3(forgeDir)) {
    await mkdir2(forgeDir, { recursive: true });
  }
}
async function readProjectConfig(targetPath) {
  const configPath = getProjectConfigPath(targetPath);
  if (!existsSync3(configPath)) {
    return null;
  }
  const content = await readFile3(configPath, "utf-8");
  return JSON.parse(content);
}
async function writeProjectConfig(targetPath, config) {
  await ensureProjectDir(targetPath);
  const configPath = getProjectConfigPath(targetPath);
  await writeFile3(configPath, JSON.stringify(config, null, 2) + "\n");
}
function createProjectConfig(name, sourcePath) {
  return {
    forgeVersion: "1.0.0",
    projectName: name,
    source: {
      path: sourcePath,
      readonly: true
    }
  };
}

// src/utils/stages.ts
import { existsSync as existsSync4, statSync } from "fs";
import { join as join4 } from "path";
import {
  STAGE_ARTIFACTS,
  STAGE_ORDER
} from "@proteus-forge/shared";
import {
  STAGE_ARTIFACTS as STAGE_ARTIFACTS2,
  STAGE_DIRS,
  STAGE_ORDER as STAGE_ORDER2,
  getStageDir,
  getStagesAfter,
  isValidStage,
  getStageOrder
} from "@proteus-forge/shared";
function getStageStatuses(targetPath) {
  const forgeDir = join4(targetPath, ".proteus-forge");
  return STAGE_ORDER.map((stage) => {
    const artifactPath = join4(forgeDir, STAGE_ARTIFACTS[stage]);
    const complete = existsSync4(artifactPath);
    let modifiedAt;
    if (complete) {
      modifiedAt = statSync(artifactPath).mtime;
    }
    return { stage, complete, artifactPath, modifiedAt };
  });
}
function getCurrentStage(targetPath) {
  const statuses = getStageStatuses(targetPath);
  const lastComplete = statuses.filter((s) => s.complete).pop();
  if (!lastComplete) return "new";
  const idx = STAGE_ORDER.indexOf(lastComplete.stage);
  if (idx === STAGE_ORDER.length - 1) return "done";
  return STAGE_ORDER[idx + 1];
}
function checkStaleness(targetPath) {
  const statuses = getStageStatuses(targetPath);
  const warnings = [];
  for (let i = 1; i < statuses.length; i++) {
    const current = statuses[i];
    const upstream = statuses[i - 1];
    if (current.complete && upstream.complete && upstream.modifiedAt && current.modifiedAt && upstream.modifiedAt > current.modifiedAt) {
      warnings.push({
        stage: current.stage,
        staleReason: `${upstream.stage} was modified after ${current.stage} was generated`
      });
    }
  }
  return warnings;
}

// src/utils/costs.ts
import { readFile as readFile4, writeFile as writeFile4 } from "fs/promises";
import { existsSync as existsSync5 } from "fs";
import { join as join5 } from "path";
function getCostsPath(targetPath) {
  return join5(targetPath, ".proteus-forge", "costs.json");
}
async function readCosts(targetPath) {
  const costsPath = getCostsPath(targetPath);
  if (!existsSync5(costsPath)) {
    return { stages: {}, totalCost: 0 };
  }
  const content = await readFile4(costsPath, "utf-8");
  return JSON.parse(content);
}
async function appendCostEntry(targetPath, stage, cost) {
  await ensureProjectDir(targetPath);
  const costs = await readCosts(targetPath);
  costs.stages[stage] = cost;
  costs.totalCost = Object.values(costs.stages).reduce(
    (sum, c) => sum + c.estimatedCost,
    0
  );
  await writeFile4(getCostsPath(targetPath), JSON.stringify(costs, null, 2) + "\n");
}
async function removeCostEntries(targetPath, stages) {
  const costsPath = getCostsPath(targetPath);
  if (!existsSync5(costsPath)) return;
  const costs = await readCosts(targetPath);
  for (const stage of stages) {
    delete costs.stages[stage];
  }
  costs.totalCost = Object.values(costs.stages).reduce(
    (sum, c) => sum + c.estimatedCost,
    0
  );
  await writeFile4(costsPath, JSON.stringify(costs, null, 2) + "\n");
}

// src/prompts/inspect.ts
function generateInspectLeadPrompt(sourcePath, targetPath) {
  return `You are the Scout for a Proteus Forge inspection. Your job is to analyze a source codebase and coordinate a team of domain specialists to produce a comprehensive feature inventory.

## CRITICAL: You MUST Use Agent Teams

You are REQUIRED to use the TeamCreate tool to create a team, then spawn specialist teammates using the Task tool. DO NOT attempt to do all the analysis yourself sequentially. The entire purpose of the Scout role is to identify domains and then delegate deep analysis to parallel specialists.

If you skip team creation and work alone, the output quality will be unacceptable. You MUST:
1. Use TeamCreate to create a team
2. Use the Task tool to spawn one specialist teammate per domain
3. Use TaskCreate to create tasks on the shared task list
4. Wait for specialists to complete their analysis in parallel
5. Synthesize their findings into the final output

## Source Repository (READ-ONLY)

Path: ${sourcePath}

Do NOT modify any files in this directory. It is a proof-of-concept that you are analyzing.

## Target Repository (write artifacts here)

Path: ${targetPath}

Write all inspection outputs under: ${targetPath}/.proteus-forge/01-inspect/

## Instructions

### Step 1: Scout the Source

Analyze the source repository at ${sourcePath}. Scan:
- File tree structure (directories, key files)
- Package manifests (package.json, requirements.txt, Cargo.toml, go.mod, etc.)
- Entry points (main files, index files, server startup)
- Configuration files (.env, docker-compose.yml, Dockerfile, CI configs)
- README and documentation
- Test directories and coverage

Identify the major domains of concern. Domains are functional areas like:
- Authentication & Security
- Data Layer (database, ORM, migrations)
- API / Service Layer (routes, controllers, services)
- Frontend / UI (components, state management, routing)
- DevOps / Infrastructure (Docker, CI/CD, deployment)
- Real-time / Messaging (WebSocket, queues)
- External Integrations (payment, email, storage)

Write your scout findings to: ${targetPath}/.proteus-forge/01-inspect/scout.json

The scout.json should contain:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "inspect",
  "substage": "scout",
  "generatedAt": "<ISO timestamp>",
  "source": {
    "path": "${sourcePath}",
    "name": "<repo name>",
    "fileCount": <number>,
    "primaryLanguage": "<language>"
  },
  "domains": [
    {
      "id": "domain-<name>",
      "name": "<Human readable domain name>",
      "specialist": "<name>-inspector",
      "entryFiles": ["<paths in source repo to start analyzing>"],
      "rationale": "<why this domain was identified>"
    }
  ]
}
\`\`\`

### Step 2: Create Agent Team (MANDATORY)

Use the TeamCreate tool NOW to create an agent team. Then for EACH domain you discovered, use the Task tool to spawn a teammate as a specialist inspector. You MUST have at least 2 specialists running in parallel.

Each specialist's spawn prompt should tell them:
1. They are inspecting a specific domain of the source at ${sourcePath} (read-only)
2. Which entry files to start with
3. To write their findings to ${targetPath}/.proteus-forge/01-inspect/partials/<domain-id>.json
4. To message other teammates about any cross-domain dependencies they discover
5. The schema for their partial output (see below)

The partial output schema for each specialist:
\`\`\`json
{
  "domainId": "<domain-id>",
  "specialist": "<specialist-name>",
  "generatedAt": "<ISO timestamp>",
  "features": [
    {
      "id": "feat-<NNN>",
      "name": "<Feature name>",
      "description": "<What this feature does>",
      "category": "<security|core-domain|infrastructure|frontend|devops|integration>",
      "sourceFiles": ["<files that implement this feature>"],
      "dependencies": ["<feat-IDs this depends on>"],
      "dependents": [],
      "complexity": "<low|medium|high>",
      "pocQuality": "<prototype|functional|solid>",
      "notes": "<Issues, gaps, or observations>"
    }
  ],
  "patterns": {
    "<key>": "<domain-specific structural observations>"
  },
  "crossDomainDependencies": [
    {
      "from": "<this domain-id>",
      "to": "<other domain-id>",
      "reason": "<why this dependency exists>"
    }
  ],
  "risks": ["<issues and risks found>"]
}
\`\`\`

Assign unique feature IDs across all specialists: specialist 1 uses feat-001 through feat-099, specialist 2 uses feat-100 through feat-199, etc. This prevents ID collisions during synthesis.

### Step 3: Create Tasks

Create a task on the shared task list for each domain specialist. Then create a final "synthesize" task that depends on all specialist tasks completing first.

### Step 4: Wait and Synthesize

Wait for all specialist tasks to complete. Then claim the synthesize task.

Read all partial findings from ${targetPath}/.proteus-forge/01-inspect/partials/ and merge them into a unified features.json.

During synthesis:
- Merge all features into a single array
- Resolve cross-domain dependencies (update feature \`dependencies\` and \`dependents\` fields)
- Deduplicate any features found by multiple specialists
- Compile all risks into a \`knownIssues\` array
- Identify the data model (database, ORM, entities)
- Identify external integrations
- Write a summary of the overall POC

Write the final output to TWO files:

1. **${targetPath}/.proteus-forge/01-inspect/features.json** \u2014 Machine-readable metadata
2. **${targetPath}/.proteus-forge/01-inspect/inspect.md** \u2014 Human-readable summary

The features.json schema:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "inspect",
  "generatedAt": "<ISO timestamp>",
  "source": {
    "path": "${sourcePath}",
    "name": "<repo name>",
    "primaryLanguage": "<language>",
    "languages": ["<all languages found>"],
    "frameworks": ["<all frameworks found>"],
    "entryPoints": ["<main entry files>"],
    "testCoverage": "<none|minimal|moderate|comprehensive>"
  },
  "features": [<merged features array>],
  "dataModel": {
    "store": "<database type>",
    "ormOrDriver": "<ORM or driver>",
    "entities": ["<entity names>"],
    "schemaFile": "<path to schema file if any>"
  },
  "integrations": [
    {
      "name": "<service name>",
      "type": "<payment|email|storage|messaging|etc>",
      "status": "<active|stubbed|partial>",
      "sourceFiles": ["<files>"]
    }
  ],
  "knownIssues": ["<all risks and issues>"],
  "summary": "<1-2 sentence summary of the POC>"
}
\`\`\`

The inspect.md should be a human-readable narrative covering:
- **Overview**: What the POC is and what it does (1-2 paragraphs)
- **Tech Stack**: Languages, frameworks, databases, and key libraries
- **Features Found**: Grouped by domain, with brief descriptions
- **Data Model**: Entities and relationships
- **Integrations**: External services and their status
- **Known Issues**: Risks, gaps, and technical debt
- **Summary Statistics**: Feature count, file count, test coverage level

This document is intended for human review \u2014 write it in clear prose, not JSON.

## Important

- The source repo at ${sourcePath} is READ-ONLY. Never modify it.
- Create the directories ${targetPath}/.proteus-forge/01-inspect/partials/ before specialists start writing.
- Ensure all feature IDs are unique across the entire features.json.
- Feature dependencies must reference valid feature IDs (no dangling refs).
- No circular dependencies in the feature graph.
`;
}

// src/utils/log.ts
import { appendFile } from "fs/promises";
import { join as join6 } from "path";
function getLogPath(targetPath) {
  return join6(targetPath, ".proteus-forge", "log.jsonl");
}
async function appendLogEntry(targetPath, entry) {
  await ensureProjectDir(targetPath);
  const logLine = JSON.stringify({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...entry
  });
  await appendFile(getLogPath(targetPath), logLine + "\n");
}

// src/utils/ansi.ts
var AGENT_COLORS = [
  "\x1B[36m",
  // cyan (lead)
  "\x1B[33m",
  // yellow
  "\x1B[35m",
  // magenta
  "\x1B[32m",
  // green
  "\x1B[34m",
  // blue
  "\x1B[91m",
  // bright red
  "\x1B[93m",
  // bright yellow
  "\x1B[95m"
  // bright magenta
];
var RESET = "\x1B[0m";
var BOLD = "\x1B[1m";
var DIM = "\x1B[2m";
var SHOW_CURSOR = "\x1B[?25h";

// src/utils/dashboard.ts
function extractAgentName(input) {
  if (input && typeof input === "object") {
    const obj = input;
    if (typeof obj.name === "string" && obj.name.length > 0) {
      return obj.name.length > 20 ? obj.name.slice(0, 20) : obj.name;
    }
    if (typeof obj.description === "string" && obj.description.length > 0) {
      return obj.description.length > 20 ? obj.description.slice(0, 17) + "..." : obj.description;
    }
  }
  return "agent";
}
var NOISE_PATTERNS = [
  /TaskOutput/i,
  /TaskCreate/i,
  /TaskUpdate/i,
  /TaskList/i,
  /TaskGet/i,
  /TaskStop/i,
  /SendMessage/i,
  /ExitPlanMode/i,
  /EnterPlanMode/i,
  /^I('ll| will| need to| should| want to) (use|call|invoke|run|check|now)/i,
  /^Let me (use|call|invoke|run|check)/i,
  /^Now (let me|I('ll| will))/i,
  /^Calling /i,
  /^Invoking /i,
  /\busing\s+(the\s+)?(Task|Read|Write|Edit|Bash|Grep|Glob|SendMessage|TodoWrite|TodoRead|TaskOutput|TaskStop|TeamCreate|TeamDelete|AskUserQuestion|EnterPlanMode|ExitPlanMode)\b/i,
  /TodoWrite/i,
  /TodoRead/i,
  /TaskOutput/i
];
function isInternalNoise(text) {
  return NOISE_PATTERNS.some((p) => p.test(text));
}
function summarizeText(text) {
  const sentenceMatch = text.match(/^(.+?[.!?])\s/);
  if (sentenceMatch && sentenceMatch[1].length <= 180) {
    return sentenceMatch[1];
  }
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 180) {
    return firstLine;
  }
  const base = firstLine.length > 0 ? firstLine : text;
  return base.slice(0, 177) + "...";
}
function describeToolUse(toolName, input) {
  const obj = input && typeof input === "object" ? input : null;
  switch (toolName) {
    case "Read":
      return obj?.file_path ? `Reading ${shortPath(String(obj.file_path))}` : "Reading file";
    case "Edit":
      return obj?.file_path ? `Editing ${shortPath(String(obj.file_path))}` : "Editing file";
    case "Write":
      return obj?.file_path ? `Writing ${shortPath(String(obj.file_path))}` : "Writing file";
    case "Bash":
      if (obj?.command) {
        const cmd = String(obj.command).split("\n")[0];
        return `Running: ${cmd.length > 50 ? cmd.slice(0, 47) + "..." : cmd}`;
      }
      return "Running command";
    case "Grep":
      return obj?.pattern ? `Searching for "${shortStr(String(obj.pattern), 30)}"` : "Searching";
    case "Glob":
      return obj?.pattern ? `Finding ${shortStr(String(obj.pattern), 40)}` : "Finding files";
    case "NotebookEdit":
      return obj?.notebook_path ? `Editing notebook ${shortPath(String(obj.notebook_path))}` : null;
    case "Task":
      return null;
    // handled separately as agent spawning
    case "TaskCreate":
    case "TaskUpdate":
    case "TaskList":
    case "TaskGet":
    case "TaskOutput":
    case "TaskStop":
    case "TodoWrite":
    case "TodoRead":
    case "TeamCreate":
    case "TeamDelete":
    case "AskUserQuestion":
    case "EnterPlanMode":
    case "ExitPlanMode":
      return null;
    // internal coordination, too noisy
    case "SendMessage":
      return obj?.recipient ? `Messaging ${shortStr(String(obj.recipient), 20)}` : null;
    default:
      return null;
  }
}
function shortPath(filePath) {
  const parts = filePath.split("/");
  if (parts.length <= 3) return filePath;
  return ".../" + parts.slice(-3).join("/");
}
function shortStr(s, maxLen) {
  return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
}
var AgentDashboard = class {
  constructor(stageName) {
    this.stageName = stageName;
    this.isTTY = process.stdout.isTTY ?? false;
    this.leadAgent = {
      id: "lead",
      name: "Lead",
      color: AGENT_COLORS[0],
      status: "idle",
      currentTool: null,
      lastProgressPrint: 0,
      spawnedAt: Date.now()
    };
  }
  leadAgent;
  agents = /* @__PURE__ */ new Map();
  nextColorIndex = 1;
  maxNameLen = 4;
  // "Lead"
  isTTY;
  agentCount = 0;
  onMessage(message) {
    if (message.type === "system" && "subtype" in message && message.subtype === "init") {
      this.printLine(this.leadAgent, `Session started (${this.stageName})`);
      return;
    }
    if (message.type === "assistant" && "message" in message) {
      const agent = this.resolveAgent(message.parent_tool_use_id);
      const content = message.message.content;
      if (!Array.isArray(content)) return;
      for (const block of content) {
        if (!block || typeof block !== "object" || !("type" in block)) continue;
        if (block.type === "tool_use" && "name" in block && block.name === "Task") {
          const name = extractAgentName(
            "input" in block ? block.input : void 0
          );
          const id = "id" in block ? String(block.id) : `task-${this.agentCount}`;
          const newAgent = this.registerAgent(id, name);
          this.printLine(agent, `Spawning teammate: ${newAgent.name}`);
          this.printLine(newAgent, "Started");
          continue;
        }
        if (block.type === "tool_use" && "name" in block) {
          const toolName = String(block.name);
          agent.currentTool = toolName;
          agent.status = "working";
          const desc = describeToolUse(toolName, "input" in block ? block.input : void 0);
          if (desc) {
            this.printLine(agent, desc);
          }
          continue;
        }
        if (block.type === "text" && "text" in block && typeof block.text === "string") {
          const text = block.text.trim();
          if (text.length > 0 && !isInternalNoise(text)) {
            const preview = text.length <= 200 ? text : summarizeText(text);
            if (preview) {
              this.printLine(agent, preview);
            }
          }
        }
      }
      return;
    }
    if (message.type === "tool_progress") {
      const agent = this.resolveAgent(message.parent_tool_use_id);
      agent.currentTool = message.tool_name;
      agent.status = "working";
      const now = Date.now();
      const elapsed = message.elapsed_time_seconds;
      if (elapsed >= 3 && now - agent.lastProgressPrint >= 5e3) {
        agent.lastProgressPrint = now;
        this.printLine(
          agent,
          `\u23F3 ${message.tool_name} (${Math.round(elapsed)}s)`
        );
      }
      return;
    }
    if (message.type === "user" && "tool_use_result" in message && message.tool_use_result != null) {
      if (message.parent_tool_use_id) {
        const agent = this.agents.get(message.parent_tool_use_id);
        if (agent && agent.status !== "done") {
          agent.status = "done";
          agent.currentTool = null;
          this.printLine(agent, "Done \u2713");
        }
      }
      return;
    }
    if (message.type === "result") {
      this.printSummary();
    }
  }
  cleanup() {
    if (this.isTTY) {
      process.stdout.write(SHOW_CURSOR);
    }
  }
  registerAgent(toolUseId, name) {
    this.agentCount++;
    const displayName = this.hasName(name) ? `${name}-${this.agentCount}` : name;
    if (displayName.length > this.maxNameLen) {
      this.maxNameLen = Math.min(displayName.length, 20);
    }
    const agent = {
      id: toolUseId,
      name: displayName,
      color: AGENT_COLORS[this.nextColorIndex % AGENT_COLORS.length],
      status: "spawning",
      currentTool: null,
      lastProgressPrint: 0,
      spawnedAt: Date.now()
    };
    this.nextColorIndex++;
    this.agents.set(toolUseId, agent);
    return agent;
  }
  hasName(name) {
    if (this.leadAgent.name === name) return true;
    for (const a of this.agents.values()) {
      if (a.name === name) return true;
    }
    return false;
  }
  resolveAgent(parentToolUseId) {
    if (!parentToolUseId) return this.leadAgent;
    return this.agents.get(parentToolUseId) ?? this.leadAgent;
  }
  printLine(agent, text) {
    const truncated = text.length > 70 ? text.slice(0, 67) + "..." : text;
    if (this.isTTY) {
      const prefix = `${agent.color}  \u25CF ${agent.name.padEnd(this.maxNameLen)}${RESET}`;
      process.stdout.write(`${prefix} ${truncated}
`);
    } else {
      process.stdout.write(`  [${agent.name}] ${truncated}
`);
    }
  }
  printSummary() {
    if (this.agents.size === 0) return;
    const teammates = [...this.agents.values()];
    process.stdout.write(
      `
  ${this.isTTY ? DIM : ""}Agent Team (${teammates.length} teammate${teammates.length === 1 ? "" : "s"}):${this.isTTY ? RESET : ""}
`
    );
    for (const a of teammates) {
      const elapsed = Math.round((Date.now() - a.spawnedAt) / 1e3);
      const elapsedStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`;
      if (this.isTTY) {
        process.stdout.write(
          `${a.color}    \u2022 ${a.name.padEnd(24)} ${a.status.padEnd(8)}${RESET} (${elapsedStr})
`
        );
      } else {
        process.stdout.write(
          `    - ${a.name.padEnd(24)} ${a.status.padEnd(8)} (${elapsedStr})
`
        );
      }
    }
  }
};

// src/utils/progress.ts
function createDashboard(stageName) {
  return new AgentDashboard(stageName);
}

// src/utils/terminal-reporter.ts
var terminalReporter = {
  log: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg)
};

// src/prompts/style.ts
function generateStyleLeadPrompt(sourcePath, targetPath) {
  return `You are the Lead for a Proteus Forge style stage. Your job is to analyze the source POC's visual identity and produce a comprehensive style guide that downstream stages will use to preserve the UI aesthetics in production.

## Context

The source POC is at: ${sourcePath} (read-only reference)
You are working in: ${targetPath}

The inspection findings are at:
  ${targetPath}/.proteus-forge/01-inspect/features.json

## Instructions

### Step 1: Read Inspection Findings

Read ${targetPath}/.proteus-forge/01-inspect/features.json to understand:
- What frameworks and languages the POC uses
- Whether there is a frontend/UI component
- What styling technologies are in use (CSS, Tailwind, styled-components, etc.)

### Step 2: Scan Styling Files

Scan the source repository at ${sourcePath} for all styling-related files:
- CSS/SCSS/LESS files
- Tailwind config (tailwind.config.js/ts)
- Theme files, design token files
- Component library config (e.g., shadcn components.json)
- Global style files (globals.css, app.css, index.css)
- CSS-in-JS theme objects
- Font imports and icon library usage

If the POC has no frontend or styling files (e.g., a pure backend/CLI project), write a minimal style guide with \`"stylingTechnology": "none"\` and skip detailed extraction.

### Step 3: Extract Visual Identity

For POCs with a frontend, extract:

**Colors**: Find the color palette \u2014 primary, secondary, accent, background, surface, text, error colors. Look in CSS custom properties, Tailwind config, theme objects, or hardcoded values.

**Typography**: Identify font families (heading, body, monospace), font sizes/scale, line heights, and font weights. Check for Google Fonts imports or local font files.

**Spacing**: Identify the spacing system \u2014 base unit, scale values. Look in Tailwind config, CSS custom properties, or repeated values.

**Layout**: Identify layout strategy (flexbox, grid, hybrid), responsive breakpoints, and common layout patterns (sidebar-main, top-nav-content, card-grid, etc.).

**Component Patterns**: Identify recurring UI components (buttons, cards, modals, forms, navigation) and their visual variants.

**Screen Layouts**: Walk each route/page in the app. For each screen (and significant modals/dialogs), document:
- The overall layout structure (which regions exist and where)
- What components live in each region and their arrangement
- Relative sizing and positioning of regions
- Source files that implement the screen

To discover screens: walk the router/page structure (e.g., React Router routes, Next.js pages/app directory, Vue Router). For each screen, read the JSX/HTML to identify layout regions and component placement. Document modals/dialogs as separate screens with \`type: "modal"\` and note what triggers them. If the POC has no frontend, set \`"screens": []\`.

**Design Tokens**: Check if the POC uses a formal design token system (CSS custom properties, Tailwind config, theme objects).

**Dark Mode**: Check if dark mode is supported and how it's implemented.

### Step 4: Write Outputs

Create the directory ${targetPath}/.proteus-forge/02-style/ and write two files:

**${targetPath}/.proteus-forge/02-style/style-guide.json** \u2014 Machine-readable style guide:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "style",
  "generatedAt": "<ISO timestamp>",
  "source": {
    "stylingTechnology": "tailwind|css-modules|styled-components|scss|css|none",
    "componentLibrary": "shadcn|mui|ant-design|none|...",
    "iconSet": "lucide|heroicons|...|none"
  },
  "colorPalette": {
    "primary": { "value": "#...", "usage": "..." },
    "secondary": { "value": "#...", "usage": "..." },
    "accent": { "value": "#...", "usage": "..." },
    "background": { "value": "#...", "usage": "..." },
    "surface": { "value": "#...", "usage": "..." },
    "text": { "value": "#...", "usage": "..." },
    "error": { "value": "#...", "usage": "..." },
    "custom": [ { "name": "...", "value": "#...", "usage": "..." } ]
  },
  "typography": {
    "fontFamilies": [ { "name": "...", "role": "heading|body|mono", "source": "google-fonts|local|system" } ],
    "scale": [ { "name": "xs|sm|base|lg|xl|2xl|...", "size": "...", "lineHeight": "...", "weight": "..." } ]
  },
  "spacing": {
    "unit": "rem|px|...",
    "scale": [ "0.25rem", "0.5rem", "..." ]
  },
  "layout": {
    "strategy": "flexbox|grid|hybrid",
    "responsive": { "breakpoints": { "sm": "...", "md": "...", "lg": "..." } },
    "patterns": [ { "name": "sidebar-main|top-nav-content|card-grid|...", "description": "...", "sourceFiles": [] } ]
  },
  "componentPatterns": [
    {
      "name": "button|card|modal|form|nav|...",
      "variants": [ "primary", "secondary", "ghost" ],
      "description": "...",
      "sourceFiles": []
    }
  ],
  "designTokens": {
    "hasTokenFile": true,
    "tokenFilePath": "...",
    "format": "css-custom-properties|tailwind-config|theme-object|..."
  },
  "screens": [
    {
      "name": "Dashboard",
      "route": "/dashboard",
      "type": "page|modal|drawer|panel",
      "description": "Brief description of the screen's purpose",
      "layout": "sidebar-main|top-nav-content|single-column|...",
      "regions": [
        {
          "name": "sidebar",
          "position": "left|right|top|bottom|center|overlay",
          "sizing": "w-64|flex-1|...",
          "components": [
            {
              "type": "nav|card-grid|form|table|header|button-group|...",
              "description": "What this component shows and how it's arranged",
              "details": {}
            }
          ]
        }
      ],
      "sourceFiles": ["src/pages/Dashboard.tsx"]
    }
  ],
  "darkMode": {
    "supported": false,
    "strategy": "class-toggle|media-query|css-variables|none"
  },
  "summary": "1-2 sentence overview of the POC's visual identity"
}
\`\`\`

**${targetPath}/.proteus-forge/02-style/style.md** \u2014 Human-readable style guide:
\`\`\`markdown
# Style Guide \u2014 <project name>

**Generated:** <date>
**Styling Technology:** <technology>

---

## Visual Overview
[1-2 paragraph summary of the POC's visual identity and design language]

## Styling Technology
[What CSS framework/approach the POC uses, component libraries, icon sets]

## Color Palette
[Document each color with its hex value, usage context, and where it appears in the source]

## Typography
[Font families, sizes, weights, line heights \u2014 the complete type scale]

## Layout System
[Layout strategy, responsive breakpoints, common layout patterns with descriptions]

## Component Patterns
[Recurring UI components, their variants, and visual characteristics]

## Screen Layouts
[For each screen/route: describe the layout regions, what components live where,
 and how the screen is spatially composed. Include modals and drawers.]

## Design Tokens
[Whether formal tokens exist, their format, and key token values]

## Recommendations for Production
[Suggestions for preserving or improving the visual identity in production:
- Which styling approach to keep vs migrate
- Any inconsistencies to resolve
- Missing tokens or patterns to formalize]
\`\`\`

## Important

- The source at ${sourcePath} is READ-ONLY. Never modify it.
- Read features.json FIRST to understand the project context.
- If the POC has no frontend/styling (pure backend, CLI, library), write a minimal style-guide.json with \`"stylingTechnology": "none"\` and a brief style.md noting this is a non-UI project. Do NOT fail.
- Extract actual values (hex codes, font names, pixel/rem sizes) \u2014 not just descriptions.
- Create the directory ${targetPath}/.proteus-forge/02-style/ before writing.
`;
}

// src/commands/style.ts
import { Command } from "commander";
import { existsSync as existsSync6 } from "fs";
import { mkdir as mkdir3 } from "fs/promises";
import { join as join7 } from "path";

// src/utils/resolve-project.ts
async function resolveProject(nameArg) {
  if (nameArg) {
    const entry = await getProject(nameArg);
    if (!entry) {
      throw new Error(
        `Project "${nameArg}" not found. Run \`proteus-forge list\` to see available projects.`
      );
    }
    return { name: nameArg, entry };
  }
  const active = await getActiveProject();
  if (!active) {
    throw new Error(
      "No active project set. Run `proteus-forge use <name>` or pass a project name."
    );
  }
  return active;
}

// src/utils/model-resolution.ts
function resolveModel(globalConfig, roleName, overrides = {}) {
  if (overrides.model) return overrides.model;
  if (overrides.tier) {
    const tierConfig2 = globalConfig.tiers[overrides.tier];
    if (!tierConfig2) {
      throw new Error(
        `Unknown tier "${overrides.tier}". Available: ${Object.keys(globalConfig.tiers).join(", ")}`
      );
    }
    return tierConfig2.model;
  }
  const role = globalConfig.roles[roleName];
  const tierName = typeof role === "string" ? role : void 0;
  const tierConfig = tierName ? globalConfig.tiers[tierName] : typeof role === "object" ? role : void 0;
  return tierConfig?.model;
}

// src/utils/git.ts
import { execFile } from "child_process";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
async function gitInit(cwd) {
  await execFileAsync("git", ["init"], { cwd });
}
async function gitAdd(cwd, paths) {
  await execFileAsync("git", ["add", ...paths], { cwd });
}
async function gitCommit(cwd, message) {
  const { stdout } = await execFileAsync(
    "git",
    ["commit", "-m", message, "--allow-empty"],
    { cwd }
  );
  return stdout.trim();
}
async function gitStageAndCommit(cwd, message) {
  await gitAdd(cwd, ["."]);
  return gitCommit(cwd, message);
}
async function getLastWaveCheckpoint(cwd) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--oneline", "--all", "--grep=proteus-forge: execute wave"],
      { cwd }
    );
    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    const match = lines[0].match(/proteus-forge: execute wave (\d+) complete/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

// src/commands/style.ts
async function runStyle(name, options, reporter = terminalReporter, onMessage) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    reporter.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  const featuresPath = join7(targetPath, ".proteus-forge", "01-inspect", "features.json");
  if (!existsSync6(featuresPath)) {
    reporter.error("Inspect stage not complete. Run `proteus-forge inspect` first.");
    return false;
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const model = resolveModel(globalConfig, "style-lead", { tier: options.tier, model: options.model });
  reporter.log(`
[${project.name}] Extracting style guide...
`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  reporter.log(`  Mode: single Lead session (no teammates)`);
  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch single Lead session:");
    reporter.log("    Reads: features.json, source CSS/style files");
    reporter.log("    Produces: style-guide.json + style.md");
    reporter.log(`
  Estimated cost: ~$0.05-0.20`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const styleDir = join7(targetPath, ".proteus-forge", "02-style");
  await mkdir3(styleDir, { recursive: true });
  const leadPrompt = generateStyleLeadPrompt(sourcePath, targetPath);
  reporter.log("\n  Launching session...\n");
  const dashboard = onMessage ? null : createDashboard("style");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: onMessage ?? ((msg) => dashboard.onMessage(msg))
  });
  if (dashboard) dashboard.cleanup();
  const styleGuidePath = join7(styleDir, "style-guide.json");
  const styleGuideExists = existsSync6(styleGuidePath);
  if ((result.success || styleGuideExists) && styleGuideExists) {
    const label = result.success ? "Style extraction complete" : "Style extraction recovered";
    reporter.log(`
[${project.name}] ${label}.
`);
    reporter.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: style complete" : "proteus-forge: style complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "style", result.cost);
    await appendLogEntry(targetPath, {
      action: "style",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    reporter.log(`
  Output: ${join7(styleDir, "style.md")}`);
    reporter.log(`          ${styleGuidePath}`);
    reporter.log(`  Review: proteus-forge review style`);
    reporter.log(`  Next:   proteus-forge design
`);
    return true;
  }
  reporter.error(`
[${project.name}] Style extraction failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }
  await appendLogEntry(targetPath, {
    action: "style",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; ")
  });
  return false;
}
var styleCommand = new Command("style").description("Extract the visual identity and style guide from the source POC").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").action(async (name, options) => {
  const success = await runStyle(name, options);
  if (!success) process.exit(1);
});

// src/commands/inspect.ts
import { Command as Command2 } from "commander";
import { existsSync as existsSync8 } from "fs";
import { mkdir as mkdir4 } from "fs/promises";
import { join as join9 } from "path";

// src/utils/team-summary.ts
import { readFile as readFile5 } from "fs/promises";
import { existsSync as existsSync7 } from "fs";
import { join as join8 } from "path";
async function printInspectTeamSummary(targetPath) {
  const scoutPath = join8(
    targetPath,
    ".proteus-forge",
    "01-inspect",
    "scout.json"
  );
  if (!existsSync7(scoutPath)) return;
  try {
    const content = await readFile5(scoutPath, "utf-8");
    const scout = JSON.parse(content);
    const domains = scout.domains ?? [];
    if (domains.length === 0) return;
    console.log(`
  Agent Team (${domains.length} specialists):`);
    for (const d of domains) {
      console.log(`    \u2022 ${d.specialist.padEnd(28)} ${d.name}`);
    }
  } catch {
  }
}
async function printDesignTeamSummary(targetPath) {
  const scopePath = join8(
    targetPath,
    ".proteus-forge",
    "02-design",
    "scope.json"
  );
  if (!existsSync7(scopePath)) return;
  try {
    const content = await readFile5(scopePath, "utf-8");
    const scope = JSON.parse(content);
    const domains = scope.designDomains ?? [];
    if (domains.length === 0) return;
    console.log(`
  Agent Team (${domains.length} specialists):`);
    for (const d of domains) {
      console.log(`    \u2022 ${d.specialist.padEnd(28)} ${d.name}`);
    }
  } catch {
  }
}

// src/commands/inspect.ts
async function runInspect(name, options, reporter = terminalReporter, onMessage) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    reporter.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  if (!existsSync8(sourcePath)) {
    reporter.error(`Source path not found: ${sourcePath}`);
    return false;
  }
  const globalConfig = await readGlobalConfig();
  const _projectConfig = await readProjectConfig(targetPath);
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const model = resolveModel(globalConfig, "scout", { tier: options.tier, model: options.model });
  reporter.log(`
[${project.name}] Inspecting source...
`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch Agent Team:");
    reporter.log("    Lead: scout (analyzes source, identifies domains)");
    reporter.log("    Teammates: one per discovered domain (spawned dynamically)");
    reporter.log("    Tasks: one per domain + synthesis");
    reporter.log(`
  Estimated cost: depends on source repo size`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const inspectDir = join9(targetPath, ".proteus-forge", "01-inspect");
  const partialsDir = join9(inspectDir, "partials");
  await mkdir4(partialsDir, { recursive: true });
  const leadPrompt = generateInspectLeadPrompt(sourcePath, targetPath);
  reporter.log("\n  Launching Agent Team...\n");
  const dashboard = onMessage ? null : createDashboard("inspect");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: onMessage ?? ((msg) => dashboard.onMessage(msg))
  });
  if (dashboard) dashboard.cleanup();
  const featuresPath = join9(inspectDir, "features.json");
  const featuresExist = existsSync8(featuresPath);
  if ((result.success || featuresExist) && featuresExist) {
    const label = result.success ? "Inspection complete" : "Inspection recovered";
    reporter.log(`
[${project.name}] ${label}.
`);
    await printInspectTeamSummary(targetPath);
    reporter.log(`
  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: inspect complete" : "proteus-forge: inspect complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "inspect", result.cost);
    await appendLogEntry(targetPath, {
      action: "inspect",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    reporter.log(`
  Output: ${join9(inspectDir, "inspect.md")}`);
    reporter.log(`          ${featuresPath}`);
    reporter.log(`  Review: proteus-forge review inspect`);
    reporter.log(`  Next:   proteus-forge design
`);
    if (!options.excludeStyle) {
      reporter.log(`  Running style extraction...
`);
      const styleOk = await runStyle(name, { budget: options.budget, tier: options.tier, model: options.model }, reporter, onMessage);
      if (!styleOk) {
        reporter.log(`  \u26A0 Style extraction failed \u2014 continuing without style guide.
`);
      }
    }
    return true;
  }
  reporter.error(`
[${project.name}] Inspection failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }
  await appendLogEntry(targetPath, {
    action: "inspect",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; ")
  });
  return false;
}
var inspectCommand = new Command2("inspect").description("Analyze the source POC and produce a feature inventory").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).option("--exclude-style", "Skip style extraction after inspect").option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").action(async (name, options) => {
  const success = await runInspect(name, options);
  if (!success) process.exit(1);
});

// src/utils/style-context.ts
import { existsSync as existsSync9 } from "fs";
import { join as join10 } from "path";
function hasStyleGuide(targetPath) {
  return existsSync9(
    join10(targetPath, ".proteus-forge", "02-style", "style-guide.json")
  );
}

// src/prompts/design.ts
function generateDesignLeadPrompt(sourcePath, targetPath, brief) {
  const briefSection = brief ? `
## User Architectural Requirements

The user has specified the following requirements for the production architecture. These take HIGHEST PRIORITY and must be followed by you and all specialists:

${brief}

Design the architecture to satisfy these requirements. If a requirement conflicts with what the POC currently uses, the user's requirement wins \u2014 the goal is to build the production system they want, not to replicate the POC's technology choices.

---

` : "";
  const styleGuideExists = hasStyleGuide(targetPath);
  const styleReadInstruction = styleGuideExists ? `

Also read ${targetPath}/.proteus-forge/02-style/style-guide.json to understand the POC's visual identity \u2014 styling technology, color palette, typography, layout patterns, component patterns, and screen-level compositions. This style guide must inform your frontend architecture decisions.` : "";
  const stylingStrategySection = styleGuideExists ? `

### Styling Strategy
[Specify the production styling approach \u2014 preserve the POC's approach or migrate to a recommended alternative. Reference the extracted color palette, typography scale, spacing values, and design tokens from 02-style/style-guide.json. Explain how the style guide will be implemented in production code.]` : "";
  return `You are the Lead Architect for a Proteus Forge design stage. Your job is to read the inspection findings and coordinate a team of design specialists to produce a production architecture.
${briefSection}
## Context

The source POC has been inspected. The findings are at:
  ${targetPath}/.proteus-forge/01-inspect/features.json

The original source code is available (read-only) at:
  ${sourcePath}

You are working in the target directory:
  ${targetPath}

## Instructions

### Step 1: Read Inspection Findings${styleGuideExists ? " and Style Guide" : ""}

Read ${targetPath}/.proteus-forge/01-inspect/features.json thoroughly. Understand:
- What features the POC implements
- What technologies it uses
- What integrations exist
- What known issues were identified
- The data model${styleReadInstruction}

### Step 2: Scope Design Domains

Based on the features and issues found, determine what design domains are needed. Typical domains:
- **Backend architecture** \u2014 service structure, API design, middleware, error handling
- **Data architecture** \u2014 schema redesign, migrations, caching, connection management
- **Frontend architecture** \u2014 component structure, state management, routing, API client
- **Security architecture** \u2014 auth redesign, secrets management, CORS, input validation
- **Infrastructure** \u2014 containerization, CI/CD, deployment, observability

Write your scoping decisions to: ${targetPath}/.proteus-forge/02-design/scope.json

The scope.json schema:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "design",
  "substage": "scope",
  "generatedAt": "<ISO timestamp>",
  "designDomains": [
    {
      "id": "design-<name>",
      "name": "<Human readable domain name>",
      "specialist": "<name>-designer",
      "implementsFeatures": ["<feat-IDs this domain covers>"],
      "designFocus": "<What this specialist should focus on designing>"
    }
  ]
}
\`\`\`

### Step 3: Create Agent Team

Create an agent team for the design stage. Spawn one teammate per design domain.

Each specialist's spawn prompt should tell them:
1. They are designing the production architecture for a specific domain
2. To read the features.json for context on what the POC does and its issues
3. The source code is at ${sourcePath} if they need to reference implementation details
4. To write their partial design to ${targetPath}/.proteus-forge/02-design/partials/<domain-id>.md (narrative) and ${targetPath}/.proteus-forge/02-design/partials/<domain-id>.json (machine-readable)
5. To message other specialists about cross-domain concerns (API contracts, shared types, data boundaries)

The partial JSON schema for each specialist:
\`\`\`json
{
  "domainId": "<design-domain-id>",
  "specialist": "<specialist-name>",
  "generatedAt": "<ISO timestamp>",
  "services": [
    {
      "id": "svc-<name>",
      "name": "<Service name>",
      "description": "<What this service does>",
      "implementsFeatures": ["<feat-IDs>"],
      "exposedInterfaces": [
        { "type": "REST|GraphQL|gRPC|WebSocket", "path": "<endpoint path>", "methods": ["<HTTP methods>"] }
      ],
      "ownedEntities": ["<entity names>"],
      "discipline": "<backend|frontend|data|devops>"
    }
  ],
  "decisions": [
    {
      "topic": "<What decision was made>",
      "choice": "<The chosen approach>",
      "rationale": "<Why this was chosen>",
      "alternatives": ["<Other approaches considered>"]
    }
  ],
  "crossDomainDependencies": [
    {
      "from": "<this domain>",
      "to": "<other domain>",
      "description": "<What needs to be coordinated>"
    }
  ]
}
\`\`\`

The partial markdown (.md) should be a human-readable narrative of the design for that domain.

### Step 4: Create Tasks

Create a task on the shared task list for each design specialist. Then create a final "synthesize" task that depends on all specialist tasks.

### Step 5: Wait and Synthesize

After all specialist tasks complete, claim the synthesize task. Read all partial designs and produce two unified outputs:

**${targetPath}/.proteus-forge/02-design/design.md** \u2014 Human-readable architecture document:
\`\`\`markdown
# Architecture Design \u2014 <project name>

**Generated:** <date>
**Architecture Style:** <style>
**Target Stack:** <technologies>

---

## Overview
[narrative description of the target architecture]

## Services / Modules
[for each service/module, describe responsibility, interfaces, owned entities]

## Data Architecture
[database redesign, schema changes, caching strategy, connection management]

## Security Architecture
[auth redesign, secrets management, CORS policy, input validation, authorization]

## Frontend Architecture
[component structure, state management, API client, routing]${stylingStrategySection}

## Infrastructure
[containerization, CI/CD, deployment strategy, observability, health checks]

## Migration Notes
[specific callouts from POC that need rework, in priority order]
\`\`\`

**${targetPath}/.proteus-forge/02-design/design-meta.json** \u2014 Machine-readable metadata:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "design",
  "generatedAt": "<ISO timestamp>",
  "architectureStyle": "<monolith|modular-monolith|microservices>",
  "targetStack": {
    "runtime": "<runtime and version>",
    "language": "<language and version>",
    "framework": "<backend framework>",
    "database": "<database and version>",
    "cache": "<cache technology if any>",
    "containerization": "<Docker etc>",
    "orchestration": "<K8s, ECS, etc>",
    "ci": "<CI/CD tool>"
  },
  "services": [<merged services from all specialists>],
  "sharedInfrastructure": {
    "apiGateway": <boolean>,
    "centralLogging": "<approach>",
    "monitoring": "<approach>"
  },
  "featureToServiceMap": {
    "<feat-ID>": "<svc-ID>"
  }
}
\`\`\`

Ensure every feature from features.json is mapped to at least one service in featureToServiceMap.

## Important

- Read features.json FIRST before doing anything else.
- The source at ${sourcePath} is READ-ONLY reference material.
- Create the directories ${targetPath}/.proteus-forge/02-design/partials/ before specialists start.
- Design for production quality \u2014 address the known issues from inspection.
- Keep the architecture pragmatic \u2014 don't over-engineer for a POC-to-production transformation.
`;
}

// src/commands/design.ts
import { Command as Command3 } from "commander";
import { existsSync as existsSync10 } from "fs";
import { mkdir as mkdir5, readFile as readFile6 } from "fs/promises";
import { join as join11, resolve } from "path";
async function runDesign(name, options, reporter = terminalReporter, onMessage) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    reporter.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  const featuresPath = join11(targetPath, ".proteus-forge", "01-inspect", "features.json");
  if (!existsSync10(featuresPath)) {
    reporter.error("Inspect stage not complete. Run `proteus-forge inspect` first.");
    return false;
  }
  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "design") {
      reporter.log(`  \u26A0 ${w.staleReason}. Consider re-running upstream stages first.
`);
    }
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const model = resolveModel(globalConfig, "design-specialist", { tier: options.tier, model: options.model });
  reporter.log(`
[${project.name}] Designing production architecture...
`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  let brief;
  if (options.briefFile) {
    const briefPath = resolve(options.briefFile);
    if (!existsSync10(briefPath)) {
      reporter.error(`Brief file not found: ${briefPath}`);
      return false;
    }
    brief = await readFile6(briefPath, "utf-8");
  } else if (options.brief) {
    brief = options.brief;
  }
  if (brief) {
    reporter.log(`  Brief: ${brief.length > 100 ? brief.slice(0, 100) + "..." : brief}`);
  }
  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch Agent Team:");
    reporter.log("    Lead: architect (reads features.json, scopes design domains)");
    reporter.log("    Teammates: one per design domain (spawned dynamically)");
    reporter.log("    Tasks: one per domain + synthesis");
    if (brief) reporter.log(`    Brief: user architectural requirements provided`);
    reporter.log(`
  Estimated cost: depends on feature count and complexity`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const designDir = join11(targetPath, ".proteus-forge", "02-design");
  await mkdir5(join11(designDir, "partials"), { recursive: true });
  const leadPrompt = generateDesignLeadPrompt(sourcePath, targetPath, brief);
  reporter.log("\n  Launching Agent Team...\n");
  const dashboard = onMessage ? null : createDashboard("design");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: onMessage ?? ((msg) => dashboard.onMessage(msg))
  });
  if (dashboard) dashboard.cleanup();
  const hasOutput = existsSync10(join11(designDir, "design.md")) || existsSync10(join11(designDir, "design-meta.json"));
  if ((result.success || hasOutput) && hasOutput) {
    const label = result.success ? "Design complete" : "Design recovered";
    reporter.log(`
[${project.name}] ${label}.
`);
    await printDesignTeamSummary(targetPath);
    reporter.log(`
  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: design complete" : "proteus-forge: design complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "design", result.cost);
    await appendLogEntry(targetPath, {
      action: "design",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    reporter.log(`
  Output: ${join11(designDir, "design.md")}`);
    reporter.log(`          ${join11(designDir, "design-meta.json")}`);
    reporter.log(`  Review: proteus-forge review design`);
    reporter.log(`  Next:   proteus-forge plan
`);
    return true;
  }
  reporter.error(`
[${project.name}] Design failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }
  await appendLogEntry(targetPath, {
    action: "design",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; ")
  });
  return false;
}
var designCommand = new Command3("design").description("Design the production architecture based on inspection findings").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).option("--brief <text>", "Architectural requirements (e.g., 'Use microservices with Go and gRPC')").option("--brief-file <path>", "Path to a file containing architectural requirements").option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").action(async (name, options) => {
  const success = await runDesign(name, options);
  if (!success) process.exit(1);
});

// src/prompts/plan.ts
function generatePlanLeadPrompt(sourcePath, targetPath) {
  const styleGuideExists = hasStyleGuide(targetPath);
  const styleInput = styleGuideExists ? `
4. ${targetPath}/.proteus-forge/02-style/style-guide.json \u2014 visual identity, styling technology, color palette, typography` : "";
  const styleTasks = styleGuideExists ? `
- Set up design tokens / theme configuration (reference \`02-style/style-guide.json\` for exact values)
- Migrate component styling (preserve the visual identity from the style guide)
- Implement responsive layout patterns (use breakpoints and patterns from the style guide)
- Reproduce screen compositions (use the \`screens\` array for component placement per route/page)` : "";
  return `You are the Lead Planner for a Proteus Forge plan stage. Your job is to read the architecture design and produce a detailed task DAG (directed acyclic graph) with execution waves for building the production application.

## Context

The source POC is at: ${sourcePath} (read-only reference)
You are working in: ${targetPath}

The inspection findings are at:
  ${targetPath}/.proteus-forge/01-inspect/features.json

The architecture design is at:
  ${targetPath}/.proteus-forge/02-design/design.md (human-readable, may have been edited)
  ${targetPath}/.proteus-forge/02-design/design-meta.json (machine-readable)

## Instructions

### Step 1: Read All Inputs

Read these files thoroughly:
1. ${targetPath}/.proteus-forge/02-design/design.md \u2014 the architecture document (authoritative if edited by user)
2. ${targetPath}/.proteus-forge/02-design/design-meta.json \u2014 services, stack, feature mapping
3. ${targetPath}/.proteus-forge/01-inspect/features.json \u2014 features, known issues, data model${styleInput}

### Step 2: Decompose Into Tasks

Break the design into implementable tasks. Each task should be:
- **Atomic**: completable by one agent in one session
- **Well-scoped**: clear file ownership, clear acceptance criteria
- **Dependency-aware**: explicitly declares what it depends on

For each service/module in the design, create tasks for:
- Schema/data setup (if the service owns entities)
- Core implementation (routes, controllers, services, repositories)
- Unit tests for the implementation
- Integration points with other services

Also create cross-cutting tasks:
- Project scaffolding (package.json, tsconfig, directory structure)
- Shared types and interfaces${styleTasks}
- Docker and CI/CD setup
- Integration tests (after services are built)

### Step 3: Assign Disciplines and Testing

Each task gets a discipline: \`data\`, \`backend\`, \`frontend\`, \`devops\`, \`qa\`, or \`shared\`.

Each task gets a testing expectation:
- \`"unit"\` \u2014 the implementing agent writes unit tests alongside the code
- \`"integration"\` \u2014 the QA track writes integration tests after implementation
- \`"none"\` \u2014 infrastructure/config tasks that don't need tests (e.g., Dockerfile)

### Step 4: Organize Into Waves

Group tasks into execution waves based on dependencies:
- **Wave 1**: Foundation \u2014 scaffolding, schema, shared types, Docker setup (no dependencies)
- **Wave 2+**: Build outward \u2014 each wave's tasks only depend on tasks from earlier waves
- **Final wave**: Testing, CI/CD, production readiness

Rules:
- No task in wave N may depend on a task in wave N or later
- Tasks within the same wave can execute in parallel
- Minimize the number of waves (maximize parallelism)

### Step 5: Write Outputs

Create two files:

**${targetPath}/.proteus-forge/03-plan/plan.json** \u2014 Machine-readable task DAG:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "plan",
  "generatedAt": "<ISO timestamp>",
  "tasks": [
    {
      "id": "task-001",
      "title": "<Short imperative title>",
      "description": "<What to implement, with enough detail for an agent to execute>",
      "discipline": "<data|backend|frontend|devops|qa|shared>",
      "service": "<svc-ID from design-meta.json>",
      "implementsFeatures": ["<feat-IDs>"],
      "dependsOn": ["<task-IDs>"],
      "estimatedComplexity": "<low|medium|high>",
      "testingExpectation": "<unit|integration|none>",
      "testScope": "<path where tests go, if applicable>",
      "acceptanceCriteria": [
        "<Specific, verifiable criteria>"
      ],
      "fileOwnership": ["<directories or files this task owns>"]
    }
  ],
  "executionWaves": [
    {
      "wave": 1,
      "tasks": ["<task-IDs in this wave>"],
      "rationale": "<Why these tasks are in this wave>"
    }
  ],
  "criticalPath": ["<task-IDs forming the longest dependency chain>"]
}
\`\`\`

**${targetPath}/.proteus-forge/03-plan/plan.md** \u2014 Human-readable narrative:
\`\`\`markdown
# Production Plan \u2014 <project name>

**Generated:** <date>
**Total Tasks:** <count>
**Estimated Waves:** <count>

## Executive Summary
[High-level description of the build approach]

## Wave 1 \u2014 <Wave Name>
[What happens in this wave and why]

### Tasks
- task-001: <title> (<discipline>)
- task-002: <title> (<discipline>)

## Wave 2 \u2014 <Wave Name>
[What happens and why]

### Tasks
- ...

## Critical Path
[The longest dependency chain and what it means for timeline]

## Risk Areas
[Specific things to watch out for during execution]
\`\`\`

## Important

- Read design.md FIRST \u2014 if the user edited it, their changes take priority over design-meta.json.
- Every feature from features.json should be covered by at least one task's \`implementsFeatures\`.
- File ownership must not overlap between tasks (each file/directory owned by exactly one task).
- Task IDs must be sequential: task-001, task-002, etc.
- Acceptance criteria should be specific and verifiable (not vague like "works correctly").
- Create the directory ${targetPath}/.proteus-forge/03-plan/ before writing.
`;
}

// src/commands/plan.ts
import { Command as Command4 } from "commander";
import { existsSync as existsSync11 } from "fs";
import { mkdir as mkdir6, readFile as readFile7 } from "fs/promises";
import { join as join12 } from "path";
async function runPlan(name, options, reporter = terminalReporter, onMessage) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    reporter.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  const designMdPath = join12(targetPath, ".proteus-forge", "02-design", "design.md");
  const designMetaPath = join12(targetPath, ".proteus-forge", "02-design", "design-meta.json");
  if (!existsSync11(designMdPath) && !existsSync11(designMetaPath)) {
    reporter.error("Design stage not complete. Run `proteus-forge design` first.");
    return false;
  }
  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "plan") {
      reporter.log(`  \u26A0 ${w.staleReason}. Consider re-running upstream stages first.
`);
    }
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const model = resolveModel(globalConfig, "plan-generator", { tier: options.tier, model: options.model });
  reporter.log(`
[${project.name}] Generating plan...
`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  reporter.log(`  Mode: single Lead session (no teammates)`);
  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch single Lead session:");
    reporter.log("    Reads: design.md, design-meta.json, features.json");
    reporter.log("    Produces: plan.json (task DAG) + plan.md (narrative)");
    reporter.log(`
  Estimated cost: ~$0.10-0.30`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const planDir = join12(targetPath, ".proteus-forge", "03-plan");
  await mkdir6(planDir, { recursive: true });
  const leadPrompt = generatePlanLeadPrompt(sourcePath, targetPath);
  reporter.log("\n  Launching session...\n");
  const dashboard = onMessage ? null : createDashboard("plan");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: onMessage ?? ((msg) => dashboard.onMessage(msg))
  });
  if (dashboard) dashboard.cleanup();
  const planJsonPath = join12(planDir, "plan.json");
  const planJsonExists = existsSync11(planJsonPath);
  let taskCount = 0;
  let waveCount = 0;
  if (planJsonExists) {
    try {
      const planData = JSON.parse(await readFile7(planJsonPath, "utf-8"));
      taskCount = planData.tasks?.length ?? 0;
      waveCount = planData.executionWaves?.length ?? 0;
    } catch {
    }
  }
  if ((result.success || planJsonExists) && planJsonExists) {
    const label = result.success ? "Plan complete" : "Plan recovered";
    reporter.log(`
[${project.name}] ${label}.
`);
    if (taskCount > 0) reporter.log(`  ${taskCount} tasks across ${waveCount} waves`);
    reporter.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: plan complete" : "proteus-forge: plan complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "plan", result.cost);
    await appendLogEntry(targetPath, {
      action: "plan",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    reporter.log(`
  Output: ${join12(planDir, "plan.md")}`);
    reporter.log(`          ${planJsonPath}`);
    reporter.log(`  Review: proteus-forge review plan`);
    reporter.log(`  Next:   proteus-forge split
`);
    return true;
  }
  reporter.error(`
[${project.name}] Plan failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }
  await appendLogEntry(targetPath, {
    action: "plan",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; ")
  });
  return false;
}
var planCommand = new Command4("plan").description("Generate a task DAG with execution waves from the design").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").action(async (name, options) => {
  const success = await runPlan(name, options);
  if (!success) process.exit(1);
});

// src/prompts/split.ts
function generateSplitLeadPrompt(targetPath) {
  const styleGuideExists = hasStyleGuide(targetPath);
  const styleReadInstruction = styleGuideExists ? `

Also read ${targetPath}/.proteus-forge/02-style/style-guide.json for the visual identity and screen layouts \u2014 frontend tracks should use this as context for styling tasks and component placement.` : "";
  return `You are the Lead for a Proteus Forge split stage. Your job is to read the task plan and partition tasks into discipline-specific tracks with file ownership boundaries.

## Context

You are working in: ${targetPath}

The task plan is at:
  ${targetPath}/.proteus-forge/03-plan/plan.json
  ${targetPath}/.proteus-forge/03-plan/plan.md

The design is at:
  ${targetPath}/.proteus-forge/02-design/design-meta.json

## Instructions

### Step 1: Read the Plan

Read ${targetPath}/.proteus-forge/03-plan/plan.json thoroughly. Understand every task's discipline, file ownership, and dependencies.

Also read ${targetPath}/.proteus-forge/02-design/design-meta.json for the service definitions.${styleReadInstruction}

### Step 2: Group Tasks by Discipline

Partition tasks into tracks based on their \`discipline\` field:
- **track-backend** \u2014 tasks with discipline "backend"
- **track-frontend** \u2014 tasks with discipline "frontend"
- **track-data** \u2014 tasks with discipline "data"
- **track-devops** \u2014 tasks with discipline "devops"
- **track-qa** \u2014 tasks with discipline "qa"
- **track-shared** \u2014 tasks with discipline "shared", plus any cross-cutting files

If a discipline has no tasks, omit that track.

### Step 3: Build File Ownership Maps

For each track, compile the complete file ownership map from all tasks in that track. Verify:
- No file or directory appears in more than one track (except track-shared)
- Files in track-shared do not appear in any other track
- Every task from plan.json is assigned to exactly one track

### Step 4: Determine Track Dependencies

A track depends on another track if any of its tasks depend on tasks in the other track. For example, if track-backend has task-008 which depends on task-004 (in track-data), then track-backend depends on track-data.

### Step 5: Build Context for Each Track

For each track, compile context that an execution agent would need:
- Target stack relevant to this discipline
- Services this track implements
- Shared patterns or conventions to follow
- The file ownership map (task \u2192 files)

### Step 6: Write Outputs

Create the directory ${targetPath}/.proteus-forge/04-tracks/ and write:

**manifest.json** \u2014 Track list and dependencies:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "split",
  "generatedAt": "<ISO timestamp>",
  "tracks": [
    {
      "id": "track-<discipline>",
      "discipline": "<discipline>",
      "taskCount": <number>,
      "file": "04-tracks/<discipline>.json",
      "dependsOnTracks": ["<track-IDs this track depends on>"],
      "requiredByTracks": ["<track-IDs that depend on this track>"]
    }
  ]
}
\`\`\`

**Individual track files** (e.g., backend.json):
\`\`\`json
{
  "trackId": "track-<discipline>",
  "discipline": "<discipline>",
  "tasks": ["<task-IDs in this track>"],
  "context": {
    "targetStack": "<relevant stack for this discipline>",
    "services": ["<svc-IDs this track implements>"],
    "sharedPatterns": "<conventions and patterns to follow>",
    "fileOwnershipMap": {
      "<task-ID>": ["<files/directories owned by this task>"]
    }
  }
}
\`\`\`

**shared.json** \u2014 Cross-cutting files:
\`\`\`json
{
  "trackId": "track-shared",
  "discipline": "shared",
  "tasks": ["<task-IDs with discipline 'shared'>"],
  "ownedFiles": ["<cross-cutting files: tsconfig, package.json, shared types, etc>"],
  "managedBy": "lead",
  "context": {
    "targetStack": "<relevant stack>",
    "services": [],
    "sharedPatterns": "<conventions>",
    "fileOwnershipMap": {
      "<task-ID>": ["<files>"]
    }
  }
}
\`\`\`

**split.md** \u2014 Human-readable overview at ${targetPath}/.proteus-forge/04-tracks/split.md:
- **Track Summary**: One section per track with its purpose, task count, and key responsibilities
- **File Ownership**: Which track owns which directories/files
- **Dependencies**: How tracks depend on each other (which must complete first)
- **Shared Track**: What the Lead handles directly vs what teammates build

This document is intended for human review \u2014 write it in clear prose, not JSON.

## Important

- Every task from plan.json must appear in exactly one track.
- No file ownership overlap between tracks (except track-shared which is exclusive).
- Track dependency graph must be a DAG (no circular dependencies between tracks).
- Create the directory ${targetPath}/.proteus-forge/04-tracks/ before writing.
`;
}

// src/commands/split.ts
import { Command as Command5 } from "commander";
import { existsSync as existsSync12 } from "fs";
import { mkdir as mkdir7, readFile as readFile8 } from "fs/promises";
import { join as join13 } from "path";
async function runSplit(name, options, reporter = terminalReporter, onMessage) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    reporter.error(err.message);
    return false;
  }
  const targetPath = project.entry.target;
  const planJsonPath = join13(targetPath, ".proteus-forge", "03-plan", "plan.json");
  if (!existsSync12(planJsonPath)) {
    reporter.error("Plan stage not complete. Run `proteus-forge plan` first.");
    return false;
  }
  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "split") {
      reporter.log(`  \u26A0 ${w.staleReason}. Consider re-running upstream stages first.
`);
    }
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const model = resolveModel(globalConfig, "plan-generator", { tier: options.tier, model: options.model });
  reporter.log(`
[${project.name}] Splitting into tracks...
`);
  reporter.log(`  Source: ${project.entry.source}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  reporter.log(`  Mode: single Lead session (no teammates)`);
  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch single Lead session:");
    reporter.log("    Reads: plan.json, design-meta.json");
    reporter.log("    Produces: manifest.json + per-discipline track files");
    reporter.log(`
  Estimated cost: ~$0.05-0.15`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const tracksDir = join13(targetPath, ".proteus-forge", "04-tracks");
  await mkdir7(tracksDir, { recursive: true });
  const leadPrompt = generateSplitLeadPrompt(targetPath);
  reporter.log("\n  Launching session...\n");
  const dashboard = onMessage ? null : createDashboard("split");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: onMessage ?? ((msg) => dashboard.onMessage(msg))
  });
  if (dashboard) dashboard.cleanup();
  const manifestPath = join13(tracksDir, "manifest.json");
  const manifestExists = existsSync12(manifestPath);
  let tracks = [];
  if (manifestExists) {
    try {
      const data = JSON.parse(await readFile8(manifestPath, "utf-8"));
      tracks = data.tracks ?? [];
    } catch {
    }
  }
  if ((result.success || manifestExists) && manifestExists) {
    const label = result.success ? "Split complete" : "Split recovered";
    reporter.log(`
[${project.name}] ${label}.
`);
    for (const t of tracks) {
      reporter.log(`  ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   (${t.discipline})`);
    }
    reporter.log(`
  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: split complete" : "proteus-forge: split complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "split", result.cost);
    await appendLogEntry(targetPath, {
      action: "split",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    reporter.log(`
  Output: ${join13(tracksDir, "split.md")}`);
    reporter.log(`          ${manifestPath}`);
    reporter.log(`  Review: proteus-forge review split`);
    reporter.log(`  Next:   proteus-forge execute
`);
    return true;
  }
  reporter.error(`
[${project.name}] Split failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }
  await appendLogEntry(targetPath, {
    action: "split",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; ")
  });
  return false;
}
var splitCommand = new Command5("split").description("Partition the plan into discipline-specific tracks").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").action(async (name, options) => {
  const success = await runSplit(name, options);
  if (!success) process.exit(1);
});

// src/prompts/execute.ts
import { readFile as readFile9 } from "fs/promises";
import { existsSync as existsSync13 } from "fs";
import { join as join14 } from "path";
async function loadExecuteContext(targetPath) {
  const tracksDir = join14(targetPath, ".proteus-forge", "04-tracks");
  const planPath = join14(targetPath, ".proteus-forge", "03-plan", "plan.json");
  const manifest = JSON.parse(
    await readFile9(join14(tracksDir, "manifest.json"), "utf-8")
  );
  const tracks = manifest.tracks ?? [];
  const trackDetails = /* @__PURE__ */ new Map();
  for (const track of tracks) {
    const trackPath = join14(targetPath, ".proteus-forge", track.file);
    if (existsSync13(trackPath)) {
      const detail = JSON.parse(
        await readFile9(trackPath, "utf-8")
      );
      trackDetails.set(track.id, detail);
    }
  }
  const plan = JSON.parse(await readFile9(planPath, "utf-8"));
  const tasks = plan.tasks ?? [];
  const waveCount = plan.executionWaves?.length ?? 0;
  return { tracks, trackDetails, tasks, waveCount };
}
function generateExecuteLeadPrompt(sourcePath, targetPath, ctx) {
  const styleGuideExists = hasStyleGuide(targetPath);
  const taskSummary = ctx.tasks.map(
    (t) => `  ${t.id}: "${t.title}" [${t.discipline}] depends on: [${t.dependsOn.join(", ")}]`
  ).join("\n");
  const teammateBlocks = ctx.tracks.filter((t) => t.discipline !== "shared").map((track) => {
    const detail = ctx.trackDetails.get(track.id);
    const taskIds = detail?.tasks ?? [];
    const context = detail?.context;
    const fileMap = context?.fileOwnershipMap ? Object.entries(context.fileOwnershipMap).map(([tid, files]) => `    ${tid}: ${files.join(", ")}`).join("\n") : "    (see track file)";
    return `
### ${track.id} \u2014 ${track.discipline} engineer
Tasks: ${taskIds.join(", ")} (${track.taskCount} tasks)
Stack: ${context?.targetStack ?? "see design"}
Services: ${context?.services?.join(", ") ?? "n/a"}
Patterns: ${context?.sharedPatterns ?? "n/a"}
File ownership:
${fileMap}`;
  }).join("\n");
  const sharedTrack = ctx.trackDetails.get("track-shared");
  const sharedBlock = sharedTrack ? `
### track-shared \u2014 managed by Lead
Tasks: ${sharedTrack.tasks.join(", ")}
These tasks are handled directly by you (the Lead), not by teammates.
File ownership:
${Object.entries(sharedTrack.context?.fileOwnershipMap ?? {}).map(([tid, files]) => `    ${tid}: ${files.join(", ")}`).join("\n")}
` : "";
  const styleContextLine = styleGuideExists ? `
4. ${targetPath}/.proteus-forge/02-style/style-guide.json \u2014 visual identity (colors, typography, spacing, layout patterns)` : "";
  const styleSpawnInstruction = styleGuideExists ? `
8. For frontend engineers: the style guide at ${targetPath}/.proteus-forge/02-style/style-guide.json is **visual and structural acceptance criteria** \u2014 the production UI must preserve the visual identity and screen layouts documented there. Use the exact color palette, typography scale, spacing values, and layout patterns. Reproduce the screen compositions from the \`screens\` array \u2014 place components in the same regions and arrangement as the POC. Do not invent new styles or rearrange screen layouts.` : "";
  return `You are the Orchestrator for a Proteus Forge execute stage. Your job is to coordinate a team of engineers to build production code based on the plan.

## Context

Source POC (read-only reference): ${sourcePath}
Target repo (build here): ${targetPath}

Architecture design: ${targetPath}/.proteus-forge/02-design/design.md
Plan: ${targetPath}/.proteus-forge/03-plan/plan.json
Tracks: ${targetPath}/.proteus-forge/04-tracks/

## All Tasks (${ctx.tasks.length} tasks across ${ctx.waveCount} waves)

${taskSummary}

## Instructions

### Step 1: Read Context

Read these files to understand the full picture:
1. ${targetPath}/.proteus-forge/02-design/design.md \u2014 the architecture
2. ${targetPath}/.proteus-forge/03-plan/plan.json \u2014 every task with acceptance criteria
3. Each track file in ${targetPath}/.proteus-forge/04-tracks/ \u2014 per-discipline context${styleContextLine}

Also have the source POC at ${sourcePath} available as reference for understanding the original implementation intent. Do NOT copy POC code \u2014 reimplement according to the design.

### Step 2: Handle Shared Tasks

Complete the shared-discipline tasks yourself (the Lead) before spawning teammates:
${sharedBlock}

These are foundation tasks (scaffolding, shared types) that must exist before any track engineer can work.

### Step 3: Create Agent Team

Create an agent team. Spawn one teammate per non-shared track:
${teammateBlocks}

Each teammate's spawn prompt should include:
1. Their role (e.g., "You are a backend engineer building production code")
2. The design document path to read for architecture context
3. Their specific tasks from plan.json with full descriptions and acceptance criteria
4. Their file ownership \u2014 they must NOT modify files outside their ownership
5. That the source POC at ${sourcePath} is read-only reference (do not copy code)
6. Testing expectations: if testingExpectation is "unit", write unit tests alongside code
7. To mark tasks complete on the shared task list when done
8. Before marking a task complete: run \`npx tsc --noEmit\` in the target repo to catch type errors, and run any unit tests for their owned files. Fix all errors before marking done${styleSpawnInstruction}

### Step 4: Create Tasks on Shared Task List

Create every task from the plan on the shared task list WITH their dependency chains. Agent Teams will auto-unblock tasks as dependencies complete.

Tasks that you (the Lead) already completed in Step 2 should be created as already completed.

### Step 5: Monitor and Coordinate

- Wait for teammates to complete their tasks
- If a teammate needs information about another track's output, relay it
- If a teammate fails a task, check the error and provide guidance
- Track-shared files that teammates need to modify should go through you

### Step 6: Finalize

After all tasks are complete:
1. Verify key files exist (package.json, tsconfig.json, main entry points)
2. **Run CI verification in the target repo** (MANDATORY before writing session.json):
   a. Detect the package manager from lockfiles (bun.lockb \u2192 pnpm-lock.yaml \u2192 yarn.lock \u2192 package-lock.json \u2192 default npm)
   b. Run \`<pm> install\` \u2014 must install cleanly with no errors
   c. For each script that exists in package.json, run: \`<pm> run build\`, \`<pm> run test\`, \`<pm> run lint\`
   d. If ANY check fails: diagnose the root cause, fix the code (yourself or delegate to the appropriate engineer), then re-run until all checks pass
   e. Only proceed to step 3 after ALL checks pass
3. Write a session summary to TWO files:
   - **${targetPath}/.proteus-forge/05-execute/session.json** \u2014 Machine-readable metadata
   - **${targetPath}/.proteus-forge/05-execute/execute.md** \u2014 Human-readable summary

The session.json schema:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "execute",
  "sessionId": "<your session ID>",
  "startedAt": "<ISO timestamp>",
  "completedAt": "<ISO timestamp>",
  "status": "completed",
  "progress": {
    "totalTasks": ${ctx.tasks.length},
    "completed": ${ctx.tasks.length},
    "failed": 0
  },
  "verification": {
    "packageManager": "<detected pm>",
    "install": "passed|failed|skipped",
    "build": "passed|failed|skipped",
    "test": "passed|failed|skipped",
    "lint": "passed|failed|skipped"
  }
}
\`\`\`

The execute.md should be a human-readable narrative covering:
- **What Was Built**: Overview of the production application
- **Architecture**: Services, components, and how they connect
- **Per-Track Summary**: What each teammate built, key files created
- **Testing**: What tests were written and coverage approach
- **Known Gaps**: Anything not completed or deferred
- **How to Run**: Commands to install, build, and start the application

This document is intended for human review \u2014 write it in clear prose, not JSON.

## Important

- The source at ${sourcePath} is READ-ONLY. Never modify it. Reimplement, don't copy.
- Each teammate owns specific files \u2014 enforce ownership boundaries.
- Teammates should write unit tests for tasks with testingExpectation "unit".
- Create ${targetPath}/.proteus-forge/05-execute/ directory before writing session.json.
- If you complete shared tasks first, ensure the scaffolding is committed/written before spawning teammates so they can build on it.
`;
}

// src/commands/execute.ts
import { Command as Command6 } from "commander";
import { existsSync as existsSync16 } from "fs";
import { mkdir as mkdir9 } from "fs/promises";
import { join as join17 } from "path";

// src/utils/verify.ts
import { execFile as execFile2 } from "child_process";
import { readFile as readFile10 } from "fs/promises";
import { existsSync as existsSync14 } from "fs";
import { join as join15 } from "path";
var LOCKFILE_PRIORITY = [
  { file: "bun.lockb", pm: "bun" },
  { file: "bun.lock", pm: "bun" },
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" }
];
var STEP_TIMEOUTS = {
  install: 5 * 6e4,
  build: 3 * 6e4,
  test: 5 * 6e4,
  lint: 3 * 6e4
};
function detectPackageManager(targetPath) {
  for (const { file, pm } of LOCKFILE_PRIORITY) {
    if (existsSync14(join15(targetPath, file))) {
      return pm;
    }
  }
  return "npm";
}
async function getAvailableScripts(targetPath) {
  const pkgPath = join15(targetPath, "package.json");
  try {
    const content = await readFile10(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    return new Set(Object.keys(pkg.scripts ?? {}));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function runCommand(command, args, cwd, timeoutMs) {
  return new Promise((resolve2) => {
    const proc = execFile2(command, args, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const output = (stdout ?? "") + (stderr ?? "");
      if (error) {
        resolve2({ success: false, output: output || error.message });
      } else {
        resolve2({ success: true, output });
      }
    });
    proc.on("error", (err) => {
      resolve2({ success: false, output: err.message });
    });
  });
}
async function runVerification(targetPath, options) {
  const pm = detectPackageManager(targetPath);
  const scripts = await getAvailableScripts(targetPath);
  const steps = [];
  const installStep = {
    name: "install",
    command: pm,
    args: ["install"],
    passed: false,
    skipped: options?.skipInstall ?? false,
    durationMs: 0
  };
  if (!installStep.skipped) {
    const start = Date.now();
    const result = await runCommand(pm, ["install"], targetPath, STEP_TIMEOUTS.install);
    installStep.durationMs = Date.now() - start;
    installStep.passed = result.success;
    if (!result.success) installStep.output = result.output;
  }
  steps.push(installStep);
  const scriptSteps = ["build", "test", "lint"];
  for (const stepName of scriptSteps) {
    const hasScript = scripts.has(stepName);
    const step = {
      name: stepName,
      command: pm,
      args: ["run", stepName],
      passed: false,
      skipped: !hasScript,
      durationMs: 0
    };
    if (hasScript) {
      const start = Date.now();
      const result = await runCommand(pm, ["run", stepName], targetPath, STEP_TIMEOUTS[stepName]);
      step.durationMs = Date.now() - start;
      step.passed = result.success;
      if (!result.success) step.output = result.output;
    }
    steps.push(step);
  }
  const allPassed = steps.every((s) => s.skipped || s.passed);
  return { packageManager: pm, steps, allPassed };
}
var GREEN = "\x1B[32m";
var RED = "\x1B[31m";
function printVerifyResult(result, verbose) {
  console.log(`
${BOLD}  Verification Results${RESET} (${result.packageManager})
`);
  for (const step of result.steps) {
    if (step.skipped) {
      console.log(`  ${DIM}\u25CB ${step.name.padEnd(10)}${RESET} ${DIM}skipped${RESET}`);
    } else if (step.passed) {
      console.log(`  ${GREEN}\u2713 ${step.name.padEnd(10)}${RESET} passed  ${DIM}(${formatMs(step.durationMs)})${RESET}`);
    } else {
      console.log(`  ${RED}\u2717 ${step.name.padEnd(10)}${RESET} failed  ${DIM}(${formatMs(step.durationMs)})${RESET}`);
    }
  }
  if (verbose) {
    const failed = result.steps.filter((s) => !s.skipped && !s.passed);
    for (const step of failed) {
      if (step.output) {
        console.log(`
  ${RED}--- ${step.name} output ---${RESET}`);
        const lines = step.output.split("\n").slice(-30);
        for (const line of lines) {
          console.log(`  ${line}`);
        }
      }
    }
  }
  console.log(
    result.allPassed ? `
  ${GREEN}All checks passed.${RESET}
` : `
  ${RED}Some checks failed.${RESET} Run \`proteus-forge verify --verbose\` for details.
`
  );
}
function formatMs(ms) {
  if (ms < 1e3) return `${ms}ms`;
  return `${(ms / 1e3).toFixed(1)}s`;
}

// src/utils/scaffold-commands.ts
import { mkdir as mkdir8, writeFile as writeFile5, readFile as readFile11 } from "fs/promises";
import { existsSync as existsSync15 } from "fs";
import { join as join16 } from "path";
var CLAUDE_MD_SENTINEL = "## Repair Commands";
function fixBuildTemplate(pm) {
  return `---
description: Fix build and typecheck errors
---

Fix build/typecheck errors in this project.

## Context

Read these project artifacts for architecture context:
- \`.proteus-forge/02-design/design.md\` \u2014 system design
- \`.proteus-forge/03-plan/plan.md\` \u2014 implementation plan

## Steps

1. Run \`${pm} run build\` and capture the full error output
2. Read each file referenced in the errors
3. Fix the root cause of each error \u2014 do not suppress or work around type errors
4. Re-run \`${pm} run build\` to confirm the fix
5. Repeat until the build passes cleanly

## Focus

$ARGUMENTS

## Constraints

- Do not add \`any\` type casts or \`@ts-ignore\` comments
- Do not change the project's tsconfig or build configuration
- Do not alter the architecture or public API surface
- Keep fixes minimal \u2014 change only what is needed to resolve the error
`;
}
function fixTestsTemplate(pm) {
  return `---
description: Fix failing tests
---

Fix failing tests in this project.

## Context

Read these project artifacts for architecture context:
- \`.proteus-forge/02-design/design.md\` \u2014 system design
- \`.proteus-forge/03-plan/plan.md\` \u2014 implementation plan

## Steps

1. Run \`${pm} run test\` and capture the full error output
2. For each failing test, determine whether the bug is in the source code or the test
3. If the source code is wrong, fix the source code
4. If the test has an incorrect expectation due to a valid implementation change, update the test
5. Re-run \`${pm} run test\` to confirm all tests pass
6. Repeat until all tests pass

## Focus

$ARGUMENTS

## Constraints

- Do not delete or skip failing tests
- Do not weaken assertions (e.g., replacing exact matches with loose matchers)
- Do not change the architecture or public API surface
- Prefer fixing source code over modifying tests
- Keep fixes minimal \u2014 change only what is needed to make tests pass
`;
}
function fixLintTemplate(pm) {
  return `---
description: Fix lint errors
---

Fix lint errors in this project.

## Context

Read these project artifacts for architecture context:
- \`.proteus-forge/02-design/design.md\` \u2014 system design
- \`.proteus-forge/03-plan/plan.md\` \u2014 implementation plan

## Steps

1. Run \`${pm} run lint\` and capture the full error output
2. Read each file referenced in the errors
3. Fix the code to satisfy the lint rule \u2014 do not disable the rule
4. Re-run \`${pm} run lint\` to confirm the fix
5. Repeat until lint passes cleanly

## Focus

$ARGUMENTS

## Constraints

- Do not add eslint-disable comments or inline suppressions
- Do not modify eslint configuration or rules
- Do not add \`any\` type casts to satisfy lint rules
- Do not change the architecture or public API surface
- Keep fixes minimal \u2014 change only what is needed to resolve the lint error
`;
}
function fixAllTemplate(pm) {
  return `---
description: Full verify and fix cycle (build, test, lint)
---

Run full verification and fix all errors in this project.

## Context

Read these project artifacts for architecture context:
- \`.proteus-forge/02-design/design.md\` \u2014 system design
- \`.proteus-forge/03-plan/plan.md\` \u2014 implementation plan

## Steps

1. **Build**: Run \`${pm} run build\`. If it fails, fix all build/typecheck errors before proceeding.
2. **Test**: Run \`${pm} run test\`. If tests fail, fix source code or tests as appropriate.
3. **Lint**: Run \`${pm} run lint\`. If lint fails, fix the code to satisfy the rules.
4. **Final check**: Run all three again (\`${pm} run build && ${pm} run test && ${pm} run lint\`) to confirm everything passes.

## Focus

$ARGUMENTS

## Constraints

- Do not add \`any\` type casts, \`@ts-ignore\`, or \`eslint-disable\` comments
- Do not delete or skip tests, or weaken assertions
- Do not modify build config, tsconfig, or lint rules
- Do not change the architecture or public API surface
- Prefer fixing source code over modifying tests
- Keep fixes minimal \u2014 change only what is needed to resolve each error
`;
}
var COMMAND_TEMPLATES = [
  { filename: "fix-build.md", description: "Fix build/typecheck errors", body: fixBuildTemplate },
  { filename: "fix-tests.md", description: "Fix failing tests", body: fixTestsTemplate },
  { filename: "fix-lint.md", description: "Fix lint errors", body: fixLintTemplate },
  { filename: "fix-all.md", description: "Full verify and fix cycle", body: fixAllTemplate }
];
function buildClaudeMdSection() {
  return `
${CLAUDE_MD_SENTINEL}

These slash commands are available for fixing issues found by \`proteus-forge verify\`:

- \`/fix-build\` \u2014 Fix build and typecheck errors
- \`/fix-tests\` \u2014 Fix failing tests
- \`/fix-lint\` \u2014 Fix lint errors
- \`/fix-all\` \u2014 Full verify + fix cycle (build \u2192 test \u2192 lint)

Each command accepts an optional argument to focus on a specific file or error.
`;
}
async function scaffoldClaudeCommands(targetPath, options) {
  const pm = options?.packageManager ?? detectPackageManager(targetPath);
  const commandsDir = join16(targetPath, ".claude", "commands");
  await mkdir8(commandsDir, { recursive: true });
  const files = [];
  for (const template of COMMAND_TEMPLATES) {
    const filePath = join16(commandsDir, template.filename);
    await writeFile5(filePath, template.body(pm));
    files.push(filePath);
  }
  let claudeMdUpdated = false;
  const claudeMdPath = join16(targetPath, "CLAUDE.md");
  if (existsSync15(claudeMdPath)) {
    const content = await readFile11(claudeMdPath, "utf-8");
    if (!content.includes(CLAUDE_MD_SENTINEL)) {
      await writeFile5(claudeMdPath, content + buildClaudeMdSection());
      claudeMdUpdated = true;
    }
  }
  return { files, claudeMdUpdated };
}

// src/commands/execute.ts
async function runExecute(name, options, reporter = terminalReporter, onMessage) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    reporter.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  const manifestPath = join17(targetPath, ".proteus-forge", "04-tracks", "manifest.json");
  if (!existsSync16(manifestPath)) {
    reporter.error("Split stage not complete. Run `proteus-forge split` first.");
    return false;
  }
  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "execute") {
      reporter.log(`  \u26A0 ${w.staleReason}. Consider re-running upstream stages first.
`);
    }
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  let ctx;
  try {
    ctx = await loadExecuteContext(targetPath);
  } catch (err) {
    reporter.error(`Failed to load execute context: ${err.message}`);
    return false;
  }
  const model = resolveModel(globalConfig, "execute-agent", { tier: options.tier, model: options.model });
  const nonSharedTracks = ctx.tracks.filter((t) => t.discipline !== "shared");
  reporter.log(`
[${project.name}] Executing production build...
`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  reporter.log(`  Tasks: ${ctx.tasks.length} across ${ctx.waveCount} waves`);
  reporter.log(`  Teammates: ${nonSharedTracks.length}
`);
  for (const t of ctx.tracks) {
    const marker = t.discipline === "shared" ? "(Lead)" : "";
    reporter.log(`    ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   ${marker}`);
  }
  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch Agent Team:");
    reporter.log("    Lead: orchestrator (handles shared tasks, coordinates)");
    for (const t of nonSharedTracks) {
      reporter.log(`    Teammate: ${t.id.replace("track-", "")}-engineer (${t.taskCount} tasks)`);
    }
    reporter.log(`
  Estimated cost: depends on task complexity (typically $5-15)`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const executeDir = join17(targetPath, ".proteus-forge", "05-execute");
  const inboxDir = join17(executeDir, "inbox");
  await mkdir9(inboxDir, { recursive: true });
  reporter.log(`
  Inbox active \u2014 send messages with: proteus-forge inform <agent> "<message>"
`);
  const leadPrompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
  reporter.log("  Launching Agent Team...\n");
  const dashboard = onMessage ? null : createDashboard("execute");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    inboxDir,
    onMessage: onMessage ?? ((msg) => dashboard.onMessage(msg))
  });
  if (dashboard) dashboard.cleanup();
  const hasOutput = existsSync16(join17(targetPath, "src")) || existsSync16(join17(targetPath, "server"));
  if ((result.success || hasOutput) && hasOutput) {
    const label = result.success ? "Execution complete" : "Execution recovered";
    reporter.log(`
[${project.name}] ${label}.
`);
    reporter.log(`  Agent Team (${nonSharedTracks.length} teammates):`);
    for (const t of nonSharedTracks) {
      reporter.log(`    \u2022 ${(t.id.replace("track-", "") + "-engineer").padEnd(28)} ${t.discipline}`);
    }
    reporter.log(`
  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);
    const scaffoldResult = await scaffoldClaudeCommands(targetPath);
    if (scaffoldResult.files.length > 0) {
      reporter.log(`  Scaffolded ${scaffoldResult.files.length} repair commands (.claude/commands/)`);
    }
    try {
      const msg = result.success ? "proteus-forge: execute complete" : "proteus-forge: execute complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch {
    }
    let verifySummary;
    if (!options.skipVerify && existsSync16(join17(targetPath, "package.json"))) {
      reporter.log("\n  Running post-execute verification...");
      const verifyResult = await runVerification(targetPath);
      printVerifyResult(verifyResult);
      verifySummary = verifyResult.steps.map((s) => `${s.name}:${s.skipped ? "skipped" : s.passed ? "passed" : "failed"}`).join(", ");
      if (!verifyResult.allPassed) {
        reporter.log("  Run `proteus-forge verify --verbose` to see full failure output.\n");
      }
    }
    await appendCostEntry(targetPath, "execute", { ...result.cost, teammates: nonSharedTracks.length });
    await appendLogEntry(targetPath, {
      action: "execute",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
      teammates: nonSharedTracks.length,
      details: verifySummary
    });
    reporter.log(`
  Output: ${join17(executeDir, "execute.md")}`);
    reporter.log(`          ${join17(executeDir, "session.json")}`);
    reporter.log(`          ${targetPath}/`);
    reporter.log(`  Review: proteus-forge review execute`);
    reporter.log(`  Compare: proteus-forge compare
`);
    return true;
  }
  reporter.error(`
[${project.name}] Execution failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }
  try {
    await gitStageAndCommit(targetPath, "proteus-forge: execute partial (failed)");
  } catch {
  }
  await appendLogEntry(targetPath, {
    action: "execute",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; ")
  });
  return false;
}
var executeCommand = new Command6("execute").description("Build production code using coordinated agent teams").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").option("--skip-verify", "Skip post-execute verification (install/build/test/lint)").action(async (name, options) => {
  const success = await runExecute(name, options);
  if (!success) process.exit(1);
});

export {
  getForgeDir,
  getGlobalConfigPath,
  ensureForgeDir,
  getDefaultGlobalConfig,
  readGlobalConfig,
  writeGlobalConfig,
  globalConfigExists,
  resolveApiKey,
  launchSession,
  readRegistry,
  writeRegistry,
  registerProject,
  unregisterProject,
  setActiveProject,
  getActiveProject,
  getProject,
  updateProject,
  getProjectForgeDir,
  ensureProjectDir,
  readProjectConfig,
  writeProjectConfig,
  createProjectConfig,
  getStageStatuses,
  getCurrentStage,
  checkStaleness,
  getStageDir,
  getStagesAfter,
  isValidStage,
  getStageOrder,
  readCosts,
  appendCostEntry,
  removeCostEntries,
  resolveProject,
  generateInspectLeadPrompt,
  resolveModel,
  gitInit,
  gitStageAndCommit,
  getLastWaveCheckpoint,
  appendLogEntry,
  RESET,
  BOLD,
  DIM,
  AgentDashboard,
  createDashboard,
  terminalReporter,
  generateStyleLeadPrompt,
  runStyle,
  styleCommand,
  runInspect,
  inspectCommand,
  hasStyleGuide,
  generateDesignLeadPrompt,
  runDesign,
  designCommand,
  generatePlanLeadPrompt,
  runPlan,
  planCommand,
  generateSplitLeadPrompt,
  runSplit,
  splitCommand,
  loadExecuteContext,
  generateExecuteLeadPrompt,
  runVerification,
  printVerifyResult,
  runExecute,
  executeCommand
};
