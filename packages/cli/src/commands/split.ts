import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProgressReporter } from "@proteus-forge/shared";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generateSplitLeadPrompt } from "../prompts/split.js";
import { resolveModel } from "../utils/model-resolution.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { updateProject } from "../config/registry.js";
import { checkStaleness } from "../utils/stages.js";
import { createDashboard } from "../utils/progress.js";
import { terminalReporter } from "../utils/terminal-reporter.js";

interface TrackManifest {
  tracks: Array<{ id: string; discipline: string; taskCount: number }>;
}

export async function runSplit(
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

  const targetPath = project.entry.target;

  const planJsonPath = join(targetPath, ".proteus-forge", "03-plan", "plan.json");
  if (!existsSync(planJsonPath)) {
    reporter.error("Plan stage not complete. Run `proteus-forge plan` first.");
    return false;
  }

  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "split") {
      reporter.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
    }
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  const model = resolveModel(globalConfig, "plan-generator", { tier: options.tier, model: options.model });

  reporter.log(`\n[${project.name}] Splitting into tracks...\n`);
  reporter.log(`  Source: ${project.entry.source}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  reporter.log(`  Mode: single Lead session (no teammates)`);

  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch single Lead session:");
    reporter.log("    Reads: plan.json, design-meta.json");
    reporter.log("    Produces: manifest.json + per-discipline track files");
    reporter.log(`\n  Estimated cost: ~$0.05-0.15`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const tracksDir = join(targetPath, ".proteus-forge", "04-tracks");
  await mkdir(tracksDir, { recursive: true });

  const leadPrompt = generateSplitLeadPrompt(targetPath);
  reporter.log("\n  Launching session...\n");

  const dashboard = onMessage ? null : createDashboard("split");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: onMessage ?? ((msg) => dashboard!.onMessage(msg)),
  });
  if (dashboard) dashboard.cleanup();

  const manifestPath = join(tracksDir, "manifest.json");
  const manifestExists = existsSync(manifestPath);

  let tracks: TrackManifest["tracks"] = [];
  if (manifestExists) {
    try {
      const data = JSON.parse(await readFile(manifestPath, "utf-8")) as TrackManifest;
      tracks = data.tracks ?? [];
    } catch { /* empty */ }
  }

  if ((result.success || manifestExists) && manifestExists) {
    const label = result.success ? "Split complete" : "Split recovered";
    reporter.log(`\n[${project.name}] ${label}.\n`);
    for (const t of tracks) {
      reporter.log(`  ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   (${t.discipline})`);
    }
    reporter.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: split complete" : "proteus-forge: split complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "split", result.cost);
    await appendLogEntry(targetPath, {
      action: "split",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });
    await updateProject(name, { lastCompletedStage: "split" });

    reporter.log(`\n  Output: ${join(tracksDir, "split.md")}`);
    reporter.log(`          ${manifestPath}`);
    reporter.log(`  Review: proteus-forge review split`);
    reporter.log(`  Next:   proteus-forge execute\n`);
    return true;
  }

  reporter.error(`\n[${project.name}] Split failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
  }

  await appendLogEntry(targetPath, {
    action: "split",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; "),
  });

  return false;
}

export const splitCommand = new Command("split")
  .description("Partition the plan into discipline-specific tracks")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)")
  .option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)")
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number; tier?: string; model?: string }) => {
    const success = await runSplit(name, options);
    if (!success) process.exit(1);
  });
