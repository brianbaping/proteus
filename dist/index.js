#!/usr/bin/env node
import {
  consumeInboxMessages,
  getInboxDir,
  isInboxActive,
  writeInboxMessage
} from "./chunk-OXAFMJZU.js";

// src/index.ts
import { Command as Command25 } from "commander";

// src/commands/setup.ts
import { Command } from "commander";
import { createInterface } from "readline/promises";

// src/utils/claude-settings.ts
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
var CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
async function readClaudeSettings() {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return {};
  }
  const content = await readFile(CLAUDE_SETTINGS_PATH, "utf-8");
  return JSON.parse(content);
}
async function writeClaudeSettings(settings) {
  await writeFile(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2) + "\n"
  );
}
function isAgentTeamsEnabled(settings) {
  return settings.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === "1";
}
async function enableAgentTeams() {
  const settings = await readClaudeSettings();
  if (!settings.env) {
    settings.env = {};
  }
  settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";
  await writeClaudeSettings(settings);
}

// src/config/global.ts
import { readFile as readFile2, writeFile as writeFile2, mkdir } from "fs/promises";
import { existsSync as existsSync2 } from "fs";
import { homedir as homedir2 } from "os";
import { join as join2 } from "path";
var FORGE_DIR = join2(homedir2(), ".proteus-forge");
var CONFIG_PATH = join2(FORGE_DIR, "config.json");
function getForgeDir() {
  return FORGE_DIR;
}
async function ensureForgeDir() {
  if (!existsSync2(FORGE_DIR)) {
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
      "design-specialist": "advanced",
      "plan-generator": "standard",
      "execute-agent": "advanced",
      "qa-agent": "standard"
    }
  };
}
async function readGlobalConfig() {
  if (!existsSync2(CONFIG_PATH)) {
    return null;
  }
  const content = await readFile2(CONFIG_PATH, "utf-8");
  return JSON.parse(content);
}
async function writeGlobalConfig(config) {
  await ensureForgeDir();
  await writeFile2(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}
function globalConfigExists() {
  return existsSync2(CONFIG_PATH);
}

// src/config/registry.ts
import { readFile as readFile3, writeFile as writeFile3 } from "fs/promises";
import { existsSync as existsSync3 } from "fs";
import { join as join3 } from "path";
var REGISTRY_PATH = join3(getForgeDir(), "projects.json");
function getDefaultRegistry() {
  return {
    activeProject: null,
    projects: {}
  };
}
async function readRegistry() {
  if (!existsSync3(REGISTRY_PATH)) {
    return getDefaultRegistry();
  }
  const content = await readFile3(REGISTRY_PATH, "utf-8");
  return JSON.parse(content);
}
async function writeRegistry(registry) {
  await ensureForgeDir();
  await writeFile3(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
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

// src/commands/setup.ts
async function promptForApiKey() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("");
    console.log("      Proteus Forge needs an Anthropic API key to launch agent sessions.");
    console.log("      This is separate from Claude Code's internal auth.");
    console.log("      Get your key at: https://console.anthropic.com/settings/keys");
    console.log("");
    const key = await rl.question("      Enter your Anthropic API key (or press Enter to skip): ");
    return key.trim() || null;
  } finally {
    rl.close();
  }
}
var setupCommand = new Command("setup").description("One-time configuration: enable Agent Teams, configure providers, set tier defaults").action(async () => {
  console.log("Setting up Proteus Forge...\n");
  console.log("  Checking prerequisites...");
  try {
    const settings = await readClaudeSettings();
    console.log("    \u2713 Claude Code detected");
    if (isAgentTeamsEnabled(settings)) {
      console.log("    \u2713 Agent Teams already enabled");
    } else {
      await enableAgentTeams();
      console.log("    \u2713 Agent Teams enabled (updated ~/.claude/settings.json)");
    }
  } catch {
    console.error("    \u2717 Could not read Claude Code settings.");
    console.error("      Ensure Claude Code is installed and ~/.claude/settings.json exists.");
    process.exit(1);
  }
  await ensureForgeDir();
  if (globalConfigExists()) {
    console.log("\n  \u2713 Global config already exists (~/.proteus-forge/config.json)");
  } else {
    await writeGlobalConfig(getDefaultGlobalConfig());
    console.log("\n  \u2713 Created ~/.proteus-forge/config.json with default tiers:");
    console.log("      fast     \u2192 claude-haiku-4-5");
    console.log("      standard \u2192 claude-sonnet-4-6");
    console.log("      advanced \u2192 claude-opus-4-6");
  }
  const config = await readGlobalConfig();
  const storedKey = config.providers?.anthropic?.apiKey;
  const hasStoredKey = storedKey && !storedKey.startsWith("$");
  const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;
  if (hasStoredKey) {
    console.log("  \u2713 API key configured in ~/.proteus-forge/config.json");
  } else if (hasEnvKey) {
    console.log("  \u2713 Found ANTHROPIC_API_KEY in environment");
  } else {
    console.log("  \u26A0 No API key found.");
    const key = await promptForApiKey();
    if (key) {
      config.providers.anthropic.apiKey = key;
      await writeGlobalConfig(config);
      console.log("    \u2713 API key saved to ~/.proteus-forge/config.json");
    } else {
      console.log("    Skipped. You can add it later:");
      console.log('    proteus-forge config set providers.anthropic.apiKey "sk-ant-..."');
    }
  }
  const registry = await readRegistry();
  if (Object.keys(registry.projects).length === 0) {
    await writeRegistry(registry);
  }
  console.log("\nSetup complete. Run `proteus-forge new <name> --source <path>` to create a project.");
});

// src/commands/new.ts
import { Command as Command2 } from "commander";
import { existsSync as existsSync5 } from "fs";
import { mkdir as mkdir3, writeFile as writeFile5 } from "fs/promises";
import { resolve, dirname, basename } from "path";

// src/config/project.ts
import { readFile as readFile4, writeFile as writeFile4, mkdir as mkdir2 } from "fs/promises";
import { existsSync as existsSync4 } from "fs";
import { join as join4 } from "path";
function getProjectForgeDir(targetPath) {
  return join4(targetPath, ".proteus-forge");
}
function getProjectConfigPath(targetPath) {
  return join4(targetPath, ".proteus-forge", "config.json");
}
async function ensureProjectDir(targetPath) {
  const forgeDir = getProjectForgeDir(targetPath);
  if (!existsSync4(forgeDir)) {
    await mkdir2(forgeDir, { recursive: true });
  }
}
async function readProjectConfig(targetPath) {
  const configPath = getProjectConfigPath(targetPath);
  if (!existsSync4(configPath)) {
    return null;
  }
  const content = await readFile4(configPath, "utf-8");
  return JSON.parse(content);
}
async function writeProjectConfig(targetPath, config) {
  await ensureProjectDir(targetPath);
  const configPath = getProjectConfigPath(targetPath);
  await writeFile4(configPath, JSON.stringify(config, null, 2) + "\n");
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

// src/commands/new.ts
var CLAUDE_MD_CONTENT = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a Proteus Forge-managed production repository. The source POC is read-only reference material.
All production code is built here by coordinated AI agent teams.

## Proteus Forge Context

- This repo was created by \`proteus-forge new\`
- Pipeline artifacts are in \`.proteus-forge/\`
- Do not manually edit files in \`.proteus-forge/\` unless you know what you're doing
- Human-editable artifacts: \`.proteus-forge/02-design/design.md\`, \`.proteus-forge/03-plan/plan.md\`
`;
var newCommand = new Command2("new").description("Create a new Proteus Forge project").argument("<name>", "Project name").requiredOption("--source <path>", "Path to the source POC repository").option("--target <path>", "Path for the production target repository").option("--template <name>", "Template to use for specialist hints").action(async (name, options) => {
  if (!globalConfigExists()) {
    console.error("Proteus Forge is not configured. Run `proteus-forge setup` first.");
    process.exit(1);
  }
  const sourcePath = resolve(options.source);
  if (!existsSync5(sourcePath)) {
    console.error(`Source path not found: ${sourcePath}`);
    process.exit(1);
  }
  const targetPath = options.target ? resolve(options.target) : resolve(dirname(sourcePath), `${basename(sourcePath)}-prod`);
  if (existsSync5(targetPath)) {
    console.error(`Target path already exists: ${targetPath}`);
    console.error("Choose a different target or remove the existing directory.");
    process.exit(1);
  }
  console.log(`Creating project "${name}"...
`);
  console.log(`  Source (read-only): ${sourcePath}`);
  console.log(`  Target: ${targetPath}
`);
  await mkdir3(targetPath, { recursive: true });
  console.log("  \u2713 Created target directory");
  await gitInit(targetPath);
  console.log("  \u2713 Initialized git repo");
  await writeProjectConfig(targetPath, createProjectConfig(name, sourcePath));
  console.log("  \u2713 Created .proteus-forge/config.json");
  await writeFile5(resolve(targetPath, "CLAUDE.md"), CLAUDE_MD_CONTENT);
  console.log("  \u2713 Created CLAUDE.md");
  await registerProject(name, {
    source: sourcePath,
    target: targetPath,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    currentStage: "new"
  });
  console.log("  \u2713 Registered project (set as active)");
  console.log(`
Project ready. Run \`proteus-forge inspect\` to begin.`);
});

// src/commands/list.ts
import { Command as Command3 } from "commander";

// src/utils/stages.ts
import { existsSync as existsSync6, statSync } from "fs";
import { join as join5 } from "path";
var STAGE_ARTIFACTS = {
  inspect: "01-inspect/features.json",
  design: "02-design/design.md",
  plan: "03-plan/plan.json",
  split: "04-tracks/manifest.json",
  execute: "05-execute/session.json"
};
var STAGE_ORDER = [
  "inspect",
  "design",
  "plan",
  "split",
  "execute"
];
function getStageOrder() {
  return STAGE_ORDER;
}
function getStageStatuses(targetPath) {
  const forgeDir = join5(targetPath, ".proteus-forge");
  return STAGE_ORDER.map((stage) => {
    const artifactPath = join5(forgeDir, STAGE_ARTIFACTS[stage]);
    const complete = existsSync6(artifactPath);
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

// src/commands/list.ts
var listCommand = new Command3("list").description("Show all Proteus Forge projects").action(async () => {
  const registry = await readRegistry();
  const names = Object.keys(registry.projects);
  if (names.length === 0) {
    console.log("No projects. Run `proteus-forge new <name> --source <path>` to create one.");
    return;
  }
  console.log("");
  for (const name of names) {
    const entry = registry.projects[name];
    const isActive = registry.activeProject === name;
    const marker = isActive ? "\u25CF" : " ";
    let stage;
    try {
      stage = getCurrentStage(entry.target);
    } catch {
      stage = "unknown";
    }
    console.log(
      `  ${marker} ${name.padEnd(24)} ${entry.target.padEnd(48)} (${stage})`
    );
  }
  console.log("");
});

// src/commands/use.ts
import { Command as Command4 } from "commander";
var useCommand = new Command4("use").description("Set the active project").argument("<name>", "Project name").action(async (name) => {
  try {
    await setActiveProject(name);
    console.log(`Active project set to "${name}".`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
});

// src/commands/destroy.ts
import { Command as Command5 } from "commander";
import { rm } from "fs/promises";
import { createInterface as createInterface2 } from "readline";
async function confirm(message) {
  const rl = createInterface2({ input: process.stdin, output: process.stdout });
  return new Promise((resolve3) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve3(answer.toLowerCase() === "y");
    });
  });
}
var destroyCommand = new Command5("destroy").description("Remove a Proteus Forge project").argument("<name>", "Project name").action(async (name) => {
  const entry = await getProject(name);
  if (!entry) {
    console.error(`Project "${name}" not found.`);
    process.exit(1);
  }
  console.log(`
Project: ${name}`);
  console.log(`  Target: ${entry.target}`);
  console.log(`  Source: ${entry.source} (will NOT be deleted)
`);
  const confirmed = await confirm(
    `Delete target directory and remove project "${name}"?`
  );
  if (!confirmed) {
    console.log("Cancelled.");
    return;
  }
  try {
    await rm(entry.target, { recursive: true, force: true });
    console.log(`  \u2713 Deleted ${entry.target}`);
  } catch {
    console.log(`  \u26A0 Could not delete ${entry.target} (may not exist)`);
  }
  await unregisterProject(name);
  console.log(`  \u2713 Removed "${name}" from project registry`);
});

// src/commands/status.ts
import { Command as Command6 } from "commander";

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

// src/commands/status.ts
var statusCommand = new Command6("status").description("Show pipeline status for a project").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const statuses = getStageStatuses(project.entry.target);
  const warnings = checkStaleness(project.entry.target);
  console.log(`
[${project.name}] Pipeline Status
`);
  console.log(`  Source: ${project.entry.source}`);
  console.log(`  Target: ${project.entry.target}
`);
  for (const status of statuses) {
    const icon = status.complete ? "\u2713" : "\u25CB";
    const time = status.modifiedAt ? `  (${status.modifiedAt.toLocaleString()})` : "";
    console.log(`  ${icon} ${status.stage.padEnd(12)}${time}`);
  }
  if (warnings.length > 0) {
    console.log("");
    for (const warning of warnings) {
      console.log(`  \u26A0 ${warning.staleReason}. Re-run \`proteus-forge ${warning.stage}\`.`);
    }
  }
  console.log("");
});

// src/commands/config.ts
import { Command as Command7 } from "commander";
function getNestedValue(obj, path) {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current === null || current === void 0 || typeof current !== "object") {
      return void 0;
    }
    current = current[key];
  }
  return current;
}
function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}
var getSubcommand = new Command7("get").description("Get a config value").argument("<key>", "Dot-notation config key (e.g., tiers.fast.model)").action(async (key) => {
  const config = await readGlobalConfig() ?? getDefaultGlobalConfig();
  const value = getNestedValue(config, key);
  if (value === void 0) {
    console.error(`Key "${key}" not found.`);
    process.exit(1);
  }
  if (typeof value === "object") {
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(String(value));
  }
});
var setSubcommand = new Command7("set").description("Set a config value").argument("<key>", "Dot-notation config key").argument("<value>", "Value to set").action(async (key, value) => {
  const config = await readGlobalConfig() ?? getDefaultGlobalConfig();
  const configObj = config;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value;
  }
  setNestedValue(configObj, key, parsed);
  await writeGlobalConfig(config);
  console.log(`Set ${key} = ${typeof parsed === "object" ? JSON.stringify(parsed) : parsed}`);
});
var configCommand = new Command7("config").description("Get or set Proteus Forge configuration values").addCommand(getSubcommand).addCommand(setSubcommand);

// src/commands/inspect.ts
import { Command as Command8 } from "commander";
import { existsSync as existsSync9 } from "fs";
import { mkdir as mkdir4 } from "fs/promises";
import { join as join9 } from "path";

// src/prompts/inspect.ts
function generateInspectLeadPrompt(sourcePath, targetPath) {
  return `You are the Scout for a Proteus Forge inspection. Your job is to analyze a source codebase and coordinate a team of domain specialists to produce a comprehensive feature inventory.

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

### Step 2: Create Agent Team

Create an agent team to inspect this codebase. For each domain you discovered, spawn a teammate as a specialist inspector.

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

Write the final output to: ${targetPath}/.proteus-forge/01-inspect/features.json

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

## Important

- The source repo at ${sourcePath} is READ-ONLY. Never modify it.
- Create the directories ${targetPath}/.proteus-forge/01-inspect/partials/ before specialists start writing.
- Ensure all feature IDs are unique across the entire features.json.
- Feature dependencies must reference valid feature IDs (no dangling refs).
- No circular dependencies in the feature graph.
`;
}

// src/session/launcher.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
async function resolveApiKey() {
  const config = await readGlobalConfig();
  const apiKey = config?.providers?.anthropic?.apiKey;
  if (!apiKey) return process.env.ANTHROPIC_API_KEY;
  if (apiKey.startsWith("$")) return process.env[apiKey.slice(1)];
  return apiKey;
}
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
    await new Promise((resolve3) => {
      const timer = setTimeout(resolve3, pollIntervalMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve3();
      }, { once: true });
    });
  }
}

// src/utils/costs.ts
import { readFile as readFile5, writeFile as writeFile6 } from "fs/promises";
import { existsSync as existsSync7 } from "fs";
import { join as join6 } from "path";
function getCostsPath(targetPath) {
  return join6(targetPath, ".proteus-forge", "costs.json");
}
async function readCosts(targetPath) {
  const costsPath = getCostsPath(targetPath);
  if (!existsSync7(costsPath)) {
    return { stages: {}, totalCost: 0 };
  }
  const content = await readFile5(costsPath, "utf-8");
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
  await writeFile6(getCostsPath(targetPath), JSON.stringify(costs, null, 2) + "\n");
}

// src/utils/log.ts
import { appendFile } from "fs/promises";
import { join as join7 } from "path";
function getLogPath(targetPath) {
  return join7(targetPath, ".proteus-forge", "log.jsonl");
}
async function appendLogEntry(targetPath, entry) {
  await ensureProjectDir(targetPath);
  const logLine = JSON.stringify({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...entry
  });
  await appendFile(getLogPath(targetPath), logLine + "\n");
}

// src/utils/team-summary.ts
import { readFile as readFile6 } from "fs/promises";
import { existsSync as existsSync8 } from "fs";
import { join as join8 } from "path";
async function printInspectTeamSummary(targetPath) {
  const scoutPath = join8(
    targetPath,
    ".proteus-forge",
    "01-inspect",
    "scout.json"
  );
  if (!existsSync8(scoutPath)) return;
  try {
    const content = await readFile6(scoutPath, "utf-8");
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
  if (!existsSync8(scopePath)) return;
  try {
    const content = await readFile6(scopePath, "utf-8");
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
          agent.currentTool = String(block.name);
          agent.status = "working";
          continue;
        }
        if (block.type === "text" && "text" in block && typeof block.text === "string") {
          const text = block.text.trim();
          if (text.length > 0 && text.length < 200) {
            this.printLine(agent, text);
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

// src/commands/inspect.ts
async function runInspect(name, options) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  if (!existsSync9(sourcePath)) {
    console.error(`Source path not found: ${sourcePath}`);
    return false;
  }
  const globalConfig = await readGlobalConfig();
  const _projectConfig = await readProjectConfig(targetPath);
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const scoutRole = globalConfig.roles.scout;
  const scoutTier = typeof scoutRole === "string" ? scoutRole : void 0;
  const tierConfig = scoutTier ? globalConfig.tiers[scoutTier] : void 0;
  const model = tierConfig?.model;
  console.log(`
[${project.name}] Inspecting source...
`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${scoutTier} tier)`);
  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch Agent Team:");
    console.log("    Lead: scout (analyzes source, identifies domains)");
    console.log("    Teammates: one per discovered domain (spawned dynamically)");
    console.log("    Tasks: one per domain + synthesis");
    console.log(`
  Estimated cost: depends on source repo size`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const inspectDir = join9(targetPath, ".proteus-forge", "01-inspect");
  const partialsDir = join9(inspectDir, "partials");
  await mkdir4(partialsDir, { recursive: true });
  const leadPrompt = generateInspectLeadPrompt(sourcePath, targetPath);
  console.log("\n  Launching Agent Team...\n");
  const dashboard = createDashboard("inspect");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: (msg) => dashboard.onMessage(msg)
  });
  dashboard.cleanup();
  const featuresPath = join9(inspectDir, "features.json");
  const featuresExist = existsSync9(featuresPath);
  if ((result.success || featuresExist) && featuresExist) {
    const label = result.success ? "Inspection complete" : "Inspection recovered";
    console.log(`
[${project.name}] ${label}.
`);
    await printInspectTeamSummary(targetPath);
    console.log(`
  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: inspect complete" : "proteus-forge: inspect complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "inspect", result.cost);
    await appendLogEntry(targetPath, {
      action: "inspect",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    console.log(`
  Output: ${featuresPath}
`);
    return true;
  }
  console.error(`
[${project.name}] Inspection failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
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
var inspectCommand = new Command8("inspect").description("Analyze the source POC and produce a feature inventory").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).action(async (name, options) => {
  const success = await runInspect(name, options);
  if (!success) process.exit(1);
});

// src/commands/design.ts
import { Command as Command9 } from "commander";
import { existsSync as existsSync10 } from "fs";
import { mkdir as mkdir5, readFile as readFile7 } from "fs/promises";
import { join as join10, resolve as resolve2 } from "path";

// src/prompts/design.ts
function generateDesignLeadPrompt(sourcePath, targetPath, brief) {
  const briefSection = brief ? `
## User Architectural Requirements

The user has specified the following requirements for the production architecture. These take HIGHEST PRIORITY and must be followed by you and all specialists:

${brief}

Design the architecture to satisfy these requirements. If a requirement conflicts with what the POC currently uses, the user's requirement wins \u2014 the goal is to build the production system they want, not to replicate the POC's technology choices.

---

` : "";
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

### Step 1: Read Inspection Findings

Read ${targetPath}/.proteus-forge/01-inspect/features.json thoroughly. Understand:
- What features the POC implements
- What technologies it uses
- What integrations exist
- What known issues were identified
- The data model

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
[component structure, state management, API client, routing]

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
async function runDesign(name, options) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  const featuresPath = join10(targetPath, ".proteus-forge", "01-inspect", "features.json");
  if (!existsSync10(featuresPath)) {
    console.error("Inspect stage not complete. Run `proteus-forge inspect` first.");
    return false;
  }
  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "design") {
      console.log(`  \u26A0 ${w.staleReason}. Consider re-running upstream stages first.
`);
    }
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const designRole = globalConfig.roles["design-specialist"];
  const designTier = typeof designRole === "string" ? designRole : void 0;
  const tierConfig = designTier ? globalConfig.tiers[designTier] : void 0;
  const model = tierConfig?.model;
  console.log(`
[${project.name}] Designing production architecture...
`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${designTier} tier)`);
  let brief;
  if (options.briefFile) {
    const briefPath = resolve2(options.briefFile);
    if (!existsSync10(briefPath)) {
      console.error(`Brief file not found: ${briefPath}`);
      return false;
    }
    brief = await readFile7(briefPath, "utf-8");
  } else if (options.brief) {
    brief = options.brief;
  }
  if (brief) {
    console.log(`  Brief: ${brief.length > 100 ? brief.slice(0, 100) + "..." : brief}`);
  }
  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch Agent Team:");
    console.log("    Lead: architect (reads features.json, scopes design domains)");
    console.log("    Teammates: one per design domain (spawned dynamically)");
    console.log("    Tasks: one per domain + synthesis");
    if (brief) console.log(`    Brief: user architectural requirements provided`);
    console.log(`
  Estimated cost: depends on feature count and complexity`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const designDir = join10(targetPath, ".proteus-forge", "02-design");
  await mkdir5(join10(designDir, "partials"), { recursive: true });
  const leadPrompt = generateDesignLeadPrompt(sourcePath, targetPath, brief);
  console.log("\n  Launching Agent Team...\n");
  const dashboard = createDashboard("design");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: (msg) => dashboard.onMessage(msg)
  });
  dashboard.cleanup();
  const hasOutput = existsSync10(join10(designDir, "design.md")) || existsSync10(join10(designDir, "design-meta.json"));
  if ((result.success || hasOutput) && hasOutput) {
    const label = result.success ? "Design complete" : "Design recovered";
    console.log(`
[${project.name}] ${label}.
`);
    await printDesignTeamSummary(targetPath);
    console.log(`
  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: design complete" : "proteus-forge: design complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "design", result.cost);
    await appendLogEntry(targetPath, {
      action: "design",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    console.log(`
  Review: proteus-forge review design
`);
    return true;
  }
  console.error(`
[${project.name}] Design failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
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
var designCommand = new Command9("design").description("Design the production architecture based on inspection findings").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).option("--brief <text>", "Architectural requirements (e.g., 'Use microservices with Go and gRPC')").option("--brief-file <path>", "Path to a file containing architectural requirements").action(async (name, options) => {
  const success = await runDesign(name, options);
  if (!success) process.exit(1);
});

// src/commands/plan.ts
import { Command as Command10 } from "commander";
import { existsSync as existsSync11 } from "fs";
import { mkdir as mkdir6, readFile as readFile8 } from "fs/promises";
import { join as join11 } from "path";

// src/prompts/plan.ts
function generatePlanLeadPrompt(sourcePath, targetPath) {
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
3. ${targetPath}/.proteus-forge/01-inspect/features.json \u2014 features, known issues, data model

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
- Shared types and interfaces
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
async function runPlan(name, options) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  const designMdPath = join11(targetPath, ".proteus-forge", "02-design", "design.md");
  const designMetaPath = join11(targetPath, ".proteus-forge", "02-design", "design-meta.json");
  if (!existsSync11(designMdPath) && !existsSync11(designMetaPath)) {
    console.error("Design stage not complete. Run `proteus-forge design` first.");
    return false;
  }
  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "plan") {
      console.log(`  \u26A0 ${w.staleReason}. Consider re-running upstream stages first.
`);
    }
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const planRole = globalConfig.roles["plan-generator"];
  const planTier = typeof planRole === "string" ? planRole : void 0;
  const tierConfig = planTier ? globalConfig.tiers[planTier] : void 0;
  const model = tierConfig?.model;
  console.log(`
[${project.name}] Generating plan...
`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${planTier} tier)`);
  console.log(`  Mode: single Lead session (no teammates)`);
  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch single Lead session:");
    console.log("    Reads: design.md, design-meta.json, features.json");
    console.log("    Produces: plan.json (task DAG) + plan.md (narrative)");
    console.log(`
  Estimated cost: ~$0.10-0.30`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const planDir = join11(targetPath, ".proteus-forge", "03-plan");
  await mkdir6(planDir, { recursive: true });
  const leadPrompt = generatePlanLeadPrompt(sourcePath, targetPath);
  console.log("\n  Launching session...\n");
  const dashboard = createDashboard("plan");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: (msg) => dashboard.onMessage(msg)
  });
  dashboard.cleanup();
  const planJsonPath = join11(planDir, "plan.json");
  const planJsonExists = existsSync11(planJsonPath);
  let taskCount = 0;
  let waveCount = 0;
  if (planJsonExists) {
    try {
      const planData = JSON.parse(await readFile8(planJsonPath, "utf-8"));
      taskCount = planData.tasks?.length ?? 0;
      waveCount = planData.executionWaves?.length ?? 0;
    } catch {
    }
  }
  if ((result.success || planJsonExists) && planJsonExists) {
    const label = result.success ? "Plan complete" : "Plan recovered";
    console.log(`
[${project.name}] ${label}.
`);
    if (taskCount > 0) console.log(`  ${taskCount} tasks across ${waveCount} waves`);
    console.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: plan complete" : "proteus-forge: plan complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "plan", result.cost);
    await appendLogEntry(targetPath, {
      action: "plan",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    console.log(`
  Review: proteus-forge review plan
`);
    return true;
  }
  console.error(`
[${project.name}] Plan failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
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
var planCommand = new Command10("plan").description("Generate a task DAG with execution waves from the design").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).action(async (name, options) => {
  const success = await runPlan(name, options);
  if (!success) process.exit(1);
});

// src/commands/split.ts
import { Command as Command11 } from "commander";
import { existsSync as existsSync12 } from "fs";
import { mkdir as mkdir7, readFile as readFile9 } from "fs/promises";
import { join as join12 } from "path";

// src/prompts/split.ts
function generateSplitLeadPrompt(targetPath) {
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

Also read ${targetPath}/.proteus-forge/02-design/design-meta.json for the service definitions.

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

## Important

- Every task from plan.json must appear in exactly one track.
- No file ownership overlap between tracks (except track-shared which is exclusive).
- Track dependency graph must be a DAG (no circular dependencies between tracks).
- Create the directory ${targetPath}/.proteus-forge/04-tracks/ before writing.
`;
}

// src/commands/split.ts
async function runSplit(name, options) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    return false;
  }
  const targetPath = project.entry.target;
  const planJsonPath = join12(targetPath, ".proteus-forge", "03-plan", "plan.json");
  if (!existsSync12(planJsonPath)) {
    console.error("Plan stage not complete. Run `proteus-forge plan` first.");
    return false;
  }
  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "split") {
      console.log(`  \u26A0 ${w.staleReason}. Consider re-running upstream stages first.
`);
    }
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const planRole = globalConfig.roles["plan-generator"];
  const planTier = typeof planRole === "string" ? planRole : void 0;
  const tierConfig = planTier ? globalConfig.tiers[planTier] : void 0;
  const model = tierConfig?.model;
  console.log(`
[${project.name}] Splitting into tracks...
`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${planTier} tier)`);
  console.log(`  Mode: single Lead session (no teammates)`);
  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch single Lead session:");
    console.log("    Reads: plan.json, design-meta.json");
    console.log("    Produces: manifest.json + per-discipline track files");
    console.log(`
  Estimated cost: ~$0.05-0.15`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const tracksDir = join12(targetPath, ".proteus-forge", "04-tracks");
  await mkdir7(tracksDir, { recursive: true });
  const leadPrompt = generateSplitLeadPrompt(targetPath);
  console.log("\n  Launching session...\n");
  const dashboard = createDashboard("split");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: (msg) => dashboard.onMessage(msg)
  });
  dashboard.cleanup();
  const manifestPath = join12(tracksDir, "manifest.json");
  const manifestExists = existsSync12(manifestPath);
  let tracks = [];
  if (manifestExists) {
    try {
      const data = JSON.parse(await readFile9(manifestPath, "utf-8"));
      tracks = data.tracks ?? [];
    } catch {
    }
  }
  if ((result.success || manifestExists) && manifestExists) {
    const label = result.success ? "Split complete" : "Split recovered";
    console.log(`
[${project.name}] ${label}.
`);
    for (const t of tracks) {
      console.log(`  ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   (${t.discipline})`);
    }
    console.log(`
  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: split complete" : "proteus-forge: split complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "split", result.cost);
    await appendLogEntry(targetPath, {
      action: "split",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost
    });
    console.log(`
  Next: proteus-forge execute
`);
    return true;
  }
  console.error(`
[${project.name}] Split failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
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
var splitCommand = new Command11("split").description("Partition the plan into discipline-specific tracks").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).action(async (name, options) => {
  const success = await runSplit(name, options);
  if (!success) process.exit(1);
});

// src/commands/execute.ts
import { Command as Command12 } from "commander";
import { existsSync as existsSync14 } from "fs";
import { mkdir as mkdir8 } from "fs/promises";
import { join as join14 } from "path";

// src/prompts/execute.ts
import { readFile as readFile10 } from "fs/promises";
import { existsSync as existsSync13 } from "fs";
import { join as join13 } from "path";
async function loadExecuteContext(targetPath) {
  const tracksDir = join13(targetPath, ".proteus-forge", "04-tracks");
  const planPath = join13(targetPath, ".proteus-forge", "03-plan", "plan.json");
  const manifest = JSON.parse(
    await readFile10(join13(tracksDir, "manifest.json"), "utf-8")
  );
  const tracks = manifest.tracks ?? [];
  const trackDetails = /* @__PURE__ */ new Map();
  for (const track of tracks) {
    const trackPath = join13(targetPath, ".proteus-forge", track.file);
    if (existsSync13(trackPath)) {
      const detail = JSON.parse(
        await readFile10(trackPath, "utf-8")
      );
      trackDetails.set(track.id, detail);
    }
  }
  const plan = JSON.parse(await readFile10(planPath, "utf-8"));
  const tasks = plan.tasks ?? [];
  const waveCount = plan.executionWaves?.length ?? 0;
  return { tracks, trackDetails, tasks, waveCount };
}
function generateExecuteLeadPrompt(sourcePath, targetPath, ctx) {
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
3. Each track file in ${targetPath}/.proteus-forge/04-tracks/ \u2014 per-discipline context

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
2. Write a brief session summary to ${targetPath}/.proteus-forge/05-execute/session.json

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
  }
}
\`\`\`

## Important

- The source at ${sourcePath} is READ-ONLY. Never modify it. Reimplement, don't copy.
- Each teammate owns specific files \u2014 enforce ownership boundaries.
- Teammates should write unit tests for tasks with testingExpectation "unit".
- Create ${targetPath}/.proteus-forge/05-execute/ directory before writing session.json.
- If you complete shared tasks first, ensure the scaffolding is committed/written before spawning teammates so they can build on it.
`;
}

// src/commands/execute.ts
async function runExecute(name, options) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    return false;
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  const manifestPath = join14(targetPath, ".proteus-forge", "04-tracks", "manifest.json");
  if (!existsSync14(manifestPath)) {
    console.error("Split stage not complete. Run `proteus-forge split` first.");
    return false;
  }
  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "execute") {
      console.log(`  \u26A0 ${w.staleReason}. Consider re-running upstream stages first.
`);
    }
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  let ctx;
  try {
    ctx = await loadExecuteContext(targetPath);
  } catch (err) {
    console.error(`Failed to load execute context: ${err.message}`);
    return false;
  }
  const execRole = globalConfig.roles["execute-agent"];
  const execTier = typeof execRole === "string" ? execRole : void 0;
  const tierConfig = execTier ? globalConfig.tiers[execTier] : void 0;
  const model = tierConfig?.model;
  const nonSharedTracks = ctx.tracks.filter((t) => t.discipline !== "shared");
  console.log(`
[${project.name}] Executing production build...
`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${execTier} tier)`);
  console.log(`  Tasks: ${ctx.tasks.length} across ${ctx.waveCount} waves`);
  console.log(`  Teammates: ${nonSharedTracks.length}
`);
  for (const t of ctx.tracks) {
    const marker = t.discipline === "shared" ? "(Lead)" : "";
    console.log(`    ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   ${marker}`);
  }
  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch Agent Team:");
    console.log("    Lead: orchestrator (handles shared tasks, coordinates)");
    for (const t of nonSharedTracks) {
      console.log(`    Teammate: ${t.id.replace("track-", "")}-engineer (${t.taskCount} tasks)`);
    }
    console.log(`
  Estimated cost: depends on task complexity (typically $5-15)`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }
  const executeDir = join14(targetPath, ".proteus-forge", "05-execute");
  const inboxDir = join14(executeDir, "inbox");
  await mkdir8(inboxDir, { recursive: true });
  console.log(`
  Inbox active \u2014 send messages with: proteus-forge inform <agent> "<message>"
`);
  const leadPrompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
  console.log("  Launching Agent Team...\n");
  const dashboard = createDashboard("execute");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    inboxDir,
    onMessage: (msg) => dashboard.onMessage(msg)
  });
  dashboard.cleanup();
  const hasOutput = existsSync14(join14(targetPath, "src")) || existsSync14(join14(targetPath, "server"));
  if ((result.success || hasOutput) && hasOutput) {
    const label = result.success ? "Execution complete" : "Execution recovered";
    console.log(`
[${project.name}] ${label}.
`);
    console.log(`  Agent Team (${nonSharedTracks.length} teammates):`);
    for (const t of nonSharedTracks) {
      console.log(`    \u2022 ${(t.id.replace("track-", "") + "-engineer").padEnd(28)} ${t.discipline}`);
    }
    console.log(`
  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);
    try {
      const msg = result.success ? "proteus-forge: execute complete" : "proteus-forge: execute complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch {
    }
    await appendCostEntry(targetPath, "execute", { ...result.cost, teammates: nonSharedTracks.length });
    await appendLogEntry(targetPath, {
      action: "execute",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
      teammates: nonSharedTracks.length
    });
    console.log(`
  Production code: ${targetPath}/
`);
    return true;
  }
  console.error(`
[${project.name}] Execution failed.
`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
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
var executeCommand = new Command12("execute").description("Build production code using coordinated agent teams").argument("[name]", "Project name (uses active project if omitted)").option("--dry-run", "Preview what would happen without launching agents").option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat).action(async (name, options) => {
  const success = await runExecute(name, options);
  if (!success) process.exit(1);
});

// src/commands/run.ts
import { Command as Command13 } from "commander";
var STAGE_RUNNERS = {
  inspect: (name, opts) => runInspect(name, { budget: opts.budget }),
  design: (name, opts) => runDesign(name, { budget: opts.budget, brief: opts.brief, briefFile: opts.briefFile }),
  plan: (name, opts) => runPlan(name, { budget: opts.budget }),
  split: (name, opts) => runSplit(name, { budget: opts.budget }),
  execute: (name, opts) => runExecute(name, { budget: opts.budget })
};
var runCommand = new Command13("run").description("Run the full pipeline or a range of stages without stopping").argument("[name]", "Project name (uses active project if omitted)").option("--from <stage>", "Start from this stage (default: next incomplete)").option("--to <stage>", "Stop after this stage (default: execute)").option("--budget <amount>", "Maximum budget per stage in USD", parseFloat).option("--brief <text>", "Architectural requirements for the design stage").option("--brief-file <path>", "Path to architectural requirements file").action(
  async (name, options) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
    const globalConfig = await readGlobalConfig();
    if (!globalConfig) {
      console.error("Global config not found. Run `proteus-forge setup` first.");
      process.exit(1);
    }
    const allStages = getStageOrder();
    let fromStage;
    if (options.from) {
      if (!allStages.includes(options.from)) {
        console.error(`Unknown stage "${options.from}". Valid: ${allStages.join(", ")}`);
        process.exit(1);
      }
      fromStage = options.from;
    } else {
      const current = getCurrentStage(project.entry.target);
      if (current === "done") {
        console.log(`
[${project.name}] All stages already complete. Use --from to re-run.
`);
        return;
      }
      fromStage = current === "new" ? "inspect" : current;
    }
    let toStage;
    if (options.to) {
      if (!allStages.includes(options.to)) {
        console.error(`Unknown stage "${options.to}". Valid: ${allStages.join(", ")}`);
        process.exit(1);
      }
      toStage = options.to;
    } else {
      toStage = "execute";
    }
    const fromIdx = allStages.indexOf(fromStage);
    const toIdx = allStages.indexOf(toStage);
    if (fromIdx > toIdx) {
      console.error(`--from (${fromStage}) must come before --to (${toStage}).`);
      process.exit(1);
    }
    const stagesToRun = allStages.slice(fromIdx, toIdx + 1);
    console.log(`
[${project.name}] Running pipeline: ${stagesToRun.join(" \u2192 ")}
`);
    await appendLogEntry(project.entry.target, {
      action: "run",
      status: "started",
      details: `Stages: ${stagesToRun.join(" \u2192 ")}`
    });
    for (const stage of stagesToRun) {
      console.log(`${"\u2550".repeat(60)}`);
      console.log(`  Stage: ${stage}`);
      console.log(`${"\u2550".repeat(60)}
`);
      const runner = STAGE_RUNNERS[stage];
      const success = await runner(project.name, options);
      if (!success) {
        console.error(`
[${project.name}] Pipeline stopped \u2014 ${stage} failed.
`);
        await appendLogEntry(project.entry.target, {
          action: "run",
          status: "failed",
          details: `Failed at: ${stage}`
        });
        process.exit(1);
      }
    }
    console.log(`
${"\u2550".repeat(60)}`);
    console.log(`[${project.name}] Pipeline complete: ${stagesToRun.join(" \u2192 ")}`);
    console.log(`${"\u2550".repeat(60)}
`);
    await appendLogEntry(project.entry.target, {
      action: "run",
      status: "success",
      details: `Completed: ${stagesToRun.join(" \u2192 ")}`
    });
  }
);

// src/commands/inform.ts
import { Command as Command14 } from "commander";
var informCommand = new Command14("inform").description("Send a message to a running agent during execute").argument("<agent>", "Agent name (e.g., backend-engineer, frontend-engineer)").argument("<message>", "Message to relay to the agent").option("--project <name>", "Project name (uses active project if omitted)").action(
  async (agent, message, options) => {
    let project;
    try {
      project = await resolveProject(options.project);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
    const targetPath = project.entry.target;
    if (!isInboxActive(targetPath)) {
      console.error(
        "No active execute session found. `proteus-forge inform` only works while `proteus-forge execute` is running."
      );
      process.exit(1);
    }
    await writeInboxMessage(targetPath, agent, message);
    console.log(`
[${project.name}] Message queued for "${agent}"
`);
    console.log(`  To: ${agent}`);
    console.log(`  Message: ${message}`);
    console.log(`
  The Lead will relay this to the teammate on its next turn.
`);
  }
);

// src/commands/log.ts
import { Command as Command15 } from "commander";
import { existsSync as existsSync15 } from "fs";
import { readFile as readFile11 } from "fs/promises";
import { join as join15 } from "path";
var logCommand = new Command15("log").description("View the audit trail for a project").argument("[name]", "Project name (uses active project if omitted)").option("-n <count>", "Show last N entries", parseInt).action(async (name, options) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const logPath = join15(project.entry.target, ".proteus-forge", "log.jsonl");
  if (!existsSync15(logPath)) {
    console.log(`
[${project.name}] No log entries yet.
`);
    return;
  }
  const content = await readFile11(logPath, "utf-8");
  let lines = content.trim().split("\n").filter(Boolean);
  if (options.n && options.n > 0) {
    lines = lines.slice(-options.n);
  }
  console.log(`
[${project.name}] Audit Trail
`);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const time = new Date(entry.timestamp).toLocaleString();
      const status = entry.status === "success" ? "\u2713" : entry.status === "recovered" ? "\u26A0" : "\u2717";
      const cost = entry.cost ? `  $${entry.cost.toFixed(2)}` : "";
      const duration = entry.duration ? `  ${entry.duration}` : "";
      const details = entry.details ? `  (${entry.details})` : "";
      const teammates = entry.teammates ? `  ${entry.teammates} teammates` : "";
      console.log(
        `  ${time}  ${status} ${entry.action.padEnd(10)}${duration}${cost}${teammates}${details}`
      );
    } catch {
    }
  }
  console.log("");
});

// src/commands/costs.ts
import { Command as Command16 } from "commander";
var costsCommand = new Command16("costs").description("Show token usage and cost breakdown per stage").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const costs = await readCosts(project.entry.target);
  if (Object.keys(costs.stages).length === 0) {
    console.log(`
[${project.name}] No cost data yet.
`);
    return;
  }
  console.log(`
[${project.name}] Cost Breakdown
`);
  const stageOrder = ["inspect", "design", "plan", "split", "execute"];
  for (const stage of stageOrder) {
    const entry = costs.stages[stage];
    if (!entry) continue;
    const tokens = entry.inputTokens + entry.outputTokens > 0 ? `${(entry.inputTokens / 1e3).toFixed(0)}K in / ${(entry.outputTokens / 1e3).toFixed(0)}K out` : "";
    const teammates = entry.teammates > 0 ? `${entry.teammates} teammates` : "single session";
    console.log(`  ${stage.padEnd(10)} $${entry.estimatedCost.toFixed(2).padStart(6)}   ${entry.duration.padEnd(10)} ${teammates.padEnd(16)} ${tokens}`);
  }
  console.log(`  ${"\u2500".repeat(60)}`);
  console.log(`  ${"Total".padEnd(10)} $${costs.totalCost.toFixed(2).padStart(6)}`);
  console.log("");
});

// src/commands/review.ts
import { Command as Command17 } from "commander";
import { existsSync as existsSync16 } from "fs";
import { join as join16 } from "path";
import { spawn } from "child_process";
var STAGE_REVIEW_FILES = {
  inspect: "01-inspect/features.json",
  design: "02-design/design.md",
  plan: "03-plan/plan.md",
  split: "04-tracks/manifest.json",
  execute: "05-execute/session.json"
};
var reviewCommand = new Command17("review").description("Open a stage artifact in $EDITOR for review").argument("<stage>", "Stage to review (inspect, design, plan, split, execute)").argument("[name]", "Project name (uses active project if omitted)").action(async (stage, name) => {
  if (!STAGE_REVIEW_FILES[stage]) {
    console.error(
      `Unknown stage "${stage}". Valid stages: ${Object.keys(STAGE_REVIEW_FILES).join(", ")}`
    );
    process.exit(1);
  }
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const artifactPath = join16(
    project.entry.target,
    ".proteus-forge",
    STAGE_REVIEW_FILES[stage]
  );
  if (!existsSync16(artifactPath)) {
    console.error(
      `${stage} artifact not found. Run \`proteus-forge ${stage}\` first.`
    );
    process.exit(1);
  }
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const child = spawn(editor, [artifactPath], { stdio: "inherit" });
  await new Promise((resolve3) => {
    child.on("close", () => resolve3());
  });
});

// src/commands/validate.ts
import { Command as Command18 } from "commander";
import { existsSync as existsSync17 } from "fs";
import { readFile as readFile12 } from "fs/promises";
import { join as join17 } from "path";
async function readJson(path) {
  if (!existsSync17(path)) return null;
  try {
    return JSON.parse(await readFile12(path, "utf-8"));
  } catch {
    return null;
  }
}
var validateCommand = new Command18("validate").description("Run cross-stage artifact validation").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const forgeDir = join17(targetPath, ".proteus-forge");
  const results = [];
  console.log(`
[${project.name}] Validating artifacts...
`);
  const statuses = getStageStatuses(targetPath);
  const completedStages = statuses.filter((s) => s.complete).map((s) => s.stage);
  if (completedStages.length === 0) {
    console.log("  No stages completed yet. Nothing to validate.\n");
    return;
  }
  if (completedStages.includes("inspect")) {
    const features = await readJson(join17(forgeDir, "01-inspect", "features.json"));
    if (features) {
      const featureArr = features.features;
      results.push({
        rule: "Features array non-empty",
        passed: Array.isArray(featureArr) && featureArr.length > 0,
        message: featureArr ? `${featureArr.length} features found` : "Missing features array"
      });
      if (Array.isArray(featureArr)) {
        const ids = featureArr.map((f) => f.id);
        const uniqueIds = new Set(ids);
        results.push({
          rule: "Feature IDs unique",
          passed: ids.length === uniqueIds.size,
          message: ids.length === uniqueIds.size ? `${ids.length} unique IDs` : `${ids.length - uniqueIds.size} duplicate(s)`
        });
        let danglingCount = 0;
        for (const f of featureArr) {
          for (const dep of f.dependencies ?? []) {
            if (!uniqueIds.has(dep)) danglingCount++;
          }
        }
        results.push({
          rule: "No dangling feature dependencies",
          passed: danglingCount === 0,
          message: danglingCount === 0 ? "All dependency references valid" : `${danglingCount} dangling reference(s)`
        });
      }
    }
  }
  if (completedStages.includes("design")) {
    const designMeta = await readJson(join17(forgeDir, "02-design", "design-meta.json"));
    if (designMeta) {
      const featureMap = designMeta.featureToServiceMap;
      results.push({
        rule: "Feature-to-service map exists",
        passed: !!featureMap && Object.keys(featureMap).length > 0,
        message: featureMap ? `${Object.keys(featureMap).length} features mapped` : "Missing map"
      });
    }
    const designMd = join17(forgeDir, "02-design", "design.md");
    results.push({
      rule: "design.md exists",
      passed: existsSync17(designMd),
      message: existsSync17(designMd) ? "Present" : "Missing"
    });
  }
  if (completedStages.includes("plan")) {
    const plan = await readJson(join17(forgeDir, "03-plan", "plan.json"));
    if (plan) {
      const tasks = plan.tasks;
      const waves = plan.executionWaves;
      if (Array.isArray(tasks)) {
        const taskIds = new Set(tasks.map((t) => t.id));
        results.push({
          rule: "Task IDs unique",
          passed: tasks.length === taskIds.size,
          message: `${taskIds.size} unique task IDs`
        });
        const noOwnership = tasks.filter((t) => !t.fileOwnership || t.fileOwnership.length === 0);
        results.push({
          rule: "All tasks have file ownership",
          passed: noOwnership.length === 0,
          message: noOwnership.length === 0 ? "All tasks have ownership" : `${noOwnership.length} task(s) missing ownership`
        });
        let invalidDeps = 0;
        for (const t of tasks) {
          for (const dep of t.dependsOn ?? []) {
            if (!taskIds.has(dep)) invalidDeps++;
          }
        }
        results.push({
          rule: "No dangling task dependencies",
          passed: invalidDeps === 0,
          message: invalidDeps === 0 ? "All valid" : `${invalidDeps} invalid reference(s)`
        });
      }
      if (Array.isArray(waves)) {
        results.push({
          rule: "Execution waves defined",
          passed: waves.length > 0,
          message: `${waves.length} waves`
        });
      }
    }
  }
  if (completedStages.includes("split")) {
    const manifest = await readJson(join17(forgeDir, "04-tracks", "manifest.json"));
    if (manifest) {
      const tracks = manifest.tracks;
      results.push({
        rule: "Track manifest has tracks",
        passed: Array.isArray(tracks) && tracks.length > 0,
        message: tracks ? `${tracks.length} tracks` : "No tracks"
      });
    }
  }
  const staleWarnings = checkStaleness(targetPath);
  results.push({
    rule: "No stale artifacts",
    passed: staleWarnings.length === 0,
    message: staleWarnings.length === 0 ? "All artifacts up to date" : staleWarnings.map((w) => w.staleReason).join("; ")
  });
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const icon = r.passed ? "\u2713" : "\u2717";
    console.log(`  ${icon} ${r.rule.padEnd(40)} ${r.message}`);
    if (r.passed) passed++;
    else failed++;
  }
  console.log(`
  ${passed} passed, ${failed} failed
`);
  if (failed > 0) process.exit(1);
});

// src/commands/diff.ts
import { Command as Command19 } from "commander";
import { existsSync as existsSync18 } from "fs";
import { join as join18 } from "path";
import { execFile as execFile2 } from "child_process";
import { promisify as promisify2 } from "util";
var execFileAsync2 = promisify2(execFile2);
var STAGE_ARTIFACTS2 = {
  inspect: ["01-inspect/features.json", "01-inspect/scout.json"],
  design: ["02-design/design.md", "02-design/design-meta.json"],
  plan: ["03-plan/plan.json", "03-plan/plan.md"],
  split: ["04-tracks/manifest.json"],
  execute: ["05-execute/session.json"]
};
var diffCommand = new Command19("diff").description("Show git changes for a stage's artifacts between runs").argument("<stage>", "Stage to diff (inspect, design, plan, split, execute)").argument("[name]", "Project name (uses active project if omitted)").action(async (stage, name) => {
  if (!STAGE_ARTIFACTS2[stage]) {
    console.error(
      `Unknown stage "${stage}". Valid stages: ${Object.keys(STAGE_ARTIFACTS2).join(", ")}`
    );
    process.exit(1);
  }
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const paths = STAGE_ARTIFACTS2[stage].map(
    (p) => join18(".proteus-forge", p)
  );
  const existing = paths.filter((p) => existsSync18(join18(targetPath, p)));
  if (existing.length === 0) {
    console.error(
      `No ${stage} artifacts found. Run \`proteus-forge ${stage}\` first.`
    );
    process.exit(1);
  }
  try {
    const { stdout } = await execFileAsync2(
      "git",
      ["diff", "HEAD~1", "--", ...existing],
      { cwd: targetPath, maxBuffer: 1024 * 1024 }
    );
    if (stdout.trim()) {
      console.log(stdout);
    } else {
      console.log(`
[${project.name}] No changes in ${stage} artifacts since last commit.
`);
    }
  } catch {
    try {
      const { stdout } = await execFileAsync2(
        "git",
        ["diff", "--cached", "--", ...existing],
        { cwd: targetPath, maxBuffer: 1024 * 1024 }
      );
      if (stdout.trim()) {
        console.log(stdout);
      } else {
        console.log(`
[${project.name}] No diff available for ${stage} (may be initial commit).
`);
      }
    } catch {
      console.log(`
[${project.name}] Could not generate diff for ${stage}.
`);
    }
  }
});

// src/commands/compare.ts
import { Command as Command20 } from "commander";
import { existsSync as existsSync19 } from "fs";
import { readdir } from "fs/promises";
import { join as join19 } from "path";
async function countFiles(dir, exclude = []) {
  let files = 0;
  let lines = 0;
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join19(current, entry.name);
      const relative = fullPath.replace(dir + "/", "");
      if (exclude.some((ex) => relative.startsWith(ex) || entry.name === ex)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files++;
        try {
          const { readFile: readFile14 } = await import("fs/promises");
          const content = await readFile14(fullPath, "utf-8");
          lines += content.split("\n").length;
        } catch {
        }
      }
    }
  }
  if (existsSync19(dir)) await walk(dir);
  return { files, lines };
}
var compareCommand = new Command20("compare").description("Compare the source POC against the production target").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const sourcePath = project.entry.source;
  const targetPath = project.entry.target;
  console.log(`
[${project.name}] Source vs Target Comparison
`);
  const sourceStats = await countFiles(sourcePath, [
    "node_modules",
    ".git",
    "dist"
  ]);
  const targetStats = await countFiles(targetPath, [
    "node_modules",
    ".git",
    ".proteus-forge",
    "dist"
  ]);
  console.log(`  Source: ${sourcePath}`);
  console.log(`    ${sourceStats.files} files, ~${sourceStats.lines.toLocaleString()} lines
`);
  console.log(`  Target: ${targetPath}`);
  console.log(`    ${targetStats.files} files, ~${targetStats.lines.toLocaleString()} lines
`);
  const fileRatio = targetStats.files > 0 && sourceStats.files > 0 ? (targetStats.files / sourceStats.files).toFixed(1) : "N/A";
  const lineRatio = targetStats.lines > 0 && sourceStats.lines > 0 ? (targetStats.lines / sourceStats.lines).toFixed(1) : "N/A";
  console.log(`  Growth: ${fileRatio}x files, ${lineRatio}x lines
`);
  if (existsSync19(targetPath)) {
    const entries = await readdir(targetPath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules").map((e) => e.name);
    if (dirs.length > 0) {
      console.log(`  Production structure:`);
      for (const d of dirs) {
        const dirStats = await countFiles(join19(targetPath, d), ["node_modules", "dist"]);
        console.log(`    ${d.padEnd(20)} ${dirStats.files} files`);
      }
    }
  }
  console.log("");
});

// src/commands/explain.ts
import { Command as Command21 } from "commander";
import { existsSync as existsSync20 } from "fs";
import { join as join20 } from "path";
var explainCommand = new Command21("explain").description("Explain a design or plan decision by reading artifacts").argument("<question>", "Question to answer (e.g., 'why is auth in wave 1?')").argument("[name]", "Project name (uses active project if omitted)").action(async (question, name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const forgeDir = join20(targetPath, ".proteus-forge");
  const contextFiles = [];
  const artifactPaths = [
    "01-inspect/features.json",
    "02-design/design.md",
    "02-design/design-meta.json",
    "03-plan/plan.md",
    "03-plan/plan.json",
    "04-tracks/manifest.json"
  ];
  for (const p of artifactPaths) {
    if (existsSync20(join20(forgeDir, p))) {
      contextFiles.push(p);
    }
  }
  if (contextFiles.length === 0) {
    console.error("No pipeline artifacts found. Run at least `proteus-forge inspect` first.");
    process.exit(1);
  }
  const globalConfig = await readGlobalConfig();
  const planRole = globalConfig?.roles["plan-generator"];
  const planTier = typeof planRole === "string" ? planRole : void 0;
  const tierConfig = planTier ? globalConfig?.tiers[planTier] : void 0;
  const model = tierConfig?.model;
  const prompt = `You are answering a question about a Proteus Forge project's architecture and plan.

Read the following artifact files in ${targetPath}/.proteus-forge/ to understand the project:
${contextFiles.map((f) => `- ${targetPath}/.proteus-forge/${f}`).join("\n")}

Then answer this question concisely and specifically, referencing the artifacts:

${question}

Be direct. Reference specific feature IDs, task IDs, service names, or wave numbers where relevant.`;
  console.log(`
[${project.name}] Explaining: "${question}"
`);
  const result = await launchSession({
    prompt,
    cwd: targetPath,
    model,
    permissionMode: "plan",
    onMessage: (message) => {
      if (message.type === "assistant" && "message" in message) {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if ("text" in block && typeof block.text === "string") {
              process.stdout.write(block.text);
            }
          }
        }
      }
    }
  });
  if (!result.success && result.errors?.length) {
    console.error(`
Error: ${result.errors.join("; ")}`);
  }
  console.log("");
});

// src/commands/resume.ts
import { Command as Command22 } from "commander";
import { existsSync as existsSync21 } from "fs";
import { mkdir as mkdir9 } from "fs/promises";
import { join as join21 } from "path";
var resumeCommand = new Command22("resume").description("Resume execute from the last wave checkpoint").argument("[name]", "Project name (uses active project if omitted)").option("--budget <amount>", "Maximum budget in USD", parseFloat).action(async (name, options) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;
  const manifestPath = join21(targetPath, ".proteus-forge", "04-tracks", "manifest.json");
  if (!existsSync21(manifestPath)) {
    console.error("Split stage not complete. Run the full pipeline first.");
    process.exit(1);
  }
  const lastWave = await getLastWaveCheckpoint(targetPath);
  if (lastWave === null) {
    console.error("No wave checkpoints found. Run `proteus-forge execute` instead.");
    process.exit(1);
  }
  console.log(`
[${project.name}] Resuming execute from wave ${lastWave + 1}...
`);
  console.log(`  Last completed wave: ${lastWave}`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    process.exit(1);
  }
  const execRole = globalConfig.roles["execute-agent"];
  const execTier = typeof execRole === "string" ? execRole : void 0;
  const tierConfig = execTier ? globalConfig.tiers[execTier] : void 0;
  const model = tierConfig?.model;
  let ctx;
  try {
    ctx = await loadExecuteContext(targetPath);
  } catch (err) {
    console.error(`Failed to load context: ${err.message}`);
    process.exit(1);
  }
  const basePrompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
  const resumePrompt = `${basePrompt}

## IMPORTANT: RESUMING FROM WAVE ${lastWave + 1}

This is a RESUME. Waves 1 through ${lastWave} have already been completed.
The code from those waves already exists in the target directory.

DO NOT re-do work from waves 1-${lastWave}. Start from wave ${lastWave + 1}.
Check what files already exist before creating new ones.`;
  const executeDir = join21(targetPath, ".proteus-forge", "05-execute");
  const inboxDir = join21(executeDir, "inbox");
  await mkdir9(inboxDir, { recursive: true });
  console.log("\n  Launching Agent Team...\n");
  const result = await launchSession({
    prompt: resumePrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    inboxDir,
    onMessage: (message) => {
      if (message.type === "assistant" && "message" in message) {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if ("text" in block && typeof block.text === "string") {
              const text = block.text.trim();
              if (text.length > 0 && text.length < 200) {
                process.stdout.write(`  ${text}
`);
              }
            }
          }
        }
      }
    }
  });
  const hasOutput = existsSync21(join21(targetPath, "src")) || existsSync21(join21(targetPath, "server"));
  if ((result.success || hasOutput) && hasOutput) {
    console.log(`
[${project.name}] Resume complete.
`);
    console.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);
    try {
      await gitStageAndCommit(targetPath, "proteus-forge: execute resumed and completed");
      console.log(`  Committed: "proteus-forge: execute resumed and completed"`);
    } catch {
    }
    await appendCostEntry(targetPath, "execute-resume", result.cost);
    await appendLogEntry(targetPath, {
      action: "resume",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
      details: `Resumed from wave ${lastWave + 1}`
    });
    console.log(`
  Production code: ${targetPath}/
`);
  } else {
    console.error(`
[${project.name}] Resume failed.
`);
    if (result.errors?.length) {
      for (const err of result.errors) {
        console.error(`  Error: ${err}`);
      }
    }
    await appendLogEntry(targetPath, {
      action: "resume",
      status: "failed",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
      details: result.errors?.join("; ")
    });
    process.exit(1);
  }
});

// src/commands/abort.ts
import { Command as Command23 } from "commander";
import { existsSync as existsSync22 } from "fs";
import { unlink } from "fs/promises";
import { join as join22 } from "path";
var abortCommand = new Command23("abort").description("Signal a running execute session to stop").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const sentinelPath = join22(getInboxDir(targetPath), ".active");
  if (!existsSync22(sentinelPath)) {
    console.error(
      "No active execute session found. Nothing to abort."
    );
    process.exit(1);
  }
  try {
    await unlink(sentinelPath);
  } catch {
  }
  const { writeInboxMessage: writeInboxMessage2 } = await import("./inbox-5EFHQSTH.js");
  await writeInboxMessage2(
    targetPath,
    "lead",
    "USER ABORT: The user has requested an immediate stop. Shut down all teammates and clean up the team. Do not start any new tasks."
  );
  console.log(`
[${project.name}] Abort signal sent.
`);
  console.log("  The Lead will receive the abort message on its next turn.");
  console.log("  Completed work is preserved. Use `proteus-forge resume` to continue later.\n");
  try {
    await gitStageAndCommit(targetPath, "proteus-forge: execute aborted by user");
    console.log(`  Committed partial progress: "proteus-forge: execute aborted by user"
`);
  } catch {
  }
  await appendLogEntry(targetPath, {
    action: "abort",
    status: "success",
    details: "User-initiated abort"
  });
});

// src/commands/watch.ts
import { Command as Command24 } from "commander";
import { existsSync as existsSync23, watchFile, unwatchFile } from "fs";
import { readFile as readFile13 } from "fs/promises";
import { join as join23 } from "path";
var watchCommand = new Command24("watch").description("Watch a running execute session's progress").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const sentinelPath = join23(getInboxDir(targetPath), ".active");
  if (!existsSync23(sentinelPath)) {
    console.error(
      "No active execute session found. Run `proteus-forge execute` first."
    );
    process.exit(1);
  }
  console.log(`
[${project.name}] Watching execute session...
`);
  console.log("  Monitoring .proteus-forge/log.jsonl for updates.");
  console.log("  Press Ctrl+C to stop watching.\n");
  const logPath = join23(targetPath, ".proteus-forge", "log.jsonl");
  let lastSize = 0;
  if (existsSync23(logPath)) {
    const content = await readFile13(logPath, "utf-8");
    lastSize = content.length;
    const lines = content.trim().split("\n").filter(Boolean);
    for (const line of lines.slice(-5)) {
      try {
        const entry = JSON.parse(line);
        const time = new Date(entry.timestamp).toLocaleTimeString();
        console.log(`  ${time}  ${entry.action} \u2014 ${entry.status}`);
      } catch {
      }
    }
  }
  const checkForUpdates = async () => {
    if (!existsSync23(logPath)) return;
    const content = await readFile13(logPath, "utf-8");
    if (content.length > lastSize) {
      const newContent = content.slice(lastSize);
      lastSize = content.length;
      const lines = newContent.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const time = new Date(entry.timestamp).toLocaleTimeString();
          console.log(`  ${time}  ${entry.action} \u2014 ${entry.status}`);
        } catch {
        }
      }
    }
  };
  const checkActive = () => {
    if (!existsSync23(sentinelPath)) {
      console.log("\n  Session ended.\n");
      process.exit(0);
    }
  };
  watchFile(logPath, { interval: 2e3 }, checkForUpdates);
  const activeInterval = setInterval(checkActive, 3e3);
  process.on("SIGINT", () => {
    unwatchFile(logPath);
    clearInterval(activeInterval);
    console.log("\n  Stopped watching.\n");
    process.exit(0);
  });
  await new Promise(() => {
  });
});

// src/index.ts
var program = new Command25();
program.name("proteus-forge").description(
  "Transform POC codebases into production-ready applications using coordinated AI agent teams"
).version("1.0.0");
program.addCommand(setupCommand);
program.addCommand(configCommand);
program.addCommand(newCommand);
program.addCommand(listCommand);
program.addCommand(useCommand);
program.addCommand(destroyCommand);
program.addCommand(inspectCommand);
program.addCommand(designCommand);
program.addCommand(planCommand);
program.addCommand(splitCommand);
program.addCommand(executeCommand);
program.addCommand(runCommand);
program.addCommand(informCommand);
program.addCommand(resumeCommand);
program.addCommand(abortCommand);
program.addCommand(watchCommand);
program.addCommand(statusCommand);
program.addCommand(validateCommand);
program.addCommand(reviewCommand);
program.addCommand(diffCommand);
program.addCommand(compareCommand);
program.addCommand(costsCommand);
program.addCommand(explainCommand);
program.addCommand(logCommand);
program.parse();
