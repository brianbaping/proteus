#!/usr/bin/env node
import {
  BOLD,
  DIM,
  RESET,
  appendCostEntry,
  appendLogEntry,
  checkStaleness,
  createDashboard,
  createProjectConfig,
  designCommand,
  ensureForgeDir,
  executeCommand,
  generateExecuteLeadPrompt,
  getCurrentStage,
  getDefaultGlobalConfig,
  getLastWaveCheckpoint,
  getProject,
  getStageDir,
  getStageOrder,
  getStageStatuses,
  getStagesAfter,
  gitInit,
  gitStageAndCommit,
  globalConfigExists,
  hasStyleGuide,
  inspectCommand,
  isValidStage,
  launchSession,
  loadExecuteContext,
  planCommand,
  printVerifyResult,
  readCosts,
  readGlobalConfig,
  readRegistry,
  registerProject,
  removeCostEntries,
  resolveApiKey,
  resolveModel,
  resolveProject,
  runDesign,
  runExecute,
  runInspect,
  runPlan,
  runSplit,
  runVerification,
  setActiveProject,
  splitCommand,
  styleCommand,
  unregisterProject,
  updateProject,
  writeGlobalConfig,
  writeProjectConfig,
  writeRegistry
} from "./chunk-OOJKWLVX.js";
import {
  getInboxDir,
  isInboxActive,
  writeInboxMessage
} from "./chunk-OXAFMJZU.js";

// src/index.ts
import { Command as Command25, Help } from "commander";

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
import { existsSync as existsSync2 } from "fs";
import { mkdir, writeFile as writeFile2 } from "fs/promises";
import { resolve, dirname, basename } from "path";
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
  if (!existsSync2(sourcePath)) {
    console.error(`Source path not found: ${sourcePath}`);
    process.exit(1);
  }
  const targetPath = options.target ? resolve(options.target) : resolve(dirname(sourcePath), `${basename(sourcePath)}-prod`);
  if (existsSync2(targetPath)) {
    console.error(`Target path already exists: ${targetPath}`);
    console.error("Choose a different target or remove the existing directory.");
    process.exit(1);
  }
  console.log(`Creating project "${name}"...
`);
  console.log(`  Source (read-only): ${sourcePath}`);
  console.log(`  Target: ${targetPath}
`);
  await mkdir(targetPath, { recursive: true });
  console.log("  \u2713 Created target directory");
  await gitInit(targetPath);
  console.log("  \u2713 Initialized git repo");
  await writeProjectConfig(targetPath, createProjectConfig(name, sourcePath));
  console.log("  \u2713 Created .proteus-forge/config.json");
  await writeFile2(resolve(targetPath, "CLAUDE.md"), CLAUDE_MD_CONTENT);
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

// src/utils/confirm.ts
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

// src/commands/destroy.ts
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

// src/commands/revert.ts
import { Command as Command6 } from "commander";
import { rm as rm2 } from "fs/promises";
import { existsSync as existsSync3 } from "fs";
import { join as join2 } from "path";
var revertCommand = new Command6("revert").description("Roll back to a stage, removing all artifacts after it").argument("<stage>", "Stage to revert to (inspect, design, plan, split, execute)").argument("[name]", "Project name (defaults to active project)").action(async (stage, name) => {
  if (!isValidStage(stage)) {
    console.error(
      `Invalid stage "${stage}". Valid stages: inspect, design, plan, split, execute`
    );
    process.exit(1);
  }
  const downstream = getStagesAfter(stage);
  if (downstream.length === 0) {
    console.log(`"${stage}" is the last stage \u2014 nothing to revert.`);
    return;
  }
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const forgeDir = join2(project.entry.target, ".proteus-forge");
  const dirs = downstream.map((s) => ({
    stage: s,
    dir: getStageDir(s),
    path: join2(forgeDir, getStageDir(s)),
    exists: existsSync3(join2(forgeDir, getStageDir(s)))
  }));
  const existingDirs = dirs.filter((d) => d.exists);
  if (existingDirs.length === 0) {
    console.log(`No downstream artifacts exist after "${stage}" \u2014 nothing to remove.`);
    return;
  }
  console.log(`
Project: ${project.name}`);
  console.log(`Reverting to: ${stage}`);
  console.log(`
Directories to remove:`);
  for (const d of dirs) {
    const marker = d.exists ? "  \u2717" : "  \u2013";
    const suffix = d.exists ? "" : " (not present)";
    console.log(`${marker} ${d.dir}${suffix}`);
  }
  const confirmed = await confirm(
    `
Remove ${existingDirs.length} stage director${existingDirs.length === 1 ? "y" : "ies"}?`
  );
  if (!confirmed) {
    console.log("Cancelled.");
    return;
  }
  for (const d of existingDirs) {
    await rm2(d.path, { recursive: true, force: true });
    console.log(`  \u2713 Removed ${d.dir}`);
  }
  await removeCostEntries(
    project.entry.target,
    downstream
  );
  await appendLogEntry(project.entry.target, {
    action: "revert",
    status: "success",
    details: `Reverted to ${stage}, removed: ${existingDirs.map((d) => d.stage).join(", ")}`
  });
  try {
    await gitStageAndCommit(
      project.entry.target,
      `proteus-forge: revert to ${stage}`
    );
  } catch {
  }
  console.log(`
Reverted to "${stage}" successfully.`);
});

// src/commands/reset.ts
import { Command as Command7 } from "commander";
import { rm as rm3 } from "fs/promises";
import { existsSync as existsSync4 } from "fs";
import { join as join3 } from "path";
var resetCommand = new Command7("reset").description("Remove artifacts for a single stage").argument("<stage>", "Stage to reset (inspect, design, plan, split, execute)").argument("[name]", "Project name (defaults to active project)").action(async (stage, name) => {
  if (!isValidStage(stage)) {
    console.error(
      `Invalid stage "${stage}". Valid stages: inspect, design, plan, split, execute`
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
  const forgeDir = join3(project.entry.target, ".proteus-forge");
  const dir = getStageDir(stage);
  const dirPath = join3(forgeDir, dir);
  if (!existsSync4(dirPath)) {
    console.log(`Stage "${stage}" has no artifacts (${dir} does not exist).`);
    return;
  }
  const downstream = getStagesAfter(stage);
  const staleDownstream = downstream.filter(
    (s) => existsSync4(join3(forgeDir, getStageDir(s)))
  );
  if (staleDownstream.length > 0) {
    console.log(
      `
\u26A0  Downstream stages with artifacts: ${staleDownstream.join(", ")}`
    );
    console.log(
      `   These will become stale. Consider \`proteus-forge revert ${stage}\` to remove them too.`
    );
  }
  console.log(`
Project: ${project.name}`);
  console.log(`Stage:   ${stage}`);
  console.log(`Remove:  ${dir}`);
  const confirmed = await confirm(`
Delete ${dir}?`);
  if (!confirmed) {
    console.log("Cancelled.");
    return;
  }
  await rm3(dirPath, { recursive: true, force: true });
  console.log(`  \u2713 Removed ${dir}`);
  await removeCostEntries(project.entry.target, [stage]);
  await appendLogEntry(project.entry.target, {
    action: "reset",
    status: "success",
    details: `Reset stage: ${stage}`
  });
  try {
    await gitStageAndCommit(
      project.entry.target,
      `proteus-forge: reset ${stage}`
    );
  } catch {
  }
  console.log(`
Reset "${stage}" successfully.`);
});

// src/commands/retarget.ts
import { Command as Command8 } from "commander";
import { rename } from "fs/promises";
import { existsSync as existsSync5 } from "fs";
import { resolve as resolve2 } from "path";
var retargetCommand = new Command8("retarget").description("Change the target directory for a project").argument("<path>", "New target path").argument("[name]", "Project name (defaults to active project)").option("--move", "Move the existing target directory to the new path").action(async (path, name, opts) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const newTarget = resolve2(path);
  const oldTarget = project.entry.target;
  if (newTarget === oldTarget) {
    console.log("New path is the same as the current target \u2014 nothing to do.");
    return;
  }
  const registry = await readRegistry();
  for (const [projName, entry] of Object.entries(registry.projects)) {
    if (projName !== project.name && entry.target === newTarget) {
      console.error(
        `Project "${projName}" already uses target path "${newTarget}".`
      );
      process.exit(1);
    }
  }
  if (opts.move) {
    if (!existsSync5(oldTarget)) {
      console.error(`Old target does not exist: ${oldTarget}`);
      process.exit(1);
    }
    if (existsSync5(newTarget)) {
      console.error(`New target already exists: ${newTarget}`);
      process.exit(1);
    }
    if (isInboxActive(oldTarget)) {
      console.error(
        "Cannot move while an execute session is active. Run `proteus-forge abort` first."
      );
      process.exit(1);
    }
    console.log(`
Project: ${project.name}`);
    console.log(`  From: ${oldTarget}`);
    console.log(`  To:   ${newTarget}`);
    const confirmed = await confirm("\nMove directory and update registry?");
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
    try {
      await rename(oldTarget, newTarget);
      console.log(`  \u2713 Moved directory`);
    } catch (err) {
      const code = err.code;
      if (code === "EXDEV") {
        console.error(
          "Cannot move across filesystems. Move the directory manually, then run `proteus-forge retarget` without --move."
        );
      } else {
        console.error(`Failed to move directory: ${err.message}`);
      }
      process.exit(1);
    }
  } else {
    if (!existsSync5(newTarget)) {
      console.log(`
\u26A0  New target does not exist yet: ${newTarget}`);
    }
    console.log(`
Project: ${project.name}`);
    console.log(`  From: ${oldTarget}`);
    console.log(`  To:   ${newTarget}`);
    const confirmed = await confirm("\nUpdate registry to new target path?");
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }
  }
  await updateProject(project.name, { target: newTarget });
  console.log(`  \u2713 Updated registry`);
  try {
    await appendLogEntry(newTarget, {
      action: "retarget",
      status: "success",
      details: `Retargeted from ${oldTarget} to ${newTarget}`
    });
  } catch {
  }
  console.log(`
Retargeted "${project.name}" to ${newTarget}.`);
});

// src/commands/status.ts
import { Command as Command9 } from "commander";
var statusCommand = new Command9("status").description("Show pipeline status for a project").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
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
import { Command as Command10 } from "commander";

// src/utils/models-api.ts
async function fetchAvailableModels(apiKey) {
  const models = [];
  let afterId;
  while (true) {
    const url = new URL("https://api.anthropic.com/v1/models");
    url.searchParams.set("limit", "1000");
    if (afterId) {
      url.searchParams.set("after_id", afterId);
    }
    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication failed: invalid API key");
      }
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText}`
      );
    }
    const body = await response.json();
    for (const m of body.data) {
      models.push({
        id: m.id,
        displayName: m.display_name,
        createdAt: m.created_at
      });
    }
    if (!body.has_more || !body.last_id) break;
    afterId = body.last_id;
  }
  return models;
}
function extractModelFamily(modelId) {
  const match = modelId.match(/^claude-(\w+)-\d/);
  return match?.[1];
}
function isModelAlias(modelId) {
  return /^claude-\w+-\d+-\d+$/.test(modelId);
}

// src/commands/config.ts
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
var getSubcommand = new Command10("get").description("Get a config value").argument("<key>", "Dot-notation config key (e.g., tiers.fast.model)").action(async (key) => {
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
var setSubcommand = new Command10("set").description("Set a config value").argument("<key>", "Dot-notation config key").argument("<value>", "Value to set").action(async (key, value) => {
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
var refreshModelsSubcommand = new Command10("refresh-models").description("Fetch latest models from Anthropic API and update tier assignments").action(async () => {
  const config = await readGlobalConfig() ?? getDefaultGlobalConfig();
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    console.error(
      "No API key configured. Set providers.anthropic.apiKey in config or ANTHROPIC_API_KEY env var."
    );
    process.exit(1);
  }
  console.log("\nFetching models from Anthropic API...\n");
  let models;
  try {
    models = await fetchAvailableModels(apiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to fetch models: ${msg}`);
    process.exit(1);
  }
  const aliases = models.filter((m) => isModelAlias(m.id));
  let anyUpdated = false;
  for (const [tierName, tierConfig] of Object.entries(config.tiers)) {
    const currentFamily = extractModelFamily(tierConfig.model);
    if (!currentFamily) {
      console.log(
        `  ${tierName.padEnd(12)} ${tierConfig.model} ${DIM}(unknown family, skipped)${RESET}`
      );
      continue;
    }
    const newest = aliases.find(
      (m) => extractModelFamily(m.id) === currentFamily
    );
    if (!newest || newest.id === tierConfig.model) {
      console.log(
        `  ${tierName.padEnd(12)} ${tierConfig.model} ${DIM}(current)${RESET}`
      );
      continue;
    }
    console.log(
      `  ${tierName.padEnd(12)} ${tierConfig.model} \u2192 ${BOLD}${newest.id}${RESET} ${DIM}(updated)${RESET}`
    );
    tierConfig.model = newest.id;
    anyUpdated = true;
  }
  if (anyUpdated) {
    await writeGlobalConfig(config);
    console.log(`
${BOLD}Config updated.${RESET}
`);
  } else {
    console.log("\nAll tiers are up to date.\n");
  }
});
var configCommand = new Command10("config").description("Get or set Proteus Forge configuration values").addCommand(getSubcommand).addCommand(setSubcommand).addCommand(refreshModelsSubcommand);

// src/commands/run.ts
import { Command as Command11 } from "commander";
var STAGE_RUNNERS = {
  inspect: (name, opts) => runInspect(name, { budget: opts.budget, excludeStyle: opts.excludeStyle, tier: opts.tier, model: opts.model }),
  design: (name, opts) => runDesign(name, { budget: opts.budget, brief: opts.brief, briefFile: opts.briefFile, tier: opts.tier, model: opts.model }),
  plan: (name, opts) => runPlan(name, { budget: opts.budget, tier: opts.tier, model: opts.model }),
  split: (name, opts) => runSplit(name, { budget: opts.budget, tier: opts.tier, model: opts.model }),
  execute: (name, opts) => runExecute(name, { budget: opts.budget, tier: opts.tier, model: opts.model })
};
var runCommand = new Command11("run").description("Run the full pipeline or a range of stages without stopping").argument("[name]", "Project name (uses active project if omitted)").option("--from <stage>", "Start from this stage (default: next incomplete)").option("--to <stage>", "Stop after this stage (default: execute)").option("--budget <amount>", "Maximum budget per stage in USD", parseFloat).option("--brief <text>", "Architectural requirements for the design stage").option("--brief-file <path>", "Path to architectural requirements file").option("--exclude-style", "Skip style extraction after inspect").option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").action(
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
import { Command as Command12 } from "commander";
var informCommand = new Command12("inform").description("Send a message to a running agent during execute").argument("<agent>", "Agent name (e.g., backend-engineer, frontend-engineer)").argument("<message>", "Message to relay to the agent").option("--project <name>", "Project name (uses active project if omitted)").action(
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
import { Command as Command13 } from "commander";
import { existsSync as existsSync6 } from "fs";
import { readFile as readFile2 } from "fs/promises";
import { join as join4 } from "path";
var logCommand = new Command13("log").description("View the audit trail for a project").argument("[name]", "Project name (uses active project if omitted)").option("-n <count>", "Show last N entries", parseInt).action(async (name, options) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const logPath = join4(project.entry.target, ".proteus-forge", "log.jsonl");
  if (!existsSync6(logPath)) {
    console.log(`
[${project.name}] No log entries yet.
`);
    return;
  }
  const content = await readFile2(logPath, "utf-8");
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
import { Command as Command14 } from "commander";
var costsCommand = new Command14("costs").description("Show token usage and cost breakdown per stage").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
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
import { Command as Command15 } from "commander";
import { existsSync as existsSync7 } from "fs";
import { join as join5 } from "path";
import { spawn } from "child_process";
var STAGE_REVIEW_FILES = {
  inspect: "01-inspect/inspect.md",
  style: "02-style/style.md",
  design: "02-design/design.md",
  plan: "03-plan/plan.md",
  split: "04-tracks/split.md",
  execute: "05-execute/execute.md"
};
var reviewCommand = new Command15("review").description("Open a stage artifact in $EDITOR for review").argument("<stage>", "Stage to review (inspect, style, design, plan, split, execute)").argument("[name]", "Project name (uses active project if omitted)").action(async (stage, name) => {
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
  const artifactPath = join5(
    project.entry.target,
    ".proteus-forge",
    STAGE_REVIEW_FILES[stage]
  );
  if (!existsSync7(artifactPath)) {
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
import { Command as Command16 } from "commander";
import { existsSync as existsSync8 } from "fs";
import { readFile as readFile3 } from "fs/promises";
import { join as join6 } from "path";
async function readJson(path) {
  if (!existsSync8(path)) return null;
  try {
    return JSON.parse(await readFile3(path, "utf-8"));
  } catch {
    return null;
  }
}
var validateCommand = new Command16("validate").description("Run cross-stage artifact validation").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const forgeDir = join6(targetPath, ".proteus-forge");
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
    const features = await readJson(join6(forgeDir, "01-inspect", "features.json"));
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
    const designMeta = await readJson(join6(forgeDir, "02-design", "design-meta.json"));
    if (designMeta) {
      const featureMap = designMeta.featureToServiceMap;
      results.push({
        rule: "Feature-to-service map exists",
        passed: !!featureMap && Object.keys(featureMap).length > 0,
        message: featureMap ? `${Object.keys(featureMap).length} features mapped` : "Missing map"
      });
    }
    const designMd = join6(forgeDir, "02-design", "design.md");
    results.push({
      rule: "design.md exists",
      passed: existsSync8(designMd),
      message: existsSync8(designMd) ? "Present" : "Missing"
    });
  }
  if (completedStages.includes("plan")) {
    const plan = await readJson(join6(forgeDir, "03-plan", "plan.json"));
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
    const manifest = await readJson(join6(forgeDir, "04-tracks", "manifest.json"));
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

// src/commands/verify.ts
import { Command as Command17 } from "commander";
import { existsSync as existsSync9 } from "fs";
import { join as join7 } from "path";

// src/prompts/verify-fix.ts
var MAX_OUTPUT_LINES = 200;
function truncateOutput(output) {
  if (!output) return "(no output captured)";
  const lines = output.split("\n");
  if (lines.length <= MAX_OUTPUT_LINES) return output;
  return `... (${lines.length - MAX_OUTPUT_LINES} lines truncated)
${lines.slice(-MAX_OUTPUT_LINES).join("\n")}`;
}
function extractFailedSteps(steps) {
  return steps.filter((s) => !s.skipped && !s.passed).map((s) => ({
    name: s.name,
    command: s.command,
    args: s.args,
    output: s.output
  }));
}
function generateVerifyFixPrompt(targetPath, steps, packageManager) {
  const failedSteps = extractFailedSteps(steps);
  const failureDetails = failedSteps.map(
    (step) => `### ${step.name}

Command: \`${step.command} ${step.args.join(" ")}\`

\`\`\`
${truncateOutput(step.output)}
\`\`\``
  ).join("\n\n");
  return `You are a focused fix agent for a Proteus Forge project. Your job is to diagnose and fix verification failures with minimal, targeted changes.

## Context

You are working in: ${targetPath}
Package manager: ${packageManager}

## Failed Steps

The following verification steps failed:

${failureDetails}

## Instructions

1. Read the error output for each failed step carefully
2. Diagnose the root cause of each failure
3. Make the minimal code changes needed to fix each failure
4. After making fixes, re-run each failing command yourself to verify:
${failedSteps.map((s) => `   - \`${s.command} ${s.args.join(" ")}\``).join("\n")}

## Constraints

- Make minimal, targeted fixes only \u2014 do not refactor unrelated code
- Do NOT remove or skip tests to make them pass
- Do NOT weaken or disable lint rules
- Do NOT cast to \`any\` or add type assertions to suppress errors
- Do NOT change the project architecture or directory structure
- Fix the actual underlying issues, not the symptoms
- If a fix requires installing a missing dependency, use \`${packageManager}\` to install it
`;
}

// src/commands/verify.ts
async function runVerify(name, options) {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    return false;
  }
  const targetPath = project.entry.target;
  const pkgPath = join7(targetPath, "package.json");
  if (!existsSync9(pkgPath)) {
    console.error(
      `No package.json found in ${targetPath}. Verify requires a Node.js project with a package.json.`
    );
    return false;
  }
  console.log(`
[${project.name}] Running verification...
`);
  console.log(`  Target: ${targetPath}`);
  const result = await runVerification(targetPath, {
    skipInstall: options.skipInstall,
    verbose: options.verbose
  });
  printVerifyResult(result, options.verbose);
  const stepSummary = result.steps.map((s) => `${s.name}:${s.skipped ? "skipped" : s.passed ? "passed" : "failed"}`).join(", ");
  await appendLogEntry(targetPath, {
    action: "verify",
    status: result.allPassed ? "success" : "failed",
    details: stepSummary
  });
  if (result.allPassed || !options.fix) {
    return result.allPassed;
  }
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }
  const model = resolveModel(globalConfig, "verify-fix", {
    tier: options.tier,
    model: options.model
  });
  const fixPrompt = generateVerifyFixPrompt(
    targetPath,
    result.steps,
    result.packageManager
  );
  console.log(`
[${project.name}] Launching fix session...
`);
  if (model) console.log(`  Model: ${model}`);
  const dashboard = createDashboard("verify-fix");
  const fixResult = await launchSession({
    prompt: fixPrompt,
    cwd: targetPath,
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: (msg) => dashboard.onMessage(msg)
  });
  dashboard.cleanup();
  await appendCostEntry(targetPath, "verify-fix", fixResult.cost);
  await appendLogEntry(targetPath, {
    action: "verify-fix",
    status: fixResult.success ? "success" : "failed",
    duration: fixResult.cost.duration,
    cost: fixResult.cost.estimatedCost
  });
  if (!fixResult.success) {
    console.error(`
[${project.name}] Fix session failed.`);
    if (fixResult.errors?.length) {
      for (const err of fixResult.errors) console.error(`  Error: ${err}`);
    }
    return false;
  }
  console.log(`
[${project.name}] Re-running verification...
`);
  const reVerifyResult = await runVerification(targetPath, {
    skipInstall: options.skipInstall,
    verbose: options.verbose
  });
  printVerifyResult(reVerifyResult, options.verbose);
  const reStepSummary = reVerifyResult.steps.map((s) => `${s.name}:${s.skipped ? "skipped" : s.passed ? "passed" : "failed"}`).join(", ");
  await appendLogEntry(targetPath, {
    action: "verify",
    status: reVerifyResult.allPassed ? "success" : "failed",
    details: `post-fix: ${reStepSummary}`
  });
  return reVerifyResult.allPassed;
}
var verifyCommand = new Command17("verify").description("Run install/build/test/lint verification on the target repo").argument("[name]", "Project name (uses active project if omitted)").option("--verbose", "Show full output from failed steps").option("--skip-install", "Skip the install step").option("--fix", "Launch a Claude Code session to fix failures").option("--tier <tier>", "Override model tier for fix session (fast, standard, advanced)").option("--model <model>", "Override model for fix session (e.g., claude-sonnet-4-6)").option("--budget <amount>", "Maximum budget in USD for fix session", parseFloat).action(
  async (name, options) => {
    const success = await runVerify(name, options);
    if (!success) process.exit(1);
  }
);

// src/commands/diff.ts
import { Command as Command18 } from "commander";
import { existsSync as existsSync10 } from "fs";
import { join as join8 } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
var STAGE_ARTIFACTS = {
  inspect: ["01-inspect/features.json", "01-inspect/scout.json"],
  style: ["02-style/style-guide.json", "02-style/style.md"],
  design: ["02-design/design.md", "02-design/design-meta.json"],
  plan: ["03-plan/plan.json", "03-plan/plan.md"],
  split: ["04-tracks/manifest.json"],
  execute: ["05-execute/session.json"]
};
var diffCommand = new Command18("diff").description("Show git changes for a stage's artifacts between runs").argument("<stage>", "Stage to diff (inspect, style, design, plan, split, execute)").argument("[name]", "Project name (uses active project if omitted)").action(async (stage, name) => {
  if (!STAGE_ARTIFACTS[stage]) {
    console.error(
      `Unknown stage "${stage}". Valid stages: ${Object.keys(STAGE_ARTIFACTS).join(", ")}`
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
  const paths = STAGE_ARTIFACTS[stage].map(
    (p) => join8(".proteus-forge", p)
  );
  const existing = paths.filter((p) => existsSync10(join8(targetPath, p)));
  if (existing.length === 0) {
    console.error(
      `No ${stage} artifacts found. Run \`proteus-forge ${stage}\` first.`
    );
    process.exit(1);
  }
  try {
    const { stdout } = await execFileAsync(
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
      const { stdout } = await execFileAsync(
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
import { Command as Command19 } from "commander";
import { existsSync as existsSync11 } from "fs";
import { readdir } from "fs/promises";
import { join as join9 } from "path";
async function countFiles(dir, exclude = []) {
  let files = 0;
  let lines = 0;
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join9(current, entry.name);
      const relative = fullPath.replace(dir + "/", "");
      if (exclude.some((ex) => relative.startsWith(ex) || entry.name === ex)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files++;
        try {
          const { readFile: readFile5 } = await import("fs/promises");
          const content = await readFile5(fullPath, "utf-8");
          lines += content.split("\n").length;
        } catch {
        }
      }
    }
  }
  if (existsSync11(dir)) await walk(dir);
  return { files, lines };
}
var compareCommand = new Command19("compare").description("Compare the source POC against the production target").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
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
  if (existsSync11(targetPath)) {
    const entries = await readdir(targetPath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules").map((e) => e.name);
    if (dirs.length > 0) {
      console.log(`  Production structure:`);
      for (const d of dirs) {
        const dirStats = await countFiles(join9(targetPath, d), ["node_modules", "dist"]);
        console.log(`    ${d.padEnd(20)} ${dirStats.files} files`);
      }
    }
  }
  console.log("");
});

// src/commands/explain.ts
import { Command as Command20 } from "commander";
import { existsSync as existsSync12 } from "fs";
import { join as join10 } from "path";
var explainCommand = new Command20("explain").description("Explain a design or plan decision by reading artifacts").argument("<question>", "Question to answer (e.g., 'why is auth in wave 1?')").argument("[name]", "Project name (uses active project if omitted)").option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").action(async (question, name, options) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const forgeDir = join10(targetPath, ".proteus-forge");
  const contextFiles = [];
  const artifactPaths = [
    "01-inspect/features.json",
    "02-design/design.md",
    "02-design/design-meta.json",
    "03-plan/plan.md",
    "03-plan/plan.json",
    "04-tracks/manifest.json"
  ];
  if (hasStyleGuide(targetPath)) {
    artifactPaths.splice(1, 0, "02-style/style-guide.json");
  }
  for (const p of artifactPaths) {
    if (existsSync12(join10(forgeDir, p))) {
      contextFiles.push(p);
    }
  }
  if (contextFiles.length === 0) {
    console.error("No pipeline artifacts found. Run at least `proteus-forge inspect` first.");
    process.exit(1);
  }
  const globalConfig = await readGlobalConfig();
  const model = globalConfig ? resolveModel(globalConfig, "plan-generator", { tier: options.tier, model: options.model }) : void 0;
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
import { Command as Command21 } from "commander";
import { existsSync as existsSync13 } from "fs";
import { mkdir as mkdir2 } from "fs/promises";
import { join as join11 } from "path";
var resumeCommand = new Command21("resume").description("Resume execute from the last wave checkpoint").argument("[name]", "Project name (uses active project if omitted)").option("--budget <amount>", "Maximum budget in USD", parseFloat).option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)").option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)").action(async (name, options) => {
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
  const manifestPath = join11(targetPath, ".proteus-forge", "04-tracks", "manifest.json");
  if (!existsSync13(manifestPath)) {
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
  const model = resolveModel(globalConfig, "execute-agent", { tier: options.tier, model: options.model });
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
  const executeDir = join11(targetPath, ".proteus-forge", "05-execute");
  const inboxDir = join11(executeDir, "inbox");
  await mkdir2(inboxDir, { recursive: true });
  console.log("\n  Launching Agent Team...\n");
  const dashboard = createDashboard("resume");
  const result = await launchSession({
    prompt: resumePrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    inboxDir,
    onMessage: (msg) => dashboard.onMessage(msg)
  });
  dashboard.cleanup();
  const hasOutput = existsSync13(join11(targetPath, "src")) || existsSync13(join11(targetPath, "server"));
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
import { Command as Command22 } from "commander";
import { existsSync as existsSync14 } from "fs";
import { unlink } from "fs/promises";
import { join as join12 } from "path";
var abortCommand = new Command22("abort").description("Signal a running execute session to stop").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const sentinelPath = join12(getInboxDir(targetPath), ".active");
  if (!existsSync14(sentinelPath)) {
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
import { Command as Command23 } from "commander";
import { existsSync as existsSync15, watchFile, unwatchFile } from "fs";
import { readFile as readFile4 } from "fs/promises";
import { join as join13 } from "path";
var watchCommand = new Command23("watch").description("Watch a running execute session's progress").argument("[name]", "Project name (uses active project if omitted)").action(async (name) => {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const targetPath = project.entry.target;
  const sentinelPath = join13(getInboxDir(targetPath), ".active");
  if (!existsSync15(sentinelPath)) {
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
  const logPath = join13(targetPath, ".proteus-forge", "log.jsonl");
  let lastSize = 0;
  if (existsSync15(logPath)) {
    const content = await readFile4(logPath, "utf-8");
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
    if (!existsSync15(logPath)) return;
    const content = await readFile4(logPath, "utf-8");
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
    if (!existsSync15(sentinelPath)) {
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

// src/commands/list-models.ts
import { Command as Command24 } from "commander";
var listModelsCommand = new Command24("list-models").description("Show configured model tiers and role assignments").option("--available", "Fetch and display available models from the Anthropic API").action(async (options) => {
  const config = await readGlobalConfig();
  if (!config) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    process.exit(1);
  }
  console.log(`
${BOLD}Tiers${RESET}
`);
  for (const [name, tier] of Object.entries(config.tiers)) {
    console.log(
      `  ${name.padEnd(12)} ${tier.model} ${DIM}(${tier.provider})${RESET}`
    );
  }
  console.log(`
${BOLD}Role Assignments${RESET}
`);
  for (const [role, mapping] of Object.entries(config.roles)) {
    const display = typeof mapping === "string" ? `\u2192 ${mapping} \u2192 ${config.tiers[mapping]?.model ?? "?"}` : `\u2192 ${mapping.model} ${DIM}(direct)${RESET}`;
    console.log(`  ${role.padEnd(22)} ${display}`);
  }
  console.log();
  if (options.available) {
    const apiKey = await resolveApiKey();
    if (!apiKey) {
      console.error("No API key configured. Set providers.anthropic.apiKey in config or ANTHROPIC_API_KEY env var.");
      process.exit(1);
    }
    try {
      const models = await fetchAvailableModels(apiKey);
      console.log(`${BOLD}Available Models (from API)${RESET}
`);
      for (const m of models) {
        const date = m.createdAt.split("T")[0];
        console.log(
          `  ${m.id.padEnd(30)} ${m.displayName.padEnd(25)} ${DIM}${date}${RESET}`
        );
      }
      console.log(`
To update tiers: ${BOLD}proteus-forge config refresh-models${RESET}
`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to fetch models: ${msg}`);
      process.exit(1);
    }
  }
});

// src/index.ts
var program = new Command25();
program.name("proteus-forge").description(
  "Transform POC codebases into production-ready applications using coordinated AI agent teams"
).version("1.0.0");
var PRIMARY_COMMAND_COUNT = 8;
program.addCommand(setupCommand);
program.addCommand(newCommand);
program.addCommand(useCommand);
program.addCommand(inspectCommand);
program.addCommand(designCommand);
program.addCommand(planCommand);
program.addCommand(splitCommand);
program.addCommand(executeCommand);
program.addCommand(abortCommand);
program.addCommand(compareCommand);
program.addCommand(configCommand);
program.addCommand(costsCommand);
program.addCommand(destroyCommand);
program.addCommand(diffCommand);
program.addCommand(explainCommand);
program.addCommand(informCommand);
program.addCommand(listCommand);
program.addCommand(listModelsCommand);
program.addCommand(logCommand);
program.addCommand(resetCommand);
program.addCommand(resumeCommand);
program.addCommand(retargetCommand);
program.addCommand(revertCommand);
program.addCommand(reviewCommand);
program.addCommand(runCommand);
program.addCommand(statusCommand);
program.addCommand(styleCommand);
program.addCommand(validateCommand);
program.addCommand(verifyCommand);
program.addCommand(watchCommand);
program.configureHelp({
  formatHelp(cmd, helper) {
    const output = Help.prototype.formatHelp.call(this, cmd, helper);
    if (cmd.parent) return output;
    const lines = output.split("\n");
    const idx = lines.findIndex((l) => l.trimEnd() === "Commands:");
    if (idx >= 0) {
      lines.splice(idx + 1 + PRIMARY_COMMAND_COUNT, 0, "");
    }
    return lines.join("\n");
  }
});
program.parse();
