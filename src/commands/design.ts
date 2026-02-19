import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { generateDesignLeadPrompt } from "../prompts/design.js";
import { launchSession } from "../session/launcher.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendCostEntry } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { checkStaleness } from "../utils/stages.js";
import { printDesignTeamSummary } from "../utils/team-summary.js";

export const designCommand = new Command("design")
  .description("Design the production architecture based on inspection findings")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .option("--brief <text>", "Architectural requirements (e.g., 'Use microservices with Go and gRPC')")
  .option("--brief-file <path>", "Path to a file containing architectural requirements")
  .action(
    async (
      name: string | undefined,
      options: { dryRun?: boolean; budget?: number; brief?: string; briefFile?: string }
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

      // Check prerequisite: inspect must be complete
      const featuresPath = join(
        targetPath, ".proteus", "01-inspect", "features.json"
      );
      if (!existsSync(featuresPath)) {
        console.error(
          "Inspect stage not complete. Run `proteus inspect` first."
        );
        process.exit(1);
      }

      // Check staleness
      const warnings = checkStaleness(targetPath);
      for (const w of warnings) {
        if (w.stage === "design") {
          console.log(
            `  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`
          );
        }
      }

      // Read config
      const globalConfig = await readGlobalConfig();
      if (!globalConfig) {
        console.error("Global config not found. Run `proteus setup` first.");
        process.exit(1);
      }

      // Resolve model tier for the architect
      const designRole = globalConfig.roles["design-specialist"];
      const designTier =
        typeof designRole === "string" ? designRole : undefined;
      const tierConfig = designTier
        ? globalConfig.tiers[designTier]
        : undefined;
      const model = tierConfig?.model;

      console.log(`\n[${project.name}] Designing production architecture...\n`);
      console.log(`  Source: ${sourcePath}`);
      console.log(`  Target: ${targetPath}`);
      if (model) {
        console.log(`  Model: ${model} (${designTier} tier)`);
      }

      // Resolve brief
      let brief: string | undefined;
      if (options.briefFile) {
        const briefPath = resolve(options.briefFile);
        if (!existsSync(briefPath)) {
          console.error(`Brief file not found: ${briefPath}`);
          process.exit(1);
        }
        brief = await readFile(briefPath, "utf-8");
      } else if (options.brief) {
        brief = options.brief;
      }

      if (brief) {
        console.log(`  Brief: ${brief.length > 100 ? brief.slice(0, 100) + "..." : brief}`);
      }

      // Dry run mode
      if (options.dryRun) {
        console.log("\n  [Dry run] Would launch Agent Team:");
        console.log(
          "    Lead: architect (reads features.json, scopes design domains)"
        );
        console.log(
          "    Teammates: one per design domain (spawned dynamically)"
        );
        console.log("    Tasks: one per domain + synthesis");
        if (brief) {
          console.log(`    Brief: user architectural requirements provided`);
        }
        console.log(`\n  Estimated cost: depends on feature count and complexity`);
        console.log("  Run without --dry-run to proceed.\n");
        return;
      }

      // Ensure output directories
      const designDir = join(targetPath, ".proteus", "02-design");
      const partialsDir = join(designDir, "partials");
      await mkdir(partialsDir, { recursive: true });

      // Generate the Lead prompt
      const leadPrompt = generateDesignLeadPrompt(sourcePath, targetPath, brief);

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
      const designMdPath = join(designDir, "design.md");
      const designMetaPath = join(designDir, "design-meta.json");
      const designMdExists = existsSync(designMdPath);
      const designMetaExists = existsSync(designMetaPath);
      const hasOutput = designMdExists || designMetaExists;

      if (result.success && hasOutput) {
        console.log(
          `\n[${project.name}] Design complete.\n`
        );
        await printDesignTeamSummary(targetPath);
        console.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
        console.log(`  Duration: ${result.cost.duration}`);

        try {
          await gitStageAndCommit(targetPath, "proteus: design complete");
          console.log(`  Committed: "proteus: design complete"`);
        } catch {
          // Git commit may fail if nothing to commit
        }

        await appendCostEntry(targetPath, "design", result.cost);
        await appendLogEntry(targetPath, {
          action: "design",
          status: "success",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
        });

        console.log(`\n  Output:`);
        if (designMdExists) {
          console.log(`    ${designMdPath}  \u2190 review and edit this`);
        }
        if (designMetaExists) {
          console.log(`    ${designMetaPath}`);
        }
        console.log(`\n  Review: proteus review design\n`);
      } else if (!result.success && hasOutput) {
        console.log(
          `\n[${project.name}] Design recovered (session error, but artifacts produced).\n`
        );
        await printDesignTeamSummary(targetPath);
        if (result.errors && result.errors.length > 0) {
          for (const err of result.errors) {
            console.log(`\n  Warning: ${err}`);
          }
        }
        console.log(`  Duration: ${result.cost.duration}`);

        try {
          await gitStageAndCommit(
            targetPath,
            "proteus: design complete (recovered)"
          );
          console.log(`  Committed: "proteus: design complete (recovered)"`);
        } catch {
          // Git commit may fail if nothing to commit
        }

        await appendCostEntry(targetPath, "design", result.cost);
        await appendLogEntry(targetPath, {
          action: "design",
          status: "recovered",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
          details: result.errors?.join("; "),
        });

        console.log(`\n  Output:`);
        if (designMdExists) console.log(`    ${designMdPath}`);
        if (designMetaExists) console.log(`    ${designMetaPath}`);
        console.log(`\n  Review: proteus review design\n`);
      } else {
        console.error(`\n[${project.name}] Design failed.\n`);
        if (result.errors && result.errors.length > 0) {
          for (const err of result.errors) {
            console.error(`  Error: ${err}`);
          }
        }
        if (!hasOutput) {
          console.error(
            "  design.md / design-meta.json not produced."
          );
        }

        const scopePath = join(designDir, "scope.json");
        if (existsSync(scopePath)) {
          console.error(
            "\n  Partial artifacts found (scope.json exists). The agent made progress before failing."
          );
          console.error("  Re-run `proteus design` to try again.");
        }

        await appendLogEntry(targetPath, {
          action: "design",
          status: "failed",
          duration: result.cost.duration,
          cost: result.cost.estimatedCost,
          details: result.errors?.join("; "),
        });

        process.exit(1);
      }
    }
  );
