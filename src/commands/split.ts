import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generateSplitLeadPrompt } from "../prompts/split.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { checkStaleness } from "../utils/stages.js";
import { logProgress } from "../utils/progress.js";

interface TrackManifest {
  tracks: Array<{ id: string; discipline: string; taskCount: number }>;
}

export async function runSplit(
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

  const targetPath = project.entry.target;

  const planJsonPath = join(targetPath, ".proteus", "03-plan", "plan.json");
  if (!existsSync(planJsonPath)) {
    console.error("Plan stage not complete. Run `proteus plan` first.");
    return false;
  }

  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "split") {
      console.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
    }
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus setup` first.");
    return false;
  }

  const planRole = globalConfig.roles["plan-generator"];
  const planTier = typeof planRole === "string" ? planRole : undefined;
  const tierConfig = planTier ? globalConfig.tiers[planTier] : undefined;
  const model = tierConfig?.model;

  console.log(`\n[${project.name}] Splitting into tracks...\n`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${planTier} tier)`);
  console.log(`  Mode: single Lead session (no teammates)`);

  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch single Lead session:");
    console.log("    Reads: plan.json, design-meta.json");
    console.log("    Produces: manifest.json + per-discipline track files");
    console.log(`\n  Estimated cost: ~$0.05-0.15`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const tracksDir = join(targetPath, ".proteus", "04-tracks");
  await mkdir(tracksDir, { recursive: true });

  const leadPrompt = generateSplitLeadPrompt(targetPath);
  console.log("\n  Launching session...\n");

  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: logProgress,
  });

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
    console.log(`\n[${project.name}] ${label}.\n`);
    for (const t of tracks) {
      console.log(`  ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   (${t.discipline})`);
    }
    console.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus: split complete" : "proteus: split complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "split", result.cost);
    await appendLogEntry(targetPath, {
      action: "split",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });

    console.log(`\n  Next: proteus execute\n`);
    return true;
  }

  console.error(`\n[${project.name}] Split failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
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
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number }) => {
    const success = await runSplit(name, options);
    if (!success) process.exit(1);
  });
