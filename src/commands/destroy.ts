import { Command } from "commander";
import { rm } from "node:fs/promises";
import { createInterface } from "node:readline";
import { getProject, unregisterProject } from "../config/registry.js";

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

export const destroyCommand = new Command("destroy")
  .description("Remove a Proteus project")
  .argument("<name>", "Project name")
  .action(async (name: string) => {
    const entry = await getProject(name);
    if (!entry) {
      console.error(`Project "${name}" not found.`);
      process.exit(1);
    }

    console.log(`\nProject: ${name}`);
    console.log(`  Target: ${entry.target}`);
    console.log(`  Source: ${entry.source} (will NOT be deleted)\n`);

    const confirmed = await confirm(
      `Delete target directory and remove project "${name}"?`
    );

    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }

    try {
      await rm(entry.target, { recursive: true, force: true });
      console.log(`  \u2713 Deleted ${entry.target}`);
    } catch {
      console.log(`  \u26a0 Could not delete ${entry.target} (may not exist)`);
    }

    await unregisterProject(name);
    console.log(`  \u2713 Removed "${name}" from project registry`);
  });
