import { Command } from "commander";
import { existsSync, watchFile, unwatchFile } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { getInboxDir } from "../utils/inbox.js";

export const watchCommand = new Command("watch")
  .description("Watch a running execute session's progress")
  .argument("[name]", "Project name (uses active project if omitted)")
  .action(async (name?: string) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const targetPath = project.entry.target;
    const sentinelPath = join(getInboxDir(targetPath), ".active");

    if (!existsSync(sentinelPath)) {
      console.error(
        "No active execute session found. Run `proteus execute` first."
      );
      process.exit(1);
    }

    console.log(`\n[${project.name}] Watching execute session...\n`);
    console.log("  Monitoring .proteus/log.jsonl for updates.");
    console.log("  Press Ctrl+C to stop watching.\n");

    const logPath = join(targetPath, ".proteus", "log.jsonl");
    let lastSize = 0;

    // Print existing log
    if (existsSync(logPath)) {
      const content = await readFile(logPath, "utf-8");
      lastSize = content.length;
      const lines = content.trim().split("\n").filter(Boolean);
      for (const line of lines.slice(-5)) {
        try {
          const entry = JSON.parse(line);
          const time = new Date(entry.timestamp).toLocaleTimeString();
          console.log(`  ${time}  ${entry.action} — ${entry.status}`);
        } catch {
          // Skip
        }
      }
    }

    // Watch for changes
    const checkForUpdates = async () => {
      if (!existsSync(logPath)) return;
      const content = await readFile(logPath, "utf-8");
      if (content.length > lastSize) {
        const newContent = content.slice(lastSize);
        lastSize = content.length;
        const lines = newContent.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const time = new Date(entry.timestamp).toLocaleTimeString();
            console.log(`  ${time}  ${entry.action} — ${entry.status}`);
          } catch {
            // Skip
          }
        }
      }
    };

    // Also check if session is still active
    const checkActive = () => {
      if (!existsSync(sentinelPath)) {
        console.log("\n  Session ended.\n");
        process.exit(0);
      }
    };

    watchFile(logPath, { interval: 2000 }, checkForUpdates);
    const activeInterval = setInterval(checkActive, 3000);

    // Handle Ctrl+C
    process.on("SIGINT", () => {
      unwatchFile(logPath);
      clearInterval(activeInterval);
      console.log("\n  Stopped watching.\n");
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});
  });
