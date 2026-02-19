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
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { checkStaleness } from "../utils/stages.js";

export const executeCommand = new Command("execute")
  .description("Build production code using coordinated agent teams")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option(
    "--budget <amount>",
    "Maximum budget in USD for this stage",
    parseFloat
  )
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

      // Check prerequisite: split must be complete
      const manifestPath = join(
        targetPath,
        ".proteus",
        "04-tracks",
        "manifest.json"
      );
      if (!existsSync(manifestPath)) {
        console.error(
          "Split stage not complete. Run `proteus split` first."
        );
        process.exit(1);
      }

      // Check staleness
      const warnings = checkStaleness(targetPath);
      for (const w of warnings) {
        if (w.stage === "execute") {
          console.log(
            `  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`
          );
        }
      }

      const globalConfig = await readGlobalConfig();
      if (!globalConfig) {
        console.error("Global config not found. Run `proteus setup` first.");
        process.exit(1);
      }

      // Load track and plan context
      let ctx;
      try {
        ctx = await loadExecuteContext(targetPath);
      } catch (err) {
        console.error(
          `Failed to load execute context: ${(err as Error).message}`
        );
        process.exit(1);
      }

      // Resolve model — execute uses execute-agent role (advanced tier)
      const execRole = globalConfig.roles["execute-agent"];
      const execTier = typeof execRole === "string" ? execRole : undefined;
      const tierConfig = execTier ? globalConfig.tiers[execTier] : undefined;
      const model = tierConfig?.model;

      const nonSharedTracks = ctx.tracks.filter(
        (t) => t.discipline !== "shared"
      );

      console.log(`\n[${project.name}] Executing production build...\n`);
      console.log(`  Source: ${sourcePath}`);
      console.log(`  Target: ${targetPath}`);
      if (model) {
        console.log(`  Model: ${model} (${execTier} tier)`);
      }
      console.log(
        `  Tasks: ${ctx.tasks.length} across ${ctx.waveCount} waves`
      );
      console.log(`  Teammates: ${nonSharedTracks.length}`);

      // Show tracks
      console.log("");
      for (const t of ctx.tracks) {
        const marker = t.discipline === "shared" ? "(Lead)" : "";
        console.log(
          `    ${t.id.padEnd(20)} ${String(t.taskCount).padStart(2)} tasks   ${marker}`
        );
      }

      if (options.dryRun) {
        console.log("\n  [Dry run] Would launch Agent Team:");
        console.log("    Lead: orchestrator (handles shared tasks, coordinates)");
        for (const t of nonSharedTracks) {
          console.log(
            `    Teammate: ${t.id.replace("track-", "")}-engineer (${t.taskCount} tasks)`
          );
        }
        console.log(
          `\n  Estimated cost: depends on task complexity (typically $5-15)`
        );
        console.log("  Run without --dry-run to proceed.\n");
        return;
      }

      // Ensure output directory
      const executeDir = join(targetPath, ".proteus", "05-execute");
      await mkdir(executeDir, { recursive: true });

      // Generate the Lead prompt
      const leadPrompt = generateExecuteLeadPrompt(
        sourcePath,
        targetPath,
        ctx
      );

      console.log("\n  Launching Agent Team...\n");

      // Set up inbox for `proteus inform` messages
      const inboxDir = join(targetPath, ".proteus", "05-execute", "inbox");
      await mkdir(inboxDir, { recursive: true });
      console.log(`  Inbox active — send messages with: proteus inform <agent> "<message>"\n`);

      const result = await launchSession({
        prompt: leadPrompt,
        cwd: targetPath,
        additionalDirectories: [sourcePath],
        model,
        maxBudgetUsd: options.budget,
        permissionMode: "acceptEdits",
        inboxDir,
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

      // Check results — look for session.json or any source files created
      const sessionJsonPath = join(executeDir, "session.json");
      const sessionExists = existsSync(sessionJsonPath);

      // Also check if any source files were generated (best-effort)
      const srcDir = join(targetPath, "src");
      const serverDir = join(targetPath, "server");
      const hasSourceFiles = existsSync(srcDir) || existsSync(serverDir);
      const hasOutput = sessionExists || hasSourceFiles;

      // Display agent team
      const printTeam = () => {
        console.log(
          `\n  Agent Team (${nonSharedTracks.length} teammates):`
        );
        for (const t of nonSharedTracks) {
          console.log(
            `    \u2022 ${(t.id.replace("track-", "") + "-engineer").padEnd(28)} ${t.discipline}`
          );
        }
      };

      if ((result.success || hasOutput) && hasOutput) {
        const label = result.success
          ? "Execution complete"
          : "Execution recovered (session error, but code was produced)";
        console.log(`\n[${project.name}] ${label}.\n`);
        printTeam();
        console.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
        console.log(`  Duration: ${result.cost.duration}`);

        // Git checkpoint
        try {
          const commitMsg = result.success
            ? "proteus: execute complete"
            : "proteus: execute complete (recovered)";
          await gitStageAndCommit(targetPath, commitMsg);
          console.log(`  Committed: "${commitMsg}"`);
        } catch {
          // Git commit may fail
        }

        await appendCostEntry(targetPath, "execute", {
          ...result.cost,
          teammates: nonSharedTracks.length,
        });
        await appendLogEntry(targetPath, {
          action: "execute",
          status: result.success ? "success" : "recovered",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
          teammates: nonSharedTracks.length,
        });

        console.log(`\n  Production code: ${targetPath}/`);
        console.log(`  Run \`proteus status\` for full summary.\n`);
      } else {
        console.error(`\n[${project.name}] Execution failed.\n`);
        if (result.errors && result.errors.length > 0) {
          for (const err of result.errors) {
            console.error(`  Error: ${err}`);
          }
        }
        if (!hasOutput) {
          console.error(
            "  No source files or session.json produced."
          );
        }

        // Still commit any partial progress
        try {
          await gitStageAndCommit(
            targetPath,
            "proteus: execute partial (failed)"
          );
          console.error(
            "  Partial progress committed. Re-run `proteus execute` to retry."
          );
        } catch {
          // Nothing to commit
        }

        await appendLogEntry(targetPath, {
          action: "execute",
          status: "failed",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
          details: result.errors?.join("; "),
        });

        process.exit(1);
      }
    }
  );
