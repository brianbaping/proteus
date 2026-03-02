import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { runVerification, printVerifyResult } from "../utils/verify.js";
import { appendLogEntry } from "../utils/log.js";
import { readGlobalConfig } from "../config/global.js";
import { resolveModel } from "../utils/model-resolution.js";
import { launchSession } from "../session/launcher.js";
import { appendCostEntry } from "../utils/costs.js";
import { createDashboard } from "../utils/progress.js";
import { generateVerifyFixPrompt } from "../prompts/verify-fix.js";

export interface VerifyOptions {
  verbose?: boolean;
  skipInstall?: boolean;
  fix?: boolean;
  tier?: string;
  model?: string;
  budget?: number;
}

export async function runVerify(
  name: string | undefined,
  options: VerifyOptions
): Promise<boolean> {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error((err as Error).message);
    return false;
  }

  const targetPath = project.entry.target;
  const pkgPath = join(targetPath, "package.json");

  if (!existsSync(pkgPath)) {
    console.error(
      `No package.json found in ${targetPath}. Verify requires a Node.js project with a package.json.`
    );
    return false;
  }

  console.log(`\n[${project.name}] Running verification...\n`);
  console.log(`  Target: ${targetPath}`);

  const result = await runVerification(targetPath, {
    skipInstall: options.skipInstall,
    verbose: options.verbose,
  });

  printVerifyResult(result, options.verbose);

  const stepSummary = result.steps
    .map((s) => `${s.name}:${s.skipped ? "skipped" : s.passed ? "passed" : "failed"}`)
    .join(", ");

  await appendLogEntry(targetPath, {
    action: "verify",
    status: result.allPassed ? "success" : "failed",
    details: stepSummary,
  });

  if (result.allPassed || !options.fix) {
    return result.allPassed;
  }

  // --fix flow: launch agent to fix failures, then re-verify
  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  const model = resolveModel(globalConfig, "verify-fix", {
    tier: options.tier,
    model: options.model,
  });

  const fixPrompt = generateVerifyFixPrompt(
    targetPath,
    result.steps,
    result.packageManager
  );

  console.log(`\n[${project.name}] Launching fix session...\n`);
  if (model) console.log(`  Model: ${model}`);

  const dashboard = createDashboard("verify-fix");
  const fixResult = await launchSession({
    prompt: fixPrompt,
    cwd: targetPath,
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: (msg) => dashboard.onMessage(msg),
  });
  dashboard.cleanup();

  await appendCostEntry(targetPath, "verify-fix", fixResult.cost);
  await appendLogEntry(targetPath, {
    action: "verify-fix",
    status: fixResult.success ? "success" : "failed",
    duration: fixResult.cost.duration,
    cost: fixResult.cost.estimatedCost,
  });

  if (!fixResult.success) {
    console.error(`\n[${project.name}] Fix session failed.`);
    if (fixResult.errors?.length) {
      for (const err of fixResult.errors) console.error(`  Error: ${err}`);
    }
    return false;
  }

  // Re-verify after fix
  console.log(`\n[${project.name}] Re-running verification...\n`);

  const reVerifyResult = await runVerification(targetPath, {
    skipInstall: options.skipInstall,
    verbose: options.verbose,
  });

  printVerifyResult(reVerifyResult, options.verbose);

  const reStepSummary = reVerifyResult.steps
    .map((s) => `${s.name}:${s.skipped ? "skipped" : s.passed ? "passed" : "failed"}`)
    .join(", ");

  await appendLogEntry(targetPath, {
    action: "verify",
    status: reVerifyResult.allPassed ? "success" : "failed",
    details: `post-fix: ${reStepSummary}`,
  });

  return reVerifyResult.allPassed;
}

export const verifyCommand = new Command("verify")
  .description("Run install/build/test/lint verification on the target repo")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--verbose", "Show full output from failed steps")
  .option("--skip-install", "Skip the install step")
  .option("--fix", "Launch a Claude Code session to fix failures")
  .option("--tier <tier>", "Override model tier for fix session (fast, standard, advanced)")
  .option("--model <model>", "Override model for fix session (e.g., claude-sonnet-4-6)")
  .option("--budget <amount>", "Maximum budget in USD for fix session", parseFloat)
  .action(
    async (
      name: string | undefined,
      options: VerifyOptions
    ) => {
      const success = await runVerify(name, options);
      if (!success) process.exit(1);
    }
  );
