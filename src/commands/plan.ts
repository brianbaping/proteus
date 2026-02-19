import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generatePlanLeadPrompt } from "../prompts/plan.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { checkStaleness } from "../utils/stages.js";

export const planCommand = new Command("plan")
  .description("Generate a task DAG with execution waves from the design")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .action(
    async (
      name: string | undefined,
      options: { dryRun?: boolean; budget?: number }
    ) => {
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

      // Check prerequisite: design must be complete
      const designMdPath = join(targetPath, ".proteus", "02-design", "design.md");
      const designMetaPath = join(targetPath, ".proteus", "02-design", "design-meta.json");
      if (!existsSync(designMdPath) && !existsSync(designMetaPath)) {
        console.error("Design stage not complete. Run `proteus design` first.");
        process.exit(1);
      }

      // Check staleness
      const warnings = checkStaleness(targetPath);
      for (const w of warnings) {
        if (w.stage === "plan") {
          console.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
        }
      }

      const globalConfig = await readGlobalConfig();
      if (!globalConfig) {
        console.error("Global config not found. Run `proteus setup` first.");
        process.exit(1);
      }

      // Resolve model — plan uses plan-generator role
      const planRole = globalConfig.roles["plan-generator"];
      const planTier = typeof planRole === "string" ? planRole : undefined;
      const tierConfig = planTier ? globalConfig.tiers[planTier] : undefined;
      const model = tierConfig?.model;

      console.log(`\n[${project.name}] Generating plan...\n`);
      console.log(`  Source: ${sourcePath}`);
      console.log(`  Target: ${targetPath}`);
      if (model) {
        console.log(`  Model: ${model} (${planTier} tier)`);
      }
      console.log(`  Mode: single Lead session (no teammates)`);

      if (options.dryRun) {
        console.log("\n  [Dry run] Would launch single Lead session:");
        console.log("    Reads: design.md, design-meta.json, features.json");
        console.log("    Produces: plan.json (task DAG) + plan.md (narrative)");
        console.log(`\n  Estimated cost: ~$0.10-0.30`);
        console.log("  Run without --dry-run to proceed.\n");
        return;
      }

      // Ensure output directory
      const planDir = join(targetPath, ".proteus", "03-plan");
      await mkdir(planDir, { recursive: true });

      const leadPrompt = generatePlanLeadPrompt(sourcePath, targetPath);

      console.log("\n  Launching session...\n");

      const result = await launchSession({
        prompt: leadPrompt,
        cwd: targetPath,
        additionalDirectories: [sourcePath],
        model,
        maxBudgetUsd: options.budget,
        permissionMode: "acceptEdits",
        onMessage: (message) => {
          if (message.type === "assistant" && "message" in message) {
            const content = message.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if ("text" in block && typeof block.text === "string") {
                  const text = block.text.trim();
                  if (text.length > 0 && text.length < 200) {
                    process.stdout.write(`  ${text}\n`);
                  }
                }
              }
            }
          }
        },
      });

      // Check results
      const planJsonPath = join(planDir, "plan.json");
      const planMdPath = join(planDir, "plan.md");
      const planJsonExists = existsSync(planJsonPath);
      const planMdExists = existsSync(planMdPath);
      const hasOutput = planJsonExists || planMdExists;

      // Read task/wave counts for display
      let taskCount = 0;
      let waveCount = 0;
      if (planJsonExists) {
        try {
          const { readFile } = await import("node:fs/promises");
          const planData = JSON.parse(await readFile(planJsonPath, "utf-8"));
          taskCount = planData.tasks?.length ?? 0;
          waveCount = planData.executionWaves?.length ?? 0;
        } catch {
          // Non-critical
        }
      }

      if ((result.success || hasOutput) && planJsonExists) {
        const label = result.success ? "Plan complete" : "Plan recovered (session error, but artifacts produced)";
        console.log(`\n[${project.name}] ${label}.\n`);

        if (taskCount > 0) {
          console.log(`  ${taskCount} tasks across ${waveCount} waves`);
        }
        console.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
        console.log(`  Duration: ${result.cost.duration}`);

        try {
          const commitMsg = result.success
            ? "proteus: plan complete"
            : "proteus: plan complete (recovered)";
          await gitStageAndCommit(targetPath, commitMsg);
          console.log(`  Committed: "${commitMsg}"`);
        } catch {
          // Git commit may fail if nothing to commit
        }

        await appendCostEntry(targetPath, "plan", result.cost);
        await appendLogEntry(targetPath, {
          action: "plan",
          status: result.success ? "success" : "recovered",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
        });

        console.log(`\n  Output:`);
        if (planJsonExists) console.log(`    ${planJsonPath}`);
        if (planMdExists) console.log(`    ${planMdPath}  \u2190 review and edit this`);
        console.log(`\n  Review: proteus review plan\n`);
      } else {
        console.error(`\n[${project.name}] Plan failed.\n`);
        if (result.errors && result.errors.length > 0) {
          for (const err of result.errors) {
            console.error(`  Error: ${err}`);
          }
        }
        if (!hasOutput) {
          console.error("  plan.json / plan.md not produced.");
        }

        await appendLogEntry(targetPath, {
          action: "plan",
          status: "failed",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
          details: result.errors?.join("; "),
        });

        process.exit(1);
      }
    }
  );
