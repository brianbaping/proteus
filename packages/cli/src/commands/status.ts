import { Command } from "commander";
import { resolveProject } from "../utils/resolve-project.js";
import { getStageStatuses, checkStaleness } from "../utils/stages.js";

export const statusCommand = new Command("status")
  .description("Show pipeline status for a project")
  .argument("[name]", "Project name (uses active project if omitted)")
  .action(async (name?: string) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const statuses = getStageStatuses(project.entry.target);
    const warnings = checkStaleness(project.entry.target);

    console.log(`\n[${project.name}] Pipeline Status\n`);
    console.log(`  Source: ${project.entry.source}`);
    console.log(`  Target: ${project.entry.target}\n`);

    for (const status of statuses) {
      const icon = status.complete ? "\u2713" : "\u25cb";
      const time = status.modifiedAt
        ? `  (${status.modifiedAt.toLocaleString()})`
        : "";
      console.log(`  ${icon} ${status.stage.padEnd(12)}${time}`);
    }

    if (warnings.length > 0) {
      console.log("");
      for (const warning of warnings) {
        console.log(`  \u26a0 ${warning.staleReason}. Re-run \`proteus-forge ${warning.stage}\`.`);
      }
    }

    console.log("");
  });
