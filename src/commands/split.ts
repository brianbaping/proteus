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

interface TrackManifest {
  tracks: Array<{
    id: string;
    discipline: string;
    taskCount: number;
  }>;
}

export const splitCommand = new Command("split")
  .description("Partition the plan into discipline-specific tracks")
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
      const targetPath = entry.target;

      // Check prerequisite: plan must be complete
      const planJsonPath = join(targetPath, ".proteus", "03-plan", "plan.json");
      if (!existsSync(planJsonPath)) {
        console.error("Plan stage not complete. Run `proteus plan` first.");
        process.exit(1);
      }

      // Check staleness
      const warnings = checkStaleness(targetPath);
      for (const w of warnings) {
        if (w.stage === "split") {
          console.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
        }
      }

      const globalConfig = await readGlobalConfig();
      if (!globalConfig) {
        console.error("Global config not found. Run `proteus setup` first.");
        process.exit(1);
      }

      // Split uses the plan-generator tier (same mechanical transform level)
      const planRole = globalConfig.roles["plan-generator"];
      const planTier = typeof planRole === "string" ? planRole : undefined;
      const tierConfig = planTier ? globalConfig.tiers[planTier] : undefined;
      const model = tierConfig?.model;

      console.log(`\n[${project.name}] Splitting into tracks...\n`);
      console.log(`  Target: ${targetPath}`);
      if (model) {
        console.log(`  Model: ${model} (${planTier} tier)`);
      }
      console.log(`  Mode: single Lead session (no teammates)`);

      if (options.dryRun) {
        console.log("\n  [Dry run] Would launch single Lead session:");
        console.log("    Reads: plan.json, design-meta.json");
        console.log("    Produces: manifest.json + per-discipline track files");
        console.log(`\n  Estimated cost: ~$0.05-0.15`);
        console.log("  Run without --dry-run to proceed.\n");
        return;
      }

      // Ensure output directory
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
      const manifestPath = join(tracksDir, "manifest.json");
      const manifestExists = existsSync(manifestPath);

      // Read track summary for display
      let tracks: TrackManifest["tracks"] = [];
      if (manifestExists) {
        try {
          const manifestData = JSON.parse(
            await readFile(manifestPath, "utf-8")
          ) as TrackManifest;
          tracks = manifestData.tracks ?? [];
        } catch {
          // Non-critical
        }
      }

      if ((result.success || manifestExists) && manifestExists) {
        const label = result.success
          ? "Split complete"
          : "Split recovered (session error, but artifacts produced)";
        console.log(`\n[${project.name}] ${label}.\n`);

        if (tracks.length > 0) {
          for (const t of tracks) {
            console.log(
              `  ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   (${t.discipline})`
            );
          }
        }

        console.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
        console.log(`  Duration: ${result.cost.duration}`);

        try {
          const commitMsg = result.success
            ? "proteus: split complete"
            : "proteus: split complete (recovered)";
          await gitStageAndCommit(targetPath, commitMsg);
          console.log(`  Committed: "${commitMsg}"`);
        } catch {
          // Git commit may fail
        }

        await appendCostEntry(targetPath, "split", result.cost);
        await appendLogEntry(targetPath, {
          action: "split",
          status: result.success ? "success" : "recovered",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
        });

        console.log(`\n  Output: ${tracksDir}/`);
        console.log(`  Next: proteus execute\n`);
      } else {
        console.error(`\n[${project.name}] Split failed.\n`);
        if (result.errors && result.errors.length > 0) {
          for (const err of result.errors) {
            console.error(`  Error: ${err}`);
          }
        }
        if (!manifestExists) {
          console.error("  manifest.json not produced.");
        }

        await appendLogEntry(targetPath, {
          action: "split",
          status: "failed",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
          details: result.errors?.join("; "),
        });

        process.exit(1);
      }
    }
  );
