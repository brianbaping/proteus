import { Command } from "commander";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";

async function countFiles(
  dir: string,
  exclude: string[] = []
): Promise<{ files: number; lines: number }> {
  let files = 0;
  let lines = 0;

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const relative = fullPath.replace(dir + "/", "");

      if (exclude.some((ex) => relative.startsWith(ex) || entry.name === ex)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files++;
        try {
          const { readFile } = await import("node:fs/promises");
          const content = await readFile(fullPath, "utf-8");
          lines += content.split("\n").length;
        } catch {
          // Binary file or unreadable
        }
      }
    }
  }

  if (existsSync(dir)) await walk(dir);
  return { files, lines };
}

export const compareCommand = new Command("compare")
  .description("Compare the source POC against the production target")
  .argument("[name]", "Project name (uses active project if omitted)")
  .action(async (name?: string) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const sourcePath = project.entry.source;
    const targetPath = project.entry.target;

    console.log(`\n[${project.name}] Source vs Target Comparison\n`);

    // Count source files
    const sourceStats = await countFiles(sourcePath, [
      "node_modules",
      ".git",
      "dist",
    ]);

    // Count target files (excluding .proteus and node_modules)
    const targetStats = await countFiles(targetPath, [
      "node_modules",
      ".git",
      ".proteus",
      "dist",
    ]);

    console.log(`  Source: ${sourcePath}`);
    console.log(`    ${sourceStats.files} files, ~${sourceStats.lines.toLocaleString()} lines\n`);
    console.log(`  Target: ${targetPath}`);
    console.log(`    ${targetStats.files} files, ~${targetStats.lines.toLocaleString()} lines\n`);

    const fileRatio = targetStats.files > 0 && sourceStats.files > 0
      ? (targetStats.files / sourceStats.files).toFixed(1)
      : "N/A";
    const lineRatio = targetStats.lines > 0 && sourceStats.lines > 0
      ? (targetStats.lines / sourceStats.lines).toFixed(1)
      : "N/A";

    console.log(`  Growth: ${fileRatio}x files, ${lineRatio}x lines\n`);

    // List top-level directories in target (excluding meta)
    if (existsSync(targetPath)) {
      const entries = await readdir(targetPath, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
        .map((e) => e.name);

      if (dirs.length > 0) {
        console.log(`  Production structure:`);
        for (const d of dirs) {
          const dirStats = await countFiles(join(targetPath, d), ["node_modules", "dist"]);
          console.log(`    ${d.padEnd(20)} ${dirStats.files} files`);
        }
      }
    }

    console.log("");
  });
