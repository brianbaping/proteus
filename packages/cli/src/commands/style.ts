import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProgressReporter } from "@proteus-forge/shared";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generateStyleLeadPrompt } from "../prompts/style.js";
import { resolveModel } from "../utils/model-resolution.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { createDashboard } from "../utils/progress.js";
import { terminalReporter } from "../utils/terminal-reporter.js";

/**
 * Run the style stage. Returns true on success, false on failure.
 * Exported for use by `proteus-forge run`.
 */
export async function runStyle(
  name: string | undefined,
  options: { dryRun?: boolean; budget?: number; tier?: string; model?: string },
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

  const featuresPath = join(targetPath, ".proteus-forge", "01-inspect", "features.json");
  if (!existsSync(featuresPath)) {
    reporter.error("Inspect stage not complete. Run `proteus-forge inspect` first.");
    return false;
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  const model = resolveModel(globalConfig, "style-lead", { tier: options.tier, model: options.model });

  reporter.log(`\n[${project.name}] Extracting style guide...\n`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  reporter.log(`  Mode: single Lead session (no teammates)`);

  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch single Lead session:");
    reporter.log("    Reads: features.json, source CSS/style files");
    reporter.log("    Produces: style-guide.json + style.md");
    reporter.log(`\n  Estimated cost: ~$0.05-0.20`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const styleDir = join(targetPath, ".proteus-forge", "02-style");
  await mkdir(styleDir, { recursive: true });

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
    onMessage: onMessage ?? ((msg) => dashboard!.onMessage(msg)),
  });
  if (dashboard) dashboard.cleanup();

  const styleGuidePath = join(styleDir, "style-guide.json");
  const styleGuideExists = existsSync(styleGuidePath);

  if ((result.success || styleGuideExists) && styleGuideExists) {
    const label = result.success ? "Style extraction complete" : "Style extraction recovered";
    reporter.log(`\n[${project.name}] ${label}.\n`);
    reporter.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: style complete" : "proteus-forge: style complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "style", result.cost);
    await appendLogEntry(targetPath, {
      action: "style",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });

    reporter.log(`\n  Output: ${join(styleDir, "style.md")}`);
    reporter.log(`          ${styleGuidePath}`);
    reporter.log(`  Review: proteus-forge review style`);
    reporter.log(`  Next:   proteus-forge design\n`);
    return true;
  }

  reporter.error(`\n[${project.name}] Style extraction failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }

  await appendLogEntry(targetPath, {
    action: "style",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; "),
  });

  return false;
}

export const styleCommand = new Command("style")
  .description("Extract the visual identity and style guide from the source POC")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)")
  .option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)")
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number; tier?: string; model?: string }) => {
    const success = await runStyle(name, options);
    if (!success) process.exit(1);
  });
