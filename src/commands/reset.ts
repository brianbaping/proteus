import { Command } from "commander";
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import {
  isValidStage,
  getStagesAfter,
  getStageDir,
} from "../utils/stages.js";
import { removeCostEntries } from "../utils/costs.js";
import { appendLogEntry } from "../utils/log.js";
import { gitStageAndCommit } from "../utils/git.js";
import { confirm } from "../utils/confirm.js";

export const resetCommand = new Command("reset")
  .description("Remove artifacts for a single stage")
  .argument("<stage>", "Stage to reset (inspect, design, plan, split, execute)")
  .argument("[name]", "Project name (defaults to active project)")
  .action(async (stage: string, name?: string) => {
    if (!isValidStage(stage)) {
      console.error(
        `Invalid stage "${stage}". Valid stages: inspect, design, plan, split, execute`
      );
      process.exit(1);
    }

    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const forgeDir = join(project.entry.target, ".proteus-forge");
    const dir = getStageDir(stage);
    const dirPath = join(forgeDir, dir);

    if (!existsSync(dirPath)) {
      console.log(`Stage "${stage}" has no artifacts (${dir} does not exist).`);
      return;
    }

    // Warn about downstream stages
    const downstream = getStagesAfter(stage);
    const staleDownstream = downstream.filter((s) =>
      existsSync(join(forgeDir, getStageDir(s)))
    );
    if (staleDownstream.length > 0) {
      console.log(
        `\n\u26a0  Downstream stages with artifacts: ${staleDownstream.join(", ")}`
      );
      console.log(
        `   These will become stale. Consider \`proteus-forge revert ${stage}\` to remove them too.`
      );
    }

    console.log(`\nProject: ${project.name}`);
    console.log(`Stage:   ${stage}`);
    console.log(`Remove:  ${dir}`);

    const confirmed = await confirm(`\nDelete ${dir}?`);

    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }

    await rm(dirPath, { recursive: true, force: true });
    console.log(`  \u2713 Removed ${dir}`);

    await removeCostEntries(project.entry.target, [stage]);

    await appendLogEntry(project.entry.target, {
      action: "reset",
      status: "success",
      details: `Reset stage: ${stage}`,
    });

    try {
      await gitStageAndCommit(
        project.entry.target,
        `proteus-forge: reset ${stage}`
      );
    } catch {
      // Git commit is non-blocking
    }

    console.log(`\nReset "${stage}" successfully.`);
  });
