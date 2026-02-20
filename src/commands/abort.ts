import { Command } from "commander";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { gitStageAndCommit } from "../utils/git.js";
import { appendLogEntry } from "../utils/log.js";
import { getInboxDir } from "../utils/inbox.js";

export const abortCommand = new Command("abort")
  .description("Signal a running execute session to stop")
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
        "No active execute session found. Nothing to abort."
      );
      process.exit(1);
    }

    // Remove the sentinel file — the inbox watcher will stop on next poll
    try {
      await unlink(sentinelPath);
    } catch {
      // Already gone
    }

    // Write an abort message to the inbox so the Lead sees it
    const { writeInboxMessage } = await import("../utils/inbox.js");
    await writeInboxMessage(
      targetPath,
      "lead",
      "USER ABORT: The user has requested an immediate stop. Shut down all teammates and clean up the team. Do not start any new tasks."
    );

    console.log(`\n[${project.name}] Abort signal sent.\n`);
    console.log("  The Lead will receive the abort message on its next turn.");
    console.log("  Completed work is preserved. Use `proteus-forge resume` to continue later.\n");

    // Commit any partial progress
    try {
      await gitStageAndCommit(targetPath, "proteus-forge: execute aborted by user");
      console.log(`  Committed partial progress: "proteus-forge: execute aborted by user"\n`);
    } catch {
      // Nothing to commit
    }

    await appendLogEntry(targetPath, {
      action: "abort",
      status: "success",
      details: "User-initiated abort",
    });
  });
