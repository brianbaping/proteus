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
import { createDashboard } from "../utils/progress.js";

export async function runDesign(
  name: string | undefined,
  options: { dryRun?: boolean; budget?: number; brief?: string; briefFile?: string }
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

  const featuresPath = join(targetPath, ".proteus-forge", "01-inspect", "features.json");
  if (!existsSync(featuresPath)) {
    console.error("Inspect stage not complete. Run `proteus-forge inspect` first.");
    return false;
  }

  const warnings = checkStaleness(targetPath);
  for (const w of warnings) {
    if (w.stage === "design") {
      console.log(`  \u26a0 ${w.staleReason}. Consider re-running upstream stages first.\n`);
    }
  }

  const globalConfig = await readGlobalConfig();
  if (!globalConfig) {
    console.error("Global config not found. Run `proteus-forge setup` first.");
    return false;
  }

  const designRole = globalConfig.roles["design-specialist"];
  const designTier = typeof designRole === "string" ? designRole : undefined;
  const tierConfig = designTier ? globalConfig.tiers[designTier] : undefined;
  const model = tierConfig?.model;

  console.log(`\n[${project.name}] Designing production architecture...\n`);
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target: ${targetPath}`);
  if (model) console.log(`  Model: ${model} (${designTier} tier)`);

  let brief: string | undefined;
  if (options.briefFile) {
    const briefPath = resolve(options.briefFile);
    if (!existsSync(briefPath)) {
      console.error(`Brief file not found: ${briefPath}`);
      return false;
    }
    brief = await readFile(briefPath, "utf-8");
  } else if (options.brief) {
    brief = options.brief;
  }

  if (brief) {
    console.log(`  Brief: ${brief.length > 100 ? brief.slice(0, 100) + "..." : brief}`);
  }

  if (options.dryRun) {
    console.log("\n  [Dry run] Would launch Agent Team:");
    console.log("    Lead: architect (reads features.json, scopes design domains)");
    console.log("    Teammates: one per design domain (spawned dynamically)");
    console.log("    Tasks: one per domain + synthesis");
    if (brief) console.log(`    Brief: user architectural requirements provided`);
    console.log(`\n  Estimated cost: depends on feature count and complexity`);
    console.log("  Run without --dry-run to proceed.\n");
    return true;
  }

  const designDir = join(targetPath, ".proteus-forge", "02-design");
  await mkdir(join(designDir, "partials"), { recursive: true });

  const leadPrompt = generateDesignLeadPrompt(sourcePath, targetPath, brief);
  console.log("\n  Launching Agent Team...\n");

  const dashboard = createDashboard("design");
  const result = await launchSession({
    prompt: leadPrompt,
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model,
    maxBudgetUsd: options.budget,
    permissionMode: "acceptEdits",
    onMessage: (msg) => dashboard.onMessage(msg),
  });
  dashboard.cleanup();

  const hasOutput = existsSync(join(designDir, "design.md")) || existsSync(join(designDir, "design-meta.json"));

  if ((result.success || hasOutput) && hasOutput) {
    const label = result.success ? "Design complete" : "Design recovered";
    console.log(`\n[${project.name}] ${label}.\n`);
    await printDesignTeamSummary(targetPath);
    console.log(`\n  Cost: $${result.cost.estimatedCost.toFixed(2)}`);
    console.log(`  Duration: ${result.cost.duration}`);

    try {
      const msg = result.success ? "proteus-forge: design complete" : "proteus-forge: design complete (recovered)";
      await gitStageAndCommit(targetPath, msg);
      console.log(`  Committed: "${msg}"`);
    } catch { /* empty */ }

    await appendCostEntry(targetPath, "design", result.cost);
    await appendLogEntry(targetPath, {
      action: "design",
      status: result.success ? "success" : "recovered",
      duration: result.cost.duration,
      cost: result.cost.estimatedCost,
    });

    console.log(`\n  Review: proteus-forge review design\n`);
    return true;
  }

  console.error(`\n[${project.name}] Design failed.\n`);
  if (result.errors?.length) {
    for (const err of result.errors) console.error(`  Error: ${err}`);
  }

  await appendLogEntry(targetPath, {
    action: "design",
    status: "failed",
    duration: result.cost.duration,
    cost: result.cost.estimatedCost,
    details: result.errors?.join("; "),
  });

  return false;
}

export const designCommand = new Command("design")
  .description("Design the production architecture based on inspection findings")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--dry-run", "Preview what would happen without launching agents")
  .option("--budget <amount>", "Maximum budget in USD for this stage", parseFloat)
  .option("--brief <text>", "Architectural requirements (e.g., 'Use microservices with Go and gRPC')")
  .option("--brief-file <path>", "Path to a file containing architectural requirements")
  .action(async (name: string | undefined, options: { dryRun?: boolean; budget?: number; brief?: string; briefFile?: string }) => {
    const success = await runDesign(name, options);
    if (!success) process.exit(1);
  });
