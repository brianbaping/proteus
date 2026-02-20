import { Command } from "commander";
import { readRegistry } from "../config/registry.js";
import { getCurrentStage } from "../utils/stages.js";

export const listCommand = new Command("list")
  .description("Show all Proteus Forge projects")
  .action(async () => {
    const registry = await readRegistry();
    const names = Object.keys(registry.projects);

    if (names.length === 0) {
      console.log("No projects. Run `proteus-forge new <name> --source <path>` to create one.");
      return;
    }

    console.log("");
    for (const name of names) {
      const entry = registry.projects[name];
      const isActive = registry.activeProject === name;
      const marker = isActive ? "\u25cf" : " ";
      let stage: string;
      try {
        stage = getCurrentStage(entry.target);
      } catch {
        stage = "unknown";
      }

      console.log(
        `  ${marker} ${name.padEnd(24)} ${entry.target.padEnd(48)} (${stage})`
      );
    }
    console.log("");
  });
