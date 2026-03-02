import { Command } from "commander";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";

export const logCommand = new Command("log")
  .description("View the audit trail for a project")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("-n <count>", "Show last N entries", parseInt)
  .action(async (name: string | undefined, options: { n?: number }) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const logPath = join(project.entry.target, ".proteus-forge", "log.jsonl");
    if (!existsSync(logPath)) {
      console.log(`\n[${project.name}] No log entries yet.\n`);
      return;
    }

    const content = await readFile(logPath, "utf-8");
    let lines = content.trim().split("\n").filter(Boolean);

    if (options.n && options.n > 0) {
      lines = lines.slice(-options.n);
    }

    console.log(`\n[${project.name}] Audit Trail\n`);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const time = new Date(entry.timestamp).toLocaleString();
        const status = entry.status === "success"
          ? "\u2713"
          : entry.status === "recovered"
            ? "\u26a0"
            : "\u2717";
        const cost = entry.cost ? `  $${entry.cost.toFixed(2)}` : "";
        const duration = entry.duration ? `  ${entry.duration}` : "";
        const details = entry.details ? `  (${entry.details})` : "";
        const teammates = entry.teammates ? `  ${entry.teammates} teammates` : "";

        console.log(
          `  ${time}  ${status} ${entry.action.padEnd(10)}${duration}${cost}${teammates}${details}`
        );
      } catch {
        // Skip malformed lines
      }
    }

    console.log("");
  });
