import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { isValidStage, getStagesAfter, getStageDir } from "../utils/stages.js";
import { confirm } from "../utils/confirm.js";
import { revertStage } from "../utils/revert.js";

export const revertCommand = new Command("revert")
  .description("Roll back to a stage, removing all artifacts after it")
  .argument("<stage>", "Stage to revert to (inspect, design, plan, split, execute)")
  .argument("[name]", "Project name (defaults to active project)")
  .action(async (stage: string, name?: string) => {
    if (!isValidStage(stage)) {
      console.error(
        `Invalid stage "${stage}". Valid stages: inspect, design, plan, split, execute`
      );
      process.exit(1);
    }

    const downstream = getStagesAfter(stage);
    if (downstream.length === 0) {
      console.log(`"${stage}" is the last stage — nothing to revert.`);
      return;
    }

    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const forgeDir = join(project.entry.target, ".proteus-forge");
    const dirs = downstream.map((s) => ({
      stage: s,
      dir: getStageDir(s),
      path: join(forgeDir, getStageDir(s)),
      exists: existsSync(join(forgeDir, getStageDir(s))),
    }));

    const existingDirs = dirs.filter((d) => d.exists);
    if (existingDirs.length === 0) {
      console.log(`No downstream artifacts exist after "${stage}" — nothing to remove.`);
      return;
    }

    console.log(`\nProject: ${project.name}`);
    console.log(`Reverting to: ${stage}`);
    console.log(`\nDirectories to remove:`);
    for (const d of dirs) {
      const marker = d.exists ? "  \u2717" : "  \u2013";
      const suffix = d.exists ? "" : " (not present)";
      console.log(`${marker} ${d.dir}${suffix}`);
    }

    const confirmed = await confirm(
      `\nRemove ${existingDirs.length} stage director${existingDirs.length === 1 ? "y" : "ies"}?`
    );

    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }

    const result = await revertStage(project.entry.target, stage);

    for (const s of result.removed) {
      console.log(`  \u2713 Removed ${getStageDir(s)}`);
    }

    console.log(`\nReverted to "${stage}" successfully.`);
  });
