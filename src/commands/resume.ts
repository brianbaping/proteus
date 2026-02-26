import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import {
  loadExecuteContext,
  generateExecuteLeadPrompt,
} from "../prompts/execute.js";
import { launchSession } from "../session/launcher.js";
import { getLastWaveCheckpoint } from "../utils/git.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { createDashboard } from "../utils/progress.js";

export const resumeCommand = new Command("resume")
  .description("Resume execute from the last wave checkpoint")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--budget <amount>", "Maximum budget in USD", parseFloat)
  .action(async (name: string | undefined, options: { budget?: number }) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const { entry } = project;
    const sourcePath = entry.source;
    const targetPath = entry.target;

    // Check prerequisite
    const manifestPath = join(targetPath, ".proteus-forge", "04-tracks", "manifest.json");
    if (!existsSync(manifestPath)) {
      console.error("Split stage not complete. Run the full pipeline first.");
      process.exit(1);
    }

    // Find last wave checkpoint
    const lastWave = await getLastWaveCheckpoint(targetPath);

    if (lastWave === null) {
      console.error("No wave checkpoints found. Run `proteus-forge execute` instead.");
      process.exit(1);
    }

    console.log(`\n[${project.name}] Resuming execute from wave ${lastWave + 1}...\n`);
    console.log(`  Last completed wave: ${lastWave}`);
    console.log(`  Source: ${sourcePath}`);
    console.log(`  Target: ${targetPath}`);

    const globalConfig = await readGlobalConfig();
    if (!globalConfig) {
      console.error("Global config not found. Run `proteus-forge setup` first.");
      process.exit(1);
    }

    const execRole = globalConfig.roles["execute-agent"];
    const execTier = typeof execRole === "string" ? execRole : undefined;
    const tierConfig = execTier ? globalConfig.tiers[execTier] : undefined;
    const model = tierConfig?.model;

    let ctx;
    try {
      ctx = await loadExecuteContext(targetPath);
    } catch (err) {
      console.error(`Failed to load context: ${(err as Error).message}`);
      process.exit(1);
    }

    // Modify the prompt to indicate resumption
    const basePrompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    const resumePrompt = `${basePrompt}

## IMPORTANT: RESUMING FROM WAVE ${lastWave + 1}

This is a RESUME. Waves 1 through ${lastWave} have already been completed.
The code from those waves already exists in the target directory.

DO NOT re-do work from waves 1-${lastWave}. Start from wave ${lastWave + 1}.
Check what files already exist before creating new ones.`;

    const executeDir = join(targetPath, ".proteus-forge", "05-execute");
    const inboxDir = join(executeDir, "inbox");
    await mkdir(inboxDir, { recursive: true });

    console.log("\n  Launching Agent Team...\n");

    const dashboard = createDashboard("resume");
    const result = await launchSession({
      prompt: resumePrompt,
      cwd: targetPath,
      additionalDirectories: [sourcePath],
      model,
      maxBudgetUsd: options.budget,
      permissionMode: "acceptEdits",
      inboxDir,
      onMessage: (msg) => dashboard.onMessage(msg),
    });
    dashboard.cleanup();

    const hasOutput =
      existsSync(join(targetPath, "src")) ||
      existsSync(join(targetPath, "server"));

    if ((result.success || hasOutput) && hasOutput) {
      console.log(`\n[${project.name}] Resume complete.\n`);
      console.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
      console.log(`  Duration: ${result.cost.duration}`);

      try {
        await gitStageAndCommit(targetPath, "proteus-forge: execute resumed and completed");
        console.log(`  Committed: "proteus-forge: execute resumed and completed"`);
      } catch {
        // Nothing to commit
      }

      await appendCostEntry(targetPath, "execute-resume", result.cost);
      await appendLogEntry(targetPath, {
        action: "resume",
        status: result.success ? "success" : "recovered",
        duration: result.cost.duration,
        cost: result.cost.estimatedCost,
        details: `Resumed from wave ${lastWave + 1}`,
      });

      console.log(`\n  Production code: ${targetPath}/\n`);
    } else {
      console.error(`\n[${project.name}] Resume failed.\n`);
      if (result.errors?.length) {
        for (const err of result.errors) {
          console.error(`  Error: ${err}`);
        }
      }

      await appendLogEntry(targetPath, {
        action: "resume",
        status: "failed",
        duration: result.cost.duration,
        cost: result.cost.estimatedCost,
        details: result.errors?.join("; "),
      });

      process.exit(1);
    }
  });
