import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProgressReporter } from "@proteus-forge/shared";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generatePlanLeadPrompt } from "../prompts/plan.js";
import { resolveModel } from "../utils/model-resolution.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { updateProject } from "../config/registry.js";
import { checkStaleness } from "../utils/stages.js";
import { createDashboard } from "../utils/progress.js";
import { terminalReporter } from "../utils/terminal-reporter.js";

export async function runPlan(
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

  const designMdPath = join(targetPath, ".proteus-forge", "02-design", "design.md");
  const designMetaPath = join(targetPath, ".proteus-forge", "02-design", "design-meta.json");
  if (!existsSync(designMdPath) && !existsSync(designMetaPath)) {
    reporter.error("Design stage not complete. Run `proteus-forge design` first.");
    return false;
  }

  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "plan") {
      reporter.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
    }
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  const model = resolveModel(globalConfig, "plan-generator", { tier: options.tier, model: options.model });

  reporter.log(`\n[${project.name}] Generating plan...\n`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  reporter.log(`  Mode: single Lead session (no teammates)`);

  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch single Lead session:");
    reporter.log("    Reads: design.md, design-meta.json, features.json");
    reporter.log("    Produces: plan.json (task DAG) + plan.md (narrative)");
    reporter.log(`\n  Estimated cost: ~$0.10-0.30`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const planDir = join(targetPath, ".proteus-forge", "03-plan");
  await mkdir(planDir, { recursive: true });

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
    onMessage: onMessage ?? ((msg) => dashboard!.onMessage(msg)),
  });
  if (dashboard) dashboard.cleanup();

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
    reporter.log(`\n[${project.name}] ${label}.\n`);
    if (taskCount > 0) reporter.log(`  ${taskCount} tasks across ${waveCount} waves`);
    reporter.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: plan complete" : "proteus-forge: plan complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "plan", result.cost);
    await appendLogEntry(targetPath, {
      action: "plan",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });
    await updateProject(project.name, { lastCompletedStage: "plan" });

    reporter.log(`\n  Output: ${join(planDir, "plan.md")}`);
    reporter.log(`          ${planJsonPath}`);
    reporter.log(`  Review: proteus-forge review plan`);
    reporter.log(`  Next:   proteus-forge split\n`);
    return true;
  }

  reporter.error(`\n[${project.name}] Plan failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
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
  .option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)")
  .option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)")
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number; tier?: string; model?: string }) => {
    const success = await runPlan(name, options);
    if (!success) process.exit(1);
  });
