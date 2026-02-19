import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { readProjectConfig } from "../config/project.js";
import { generateInspectLeadPrompt } from "../prompts/inspect.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";

export const inspectCommand = new Command("inspect")
  .description("Analyze the source POC and produce a feature inventory")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .action(
    async (
      name: string | undefined,
      options: { dryRun?: boolean; budget?: number }
    ) => {
      // Resolve project
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

      // Validate source exists
      if (!existsSync(sourcePath)) {
        console.error(`Source path not found: ${sourcePath}`);
        process.exit(1);
      }

      // Read configs
      const globalConfig = await readGlobalConfig();
      const _projectConfig = await readProjectConfig(targetPath);

      if (!globalConfig) {
        console.error("Global config not found. Run `proteus setup` first.");
        process.exit(1);
      }

      // Resolve model tier for the scout
      const scoutRole = globalConfig.roles.scout;
      const scoutTier =
        typeof scoutRole === "string" ? scoutRole : undefined;
      const tierConfig = scoutTier ? globalConfig.tiers[scoutTier] : undefined;
      const model = tierConfig?.model;

      console.log(`\n[${project.name}] Inspecting source...\n`);
      console.log(`  Source: ${sourcePath}`);
      console.log(`  Target: ${targetPath}`);
      if (model) {
        console.log(`  Model: ${model} (${scoutTier} tier)`);
      }

      // Dry run mode
      if (options.dryRun) {
        console.log("\n  [Dry run] Would launch Agent Team:");
        console.log("    Lead: scout (analyzes source, identifies domains)");
        console.log(
          "    Teammates: one per discovered domain (spawned dynamically)"
        );
        console.log("    Tasks: one per domain + synthesis");
        console.log(`\n  Estimated cost: depends on source repo size`);
        console.log("  Run without --dry-run to proceed.\n");
        return;
      }

      // Ensure output directories exist
      const inspectDir = join(targetPath, ".proteus", "01-inspect");
      const partialsDir = join(inspectDir, "partials");
      await mkdir(partialsDir, { recursive: true });

      // Generate the Lead prompt
      const leadPrompt = generateInspectLeadPrompt(sourcePath, targetPath);

      console.log("\n  Launching Agent Team...\n");

      // Launch the session
      const result = await launchSession({
        prompt: leadPrompt,
        cwd: targetPath,
        additionalDirectories: [sourcePath],
        model,
        maxBudgetUsd: options.budget,
        permissionMode: "acceptEdits",
        onMessage: (message) => {
          // Log assistant text output for progress visibility
          if (message.type === "assistant" && "message" in message) {
            const content = message.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if ("text" in block && typeof block.text === "string") {
                  // Print meaningful progress updates
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
      const featuresPath = join(inspectDir, "features.json");
      const featuresExist = existsSync(featuresPath);

      if (result.success && featuresExist) {
        console.log(`\n[${project.name}] Inspection complete.\n`);
        console.log(`  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
        console.log(`  Duration: ${result.cost.duration}`);

        // Git checkpoint
        try {
          await gitStageAndCommit(targetPath, "proteus: inspect complete");
          console.log(`  Committed: "proteus: inspect complete"`);
        } catch {
          // Git commit may fail if nothing to commit
        }

        // Track costs
        await appendCostEntry(targetPath, "inspect", result.cost);
        await appendLogEntry(targetPath, {
          action: "inspect",
          status: "success",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
        });

        console.log(
          `\n  Output: ${featuresPath}`
        );
        console.log(`  Review: proteus review inspect\n`);
      } else if (!result.success && featuresExist) {
        // Session errored but artifacts were produced (e.g., network timeout after work was done)
        console.log(
          `\n[${project.name}] Inspection recovered (session error, but artifacts produced).\n`
        );
        if (result.errors && result.errors.length > 0) {
          for (const err of result.errors) {
            console.log(`  Warning: ${err}`);
          }
        }
        console.log(`  Duration: ${result.cost.duration}`);

        try {
          await gitStageAndCommit(targetPath, "proteus: inspect complete (recovered)");
          console.log(`  Committed: "proteus: inspect complete (recovered)"`);
        } catch {
          // Git commit may fail if nothing to commit
        }

        await appendCostEntry(targetPath, "inspect", result.cost);
        await appendLogEntry(targetPath, {
          action: "inspect",
          status: "recovered",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
          details: result.errors?.join("; "),
        });

        console.log(`\n  Output: ${featuresPath}`);
        console.log(`  Review: proteus review inspect\n`);
      } else {
        console.error(`\n[${project.name}] Inspection failed.\n`);
        if (result.errors && result.errors.length > 0) {
          for (const err of result.errors) {
            console.error(`  Error: ${err}`);
          }
        }
        if (!featuresExist) {
          console.error(
            "  features.json was not produced. The agent may have encountered issues."
          );
        }

        // Check for partial artifacts
        const scoutPath = join(inspectDir, "scout.json");
        if (existsSync(scoutPath)) {
          console.error(
            "\n  Partial artifacts found (scout.json exists). The agent made progress before failing."
          );
          console.error("  Re-run `proteus inspect` to try again.");
        }

        await appendLogEntry(targetPath, {
          action: "inspect",
          status: "failed",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
          details: result.errors?.join("; "),
        });

        process.exit(1);
      }
    }
  );
