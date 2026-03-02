/**
 * Public API surface for @proteus-forge/cli.
 * This is the sole barrel export — used by packages/gui to access CLI functionality.
 */

// Session launcher
export { launchSession } from "./session/launcher.js";
export type { LaunchOptions, SessionResult } from "./session/launcher.js";

// Config CRUD
export { readRegistry, writeRegistry, registerProject, unregisterProject, setActiveProject, getActiveProject, getProject, updateProject } from "./config/registry.js";
export { readGlobalConfig, writeGlobalConfig, globalConfigExists, getForgeDir, getGlobalConfigPath, getDefaultGlobalConfig } from "./config/global.js";
export { readProjectConfig, writeProjectConfig, createProjectConfig, ensureProjectDir, getProjectForgeDir } from "./config/project.js";

// Stage utilities (Node.js-dependent — filesystem access)
export { getStageStatuses, getCurrentStage, checkStaleness } from "./utils/stages.js";

// Cost tracking
export { readCosts, appendCostEntry } from "./utils/costs.js";

// Inbox system
export { writeInboxMessage, isInboxActive, getInboxDir } from "./utils/inbox.js";

// Pipeline stage runners
export { runInspect } from "./commands/inspect.js";
export { runDesign } from "./commands/design.js";
export { runPlan } from "./commands/plan.js";
export { runSplit } from "./commands/split.js";
export { runExecute } from "./commands/execute.js";
export { runStyle } from "./commands/style.js";

// Prompt generators
export { generateInspectLeadPrompt } from "./prompts/inspect.js";
export { generateDesignLeadPrompt } from "./prompts/design.js";
export { generatePlanLeadPrompt } from "./prompts/plan.js";
export { generateSplitLeadPrompt } from "./prompts/split.js";
export { generateExecuteLeadPrompt, loadExecuteContext } from "./prompts/execute.js";
export { generateStyleLeadPrompt } from "./prompts/style.js";

// Terminal reporter (default ProgressReporter for terminal output)
export { terminalReporter } from "./utils/terminal-reporter.js";

// Dashboard (for parsing agent activity)
export { AgentDashboard } from "./utils/dashboard.js";
export { createDashboard } from "./utils/progress.js";

// Log
export { appendLogEntry } from "./utils/log.js";
