import { Command } from "commander";
import { setActiveProject } from "../config/registry.js";

export const useCommand = new Command("use")
  .description("Set the active project")
  .argument("<name>", "Project name")
  .action(async (name: string) => {
    try {
      await setActiveProject(name);
      console.log(`Active project set to "${name}".`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
