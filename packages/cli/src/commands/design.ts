import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProgressReporter } from "@proteus-forge/shared";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generateDesignLeadPrompt } from "../prompts/design.js";
import { resolveModel } from "../utils/model-resolution.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { updateProject } from "../config/registry.js";
import { checkStaleness } from "../utils/stages.js";
import { printDesignTeamSummary } from "../utils/team-summary.js";
import { createDashboard } from "../utils/progress.js";
import { terminalReporter } from "../utils/terminal-reporter.js";

export async function runDesign(
  name: string | undefined,
  options: { dryRun?: boolean; budget?: number; brief?: string; briefFile?: string; tier?: string; model?: string },
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

  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "design") {
      reporter.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
    }
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  const model = resolveModel(globalConfig, "design", { tier: options.tier, model: options.model });

  reporter.log(`\n[${project.name}] Designing production architecture...\n`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);

  let brief: string | undefined;
  if (options.briefFile) {
    const briefPath = resolve(options.briefFile);
    if (!existsSync(briefPath)) {
      reporter.error(`Brief file not found: ${briefPath}`);
      return false;
    }
    brief = await readFile(briefPath, "utf-8");
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
    reporter.log(`\n  Estimated cost: depends on feature count and complexity`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const designDir = join(targetPath, ".proteus-forge", "02-design");
  await mkdir(join(designDir, "partials"), { recursive: true });

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
    onMessage: onMessage ?? ((msg) => dashboard!.onMessage(msg)),
  });
  if (dashboard) dashboard.cleanup();

  const hasOutput = existsSync(join(designDir, "design.md")) || existsSync(join(designDir, "design-meta.json"));

  if ((result.success || hasOutput) && hasOutput) {
    const label = result.success ? "Design complete" : "Design recovered";
    reporter.log(`\n[${project.name}] ${label}.\n`);
    await printDesignTeamSummary(targetPath);
    reporter.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: design complete" : "proteus-forge: design complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "design", result.cost);
    await appendLogEntry(targetPath, {
      action: "design",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });
    await updateProject(project.name, { lastCompletedStage: "design" });

    reporter.log(`\n  Output: ${join(designDir, "design.md")}`);
    reporter.log(`          ${join(designDir, "design-meta.json")}`);
    reporter.log(`  Review: proteus-forge review design`);
    reporter.log(`  Next:   proteus-forge plan\n`);
    return true;
  }

  reporter.error(`\n[${project.name}] Design failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }

  await appendLogEntry(targetPath, {
    action: "design",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; "),
  });

  return false;
}

export const designCommand = new Command("design")
  .description("Design the production architecture based on inspection findings")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .option("--brief <text>", "Architectural requirements (e.g., 'Use microservices with Go and gRPC')")
  .option("--brief-file <path>", "Path to a file containing architectural requirements")
  .option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)")
  .option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)")
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number; brief?: string; briefFile?: string; tier?: string; model?: string }) => {
    const success = await runDesign(name, options);
    if (!success) process.exit(1);
  });
