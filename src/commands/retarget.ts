import { Command } from "commander";
import { rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readRegistry, updateProject } from "../config/registry.js";
import { isInboxActive } from "../utils/inbox.js";
import { appendLogEntry } from "../utils/log.js";
import { confirm } from "../utils/confirm.js";

export const retargetCommand = new Command("retarget")
  .description("Change the target directory for a project")
  .argument("<path>", "New target path")
  .argument("[name]", "Project name (defaults to active project)")
  .option("--move", "Move the existing target directory to the new path")
  .action(async (path: string, name: string | undefined, opts: { move?: boolean }) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const newTarget = resolve(path);
    const oldTarget = project.entry.target;

    if (newTarget === oldTarget) {
      console.log("New path is the same as the current target — nothing to do.");
      return;
    }

    // Check no other project uses the new path
    const registry = await readRegistry();
    for (const [projName, entry] of Object.entries(registry.projects)) {
      if (projName !== project.name && entry.target === newTarget) {
        console.error(
          `Project "${projName}" already uses target path "${newTarget}".`
        );
        process.exit(1);
      }
    }

    if (opts.move) {
      if (!existsSync(oldTarget)) {
        console.error(`Old target does not exist: ${oldTarget}`);
        process.exit(1);
      }
      if (existsSync(newTarget)) {
        console.error(`New target already exists: ${newTarget}`);
        process.exit(1);
      }
      if (isInboxActive(oldTarget)) {
        console.error(
          "Cannot move while an execute session is active. Run `proteus-forge abort` first."
        );
        process.exit(1);
      }

      console.log(`\nProject: ${project.name}`);
      console.log(`  From: ${oldTarget}`);
      console.log(`  To:   ${newTarget}`);

      const confirmed = await confirm("\nMove directory and update registry?");
      if (!confirmed) {
        console.log("Cancelled.");
        return;
      }

      try {
        await rename(oldTarget, newTarget);
        console.log(`  \u2713 Moved directory`);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "EXDEV") {
          console.error(
            "Cannot move across filesystems. Move the directory manually, then run `proteus-forge retarget` without --move."
          );
        } else {
          console.error(`Failed to move directory: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    } else {
      if (!existsSync(newTarget)) {
        console.log(`\n\u26a0  New target does not exist yet: ${newTarget}`);
      }

      console.log(`\nProject: ${project.name}`);
      console.log(`  From: ${oldTarget}`);
      console.log(`  To:   ${newTarget}`);

      const confirmed = await confirm("\nUpdate registry to new target path?");
      if (!confirmed) {
        console.log("Cancelled.");
        return;
      }
    }

    await updateProject(project.name, { target: newTarget });
    console.log(`  \u2713 Updated registry`);

    try {
      await appendLogEntry(newTarget, {
        action: "retarget",
        status: "success",
        details: `Retargeted from ${oldTarget} to ${newTarget}`,
      });
    } catch {
      // Gracefully skip if .proteus-forge/ doesn't exist at new target
    }

    console.log(`\nRetargeted "${project.name}" to ${newTarget}.`);
  });
