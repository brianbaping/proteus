import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generateStyleLeadPrompt } from "../prompts/style.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { createDashboard } from "../utils/progress.js";

/**
 * Run the style stage. Returns true on success, false on failure.
 * Exported for use by `proteus-forge run`.
 */
export async function runStyle(
  name: string | undefined,
  options: { dryRun?: boolean; budget?: number }
): Promise<boolean> {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error((err as Error).message);
    return false;
  }

  const { entry } = project;
  const sourcePath = entry.source;
  const targetPath = entry.target;

  const featuresPath = join(targetPath, ".proteus-forge", "01-inspect", "features.json");
  if (!existsSync(featuresPath)) {
    console.error("Inspect stage not complete. Run `proteus-forge inspect` first.");
    return false;
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  const styleRole = globalConfig.roles["style-lead"];
  const styleTier = typeof styleRole === "string" ? styleRole : undefined;
  const tierConfig = styleTier ? globalConfig.tiers[styleTier] : undefined;
  const model = tierConfig?.model;

  console.log(`\n[${project.name}] Extracting style guide...\n`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${styleTier} tier)`);
  console.log(`  Mode: single Lead session (no teammates)`);

  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch single Lead session:");
    console.log("    Reads: features.json, source CSS/style files");
    console.log("    Produces: style-guide.json + style.md");
    console.log(`\n  Estimated cost: ~$0.05-0.20`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const styleDir = join(targetPath, ".proteus-forge", "02-style");
  await mkdir(styleDir, { recursive: true });

  const leadPrompt = generateStyleLeadPrompt(sourcePath, targetPath);
  console.log("\n  Launching session...\n");

  const dashboard = createDashboard("style");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: (msg) => dashboard.onMessage(msg),
  });
  dashboard.cleanup();

  const styleGuidePath = join(styleDir, "style-guide.json");
  const styleGuideExists = existsSync(styleGuidePath);

  if ((result.success || styleGuideExists) && styleGuideExists) {
    const label = result.success ? "Style extraction complete" : "Style extraction recovered";
    console.log(`\n[${project.name}] ${label}.\n`);
    console.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: style complete" : "proteus-forge: style complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "style", result.cost);
    await appendLogEntry(targetPath, {
      action: "style",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });

    console.log(`\n  Output: ${join(styleDir, "style.md")}`);
    console.log(`          ${styleGuidePath}`);
    console.log(`  Review: proteus-forge review style`);
    console.log(`  Next:   proteus-forge design\n`);
    return true;
  }

  console.error(`\n[${project.name}] Style extraction failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
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
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number }) => {
    const success = await runStyle(name, options);
    if (!success) process.exit(1);
  });
