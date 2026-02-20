import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generatePlanLeadPrompt } from "../prompts/plan.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { checkStaleness } from "../utils/stages.js";
import { createDashboard } from "../utils/progress.js";

export async function runPlan(
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

  const designMdPath = join(targetPath, ".proteus-forge", "02-design", "design.md");
  const designMetaPath = join(targetPath, ".proteus-forge", "02-design", "design-meta.json");
  if (!existsSync(designMdPath) && !existsSync(designMetaPath)) {
    console.error("Design stage not complete. Run `proteus-forge design` first.");
    return false;
  }

  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "plan") {
      console.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
    }
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  const planRole = globalConfig.roles["plan-generator"];
  const planTier = typeof planRole === "string" ? planRole : undefined;
  const tierConfig = planTier ? globalConfig.tiers[planTier] : undefined;
  const model = tierConfig?.model;

  console.log(`\n[${project.name}] Generating plan...\n`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${planTier} tier)`);
  console.log(`  Mode: single Lead session (no teammates)`);

  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch single Lead session:");
    console.log("    Reads: design.md, design-meta.json, features.json");
    console.log("    Produces: plan.json (task DAG) + plan.md (narrative)");
    console.log(`\n  Estimated cost: ~$0.10-0.30`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const planDir = join(targetPath, ".proteus-forge", "03-plan");
  await mkdir(planDir, { recursive: true });

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
    onMessage: (msg) => dashboard.onMessage(msg),
  });
  dashboard.cleanup();

  const planJsonPath = join(planDir, "plan.json");
  const planJsonExists = existsSync(planJsonPath);

  let taskCount = 0;
  let waveCount = 0;
  if (planJsonExists) {
    try {
      const planData = JSON.parse(await readFile(planJsonPath, "utf-8"));
      taskCount = planData.tasks?.length ?? 0;
      waveCount = planData.executionWaves?.length ?? 0;
    } catch { /* empty */ }
  }

  if ((result.success || planJsonExists) && planJsonExists) {
    const label = result.success ? "Plan complete" : "Plan recovered";
    console.log(`\n[${project.name}] ${label}.\n`);
    if (taskCount > 0) console.log(`  ${taskCount} tasks across ${waveCount} waves`);
    console.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: plan complete" : "proteus-forge: plan complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "plan", result.cost);
    await appendLogEntry(targetPath, {
      action: "plan",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });

    console.log(`\n  Review: proteus-forge review plan\n`);
    return true;
  }

  console.error(`\n[${project.name}] Plan failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
  }

  await appendLogEntry(targetPath, {
    action: "plan",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; "),
  });

  return false;
}

export const planCommand = new Command("plan")
  .description("Generate a task DAG with execution waves from the design")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number }) => {
    const success = await runPlan(name, options);
    if (!success) process.exit(1);
  });
