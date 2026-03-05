import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProgressReporter } from "@proteus-forge/shared";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { readProjectConfig } from "../config/project.js";
import { generateInspectLeadPrompt } from "../prompts/inspect.js";
import { resolveModel } from "../utils/model-resolution.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { updateProject } from "../config/registry.js";
import { printInspectTeamSummary } from "../utils/team-summary.js";
import { createDashboard } from "../utils/progress.js";
import { terminalReporter } from "../utils/terminal-reporter.js";
import { runStyle } from "./style.js";

/**
 * Run the inspect stage. Returns true on success, false on failure.
 * Exported for use by `proteus-forge run`.
 */
export async function runInspect(
  name: string | undefined,
  options: { dryRun?: boolean; budget?: number; excludeStyle?: boolean; tier?: string; model?: string },
  reporter: ProgressReporter = terminalReporter,
  onMessage?: (msg: SDKMessage) => void,
): Promise<boolean> {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    reporter.error((err as Error).message);
    return false;
  }

  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;

  if (!existsSync(sourcePath)) {
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

  reporter.log(`\n[${project.name}] Inspecting source...\n`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);

  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch Agent Team:");
    reporter.log("    Lead: scout (analyzes source, identifies domains)");
    reporter.log("    Teammates: one per discovered domain (spawned dynamically)");
    reporter.log("    Tasks: one per domain + synthesis");
    reporter.log(`\n  Estimated cost: depends on source repo size`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const inspectDir = join(targetPath, ".proteus-forge", "01-inspect");
  const partialsDir = join(inspectDir, "partials");
  await mkdir(partialsDir, { recursive: true });

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
    onMessage: onMessage ?? ((msg) => dashboard!.onMessage(msg)),
  });
  if (dashboard) dashboard.cleanup();

  const featuresPath = join(inspectDir, "features.json");
  const featuresExist = existsSync(featuresPath);

  if ((result.success || featuresExist) && featuresExist) {
    const label = result.success ? "Inspection complete" : "Inspection recovered";
    reporter.log(`\n[${project.name}] ${label}.\n`);
    await printInspectTeamSummary(targetPath);
    reporter.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: inspect complete" : "proteus-forge: inspect complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "inspect", result.cost);
    await appendLogEntry(targetPath, {
      action: "inspect",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });
    await updateProject(name, { lastCompletedStage: "inspect" });

    reporter.log(`\n  Output: ${join(inspectDir, "inspect.md")}`);
    reporter.log(`          ${featuresPath}`);
    reporter.log(`  Review: proteus-forge review inspect`);
    reporter.log(`  Next:   proteus-forge design\n`);

    if (!options.excludeStyle) {
      reporter.log(`  Running style extraction...\n`);
      const styleOk = await runStyle(name, { budget: options.budget, tier: options.tier, model: options.model }, reporter, onMessage);
      if (!styleOk) {
        reporter.log(`  \u26a0 Style extraction failed — continuing without style guide.\n`);
      }
    }

    return true;
  }

  reporter.error(`\n[${project.name}] Inspection failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }

  await appendLogEntry(targetPath, {
    action: "inspect",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; "),
  });

  return false;
}

export const inspectCommand = new Command("inspect")
  .description("Analyze the source POC and produce a feature inventory")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .option("--exclude-style", "Skip style extraction after inspect")
  .option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)")
  .option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)")
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number; excludeStyle?: boolean; tier?: string; model?: string }) => {
    const success = await runInspect(name, options);
    if (!success) process.exit(1);
  });
