import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProgressReporter } from "@proteus-forge/shared";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { loadExecuteContext, generateExecuteLeadPrompt } from "../prompts/execute.js";
import { resolveModel } from "../utils/model-resolution.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { updateProject } from "../config/registry.js";
import { checkStaleness } from "../utils/stages.js";
import { createDashboard } from "../utils/progress.js";
import { terminalReporter } from "../utils/terminal-reporter.js";
import { runVerification, printVerifyResult } from "../utils/verify.js";
import { scaffoldClaudeCommands } from "../utils/scaffold-commands.js";

export async function runExecute(
  name: string | undefined,
  options: { dryRun?: boolean; budget?: number; tier?: string; model?: string; skipVerify?: boolean },
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

  const manifestPath = join(targetPath, ".proteus-forge", "04-tracks", "manifest.json");
  if (!existsSync(manifestPath)) {
    reporter.error("Split stage not complete. Run `proteus-forge split` first.");
    return false;
  }

  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "execute") {
      reporter.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
    }
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    reporter.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  let ctx;
  try {
    ctx = await loadExecuteContext(targetPath);
  } catch (err) {
    reporter.error(`Failed to load execute context: ${(err as Error).message}`);
    return false;
  }

  const model = resolveModel(globalConfig, "execute-agent", { tier: options.tier, model: options.model });

  const nonSharedTracks = ctx.tracks.filter((t) => t.discipline !== "shared");

  reporter.log(`\n[${project.name}] Executing production build...\n`);
  reporter.log(`  Source: ${sourcePath}`);
  reporter.log(`  Target: ${targetPath}`);
  if (model) reporter.log(`  Model: ${model}`);
  reporter.log(`  Tasks: ${ctx.tasks.length} across ${ctx.waveCount} waves`);
  reporter.log(`  Teammates: ${nonSharedTracks.length}\n`);
  for (const t of ctx.tracks) {
    const marker = t.discipline === "shared" ? "(Lead)" : "";
    reporter.log(`    ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   ${marker}`);
  }

  if (options.dryRun) {
    reporter.log("\n  [Dry run] Would launch Agent Team:");
    reporter.log("    Lead: orchestrator (handles shared tasks, coordinates)");
    for (const t of nonSharedTracks) {
      reporter.log(`    Teammate: ${t.id.replace("track-", "")}-engineer (${t.taskCount} tasks)`);
    }
    reporter.log(`\n  Estimated cost: depends on task complexity (typically $5-15)`);
    reporter.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const executeDir = join(targetPath, ".proteus-forge", "05-execute");
  const inboxDir = join(executeDir, "inbox");
  await mkdir(inboxDir, { recursive: true });
  reporter.log(`\n  Inbox active — send messages with: proteus-forge inform <agent> "<message>"\n`);

  const leadPrompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
  reporter.log("  Launching Agent Team...\n");

  const dashboard = onMessage ? null : createDashboard("execute");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    inboxDir,
    onMessage: onMessage ?? ((msg) => dashboard!.onMessage(msg)),
  });
  if (dashboard) dashboard.cleanup();

  const hasOutput = existsSync(join(targetPath, "src")) || existsSync(join(targetPath, "server"));

  if ((result.success || hasOutput) && hasOutput) {
    const label = result.success ? "Execution complete" : "Execution recovered";
    reporter.log(`\n[${project.name}] ${label}.\n`);
    reporter.log(`  Agent Team (${nonSharedTracks.length} teammates):`);
    for (const t of nonSharedTracks) {
      reporter.log(`    \u2022 ${(t.id.replace("track-", "") + "-engineer").padEnd(28)} ${t.discipline}`);
    }
    reporter.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    reporter.log(`  Duration: ${result.cost.duration}`);

    const scaffoldResult = await scaffoldClaudeCommands(targetPath);
    if (scaffoldResult.files.length > 0) {
      reporter.log(`  Scaffolded ${scaffoldResult.files.length} repair commands (.claude/commands/)`);
    }

    try {
      const msg = result.success ? "proteus-forge: execute complete" : "proteus-forge: execute complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      reporter.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    let verifySummary: string | undefined;
    if (!options.skipVerify && existsSync(join(targetPath, "package.json"))) {
      reporter.log("\n  Running post-execute verification...");
      const verifyResult = await runVerification(targetPath);
      printVerifyResult(verifyResult);
      verifySummary = verifyResult.steps
        .map((s) => `${s.name}:${s.skipped ? "skipped" : s.passed ? "passed" : "failed"}`)
        .join(", ");
      if (!verifyResult.allPassed) {
        reporter.log("  Run `proteus-forge verify --verbose` to see full failure output.\n");
      }
    }

    await appendCostEntry(targetPath, "execute", { ...result.cost, teammates: nonSharedTracks.length });
    await appendLogEntry(targetPath, {
      action: "execute",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
      teammates: nonSharedTracks.length,
      details: verifySummary,
    });
    await updateProject(project.name, { lastCompletedStage: "execute" });

    reporter.log(`\n  Output: ${join(executeDir, "execute.md")}`);
    reporter.log(`          ${join(executeDir, "session.json")}`);
    reporter.log(`          ${targetPath}/`);
    reporter.log(`  Review: proteus-forge review execute`);
    reporter.log(`  Compare: proteus-forge compare\n`);
    return true;
  }

  reporter.error(`\n[${project.name}] Execution failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) reporter.error(`  Error: ${err}`);
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
  .option("--tier <tier>", "Override model tier for this run (fast, standard, advanced)")
  .option("--model <model>", "Override model for this run (e.g., claude-sonnet-4-6)")
  .option("--skip-verify", "Skip post-execute verification (install/build/test/lint)")
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number; tier?: string; model?: string; skipVerify?: boolean }) => {
    const success = await runExecute(name, options);
    if (!success) process.exit(1);
  });
