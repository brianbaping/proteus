import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { readProjectConfig } from "../config/project.js";
import { generateInspectLeadPrompt } from "../prompts/inspect.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { printInspectTeamSummary } from "../utils/team-summary.js";
import { logProgress } from "../utils/progress.js";

/**
 * Run the inspect stage. Returns true on success, false on failure.
 * Exported for use by `proteus run`.
 */
export async function runInspect(
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

  if (!existsSync(sourcePath)) {
    console.error(`Source path not found: ${sourcePath}`);
    return false;
  }

  const globalConfig = await readGlobalConfig();
  const _projectConfig = await readProjectConfig(targetPath);

  if (!globalConfig) {
    console.error("Global config not found. Run `proteus setup` first.");
    return false;
  }

  const scoutRole = globalConfig.roles.scout;
  const scoutTier = typeof scoutRole === "string" ? scoutRole : undefined;
  const tierConfig = scoutTier ? globalConfig.tiers[scoutTier] : undefined;
  const model = tierConfig?.model;

  console.log(`\n[${project.name}] Inspecting source...\n`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${scoutTier} tier)`);

  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch Agent Team:");
    console.log("    Lead: scout (analyzes source, identifies domains)");
    console.log("    Teammates: one per discovered domain (spawned dynamically)");
    console.log("    Tasks: one per domain + synthesis");
    console.log(`\n  Estimated cost: depends on source repo size`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const inspectDir = join(targetPath, ".proteus", "01-inspect");
  const partialsDir = join(inspectDir, "partials");
  await mkdir(partialsDir, { recursive: true });

  const leadPrompt = generateInspectLeadPrompt(sourcePath, targetPath);

  console.log("\n  Launching Agent Team...\n");

  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: logProgress,
  });

  const featuresPath = join(inspectDir, "features.json");
  const featuresExist = existsSync(featuresPath);

  if ((result.success || featuresExist) && featuresExist) {
    const label = result.success ? "Inspection complete" : "Inspection recovered";
    console.log(`\n[${project.name}] ${label}.\n`);
    await printInspectTeamSummary(targetPath);
    console.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus: inspect complete" : "proteus: inspect complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "inspect", result.cost);
    await appendLogEntry(targetPath, {
      action: "inspect",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });

    console.log(`\n  Output: ${featuresPath}\n`);
    return true;
  }

  console.error(`\n[${project.name}] Inspection failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
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
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number }) => {
    const success = await runInspect(name, options);
    if (!success) process.exit(1);
  });
