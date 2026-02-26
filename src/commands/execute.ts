import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { loadExecuteContext, generateExecuteLeadPrompt } from "../prompts/execute.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { checkStaleness } from "../utils/stages.js";
import { createDashboard } from "../utils/progress.js";

export async function runExecute(
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

  const manifestPath = join(targetPath, ".proteus-forge", "04-tracks", "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("Split stage not complete. Run `proteus-forge split` first.");
    return false;
  }

  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "execute") {
      console.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
    }
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  let ctx;
  try {
    ctx = await loadExecuteContext(targetPath);
  } catch (err) {
    console.error(`Failed to load execute context: ${(err as Error).message}`);
    return false;
  }

  const execRole = globalConfig.roles["execute-agent"];
  const execTier = typeof execRole === "string" ? execRole : undefined;
  const tierConfig = execTier ? globalConfig.tiers[execTier] : undefined;
  const model = tierConfig?.model;

  const nonSharedTracks = ctx.tracks.filter((t) => t.discipline !== "shared");

  console.log(`\n[${project.name}] Executing production build...\n`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${execTier} tier)`);
  console.log(`  Tasks: ${ctx.tasks.length} across ${ctx.waveCount} waves`);
  console.log(`  Teammates: ${nonSharedTracks.length}\n`);
  for (const t of ctx.tracks) {
    const marker = t.discipline === "shared" ? "(Lead)" : "";
    console.log(`    ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   ${marker}`);
  }

  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch Agent Team:");
    console.log("    Lead: orchestrator (handles shared tasks, coordinates)");
    for (const t of nonSharedTracks) {
      console.log(`    Teammate: ${t.id.replace("track-", "")}-engineer (${t.taskCount} tasks)`);
    }
    console.log(`\n  Estimated cost: depends on task complexity (typically $5-15)`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const executeDir = join(targetPath, ".proteus-forge", "05-execute");
  const inboxDir = join(executeDir, "inbox");
  await mkdir(inboxDir, { recursive: true });
  console.log(`\n  Inbox active — send messages with: proteus-forge inform <agent> "<message>"\n`);

  const leadPrompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
  console.log("  Launching Agent Team...\n");

  const dashboard = createDashboard("execute");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    inboxDir,
    onMessage: (msg) => dashboard.onMessage(msg),
  });
  dashboard.cleanup();

  const hasOutput = existsSync(join(targetPath, "src")) || existsSync(join(targetPath, "server"));

  if ((result.success || hasOutput) && hasOutput) {
    const label = result.success ? "Execution complete" : "Execution recovered";
    console.log(`\n[${project.name}] ${label}.\n`);
    console.log(`  Agent Team (${nonSharedTracks.length} teammates):`);
    for (const t of nonSharedTracks) {
      console.log(`    \u2022 ${(t.id.replace("track-", "") + "-engineer").padEnd(28)} ${t.discipline}`);
    }
    console.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: execute complete" : "proteus-forge: execute complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "execute", { ...result.cost, teammates: nonSharedTracks.length });
    await appendLogEntry(targetPath, {
      action: "execute",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
      teammates: nonSharedTracks.length,
    });

    console.log(`\n  Output: ${join(executeDir, "execute.md")}`);
    console.log(`          ${join(executeDir, "session.json")}`);
    console.log(`          ${targetPath}/`);
    console.log(`  Review: proteus-forge review execute`);
    console.log(`  Compare: proteus-forge compare\n`);
    return true;
  }

  console.error(`\n[${project.name}] Execution failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
  }

  try {
    await gitStageAndCommit(targetPath, "proteus-forge: execute partial (failed)");
  } catch { /* empty */ }

  await appendLogEntry(targetPath, {
    action: "execute",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; "),
  });

  return false;
}

export const executeCommand = new Command("execute")
  .description("Build production code using coordinated agent teams")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number }) => {
    const success = await runExecute(name, options);
    if (!success) process.exit(1);
  });
