import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveProject } from "../utils/resolve-project.js";

const execFileAsync = promisify(execFile);

const STAGE_ARTIFACTS: Record<string, string[]> = {
  inspect: ["01-inspect/features.json", "01-inspect/scout.json"],
  design: ["02-design/design.md", "02-design/design-meta.json"],
  plan: ["03-plan/plan.json", "03-plan/plan.md"],
  split: ["04-tracks/manifest.json"],
  execute: ["05-execute/session.json"],
};

export const diffCommand = new Command("diff")
  .description("Show git changes for a stage's artifacts between runs")
  .argument("<stage>", "Stage to diff (inspect, design, plan, split, execute)")
  .argument("[name]", "Project name (uses active project if omitted)")
  .action(async (stage: string, name?: string) => {
    if (!STAGE_ARTIFACTS[stage]) {
      console.error(
        `Unknown stage "${stage}". Valid stages: ${Object.keys(STAGE_ARTIFACTS).join(", ")}`
      );
      process.exit(1);
    }

    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const targetPath = project.entry.target;
    const paths = STAGE_ARTIFACTS[stage].map((p) =>
      join(".proteus", p)
    );

    // Check at least one artifact exists
    const existing = paths.filter((p) => existsSync(join(targetPath, p)));
    if (existing.length === 0) {
      console.error(
        `No ${stage} artifacts found. Run \`proteus ${stage}\` first.`
      );
      process.exit(1);
    }

    try {
      const { stdout } = await execFileAsync(
        "git",
        ["diff", "HEAD~1", "--", ...existing],
        { cwd: targetPath, maxBuffer: 1024 * 1024 }
      );

      if (stdout.trim()) {
        console.log(stdout);
      } else {
        console.log(`\n[${project.name}] No changes in ${stage} artifacts since last commit.\n`);
      }
    } catch {
      // If HEAD~1 doesn't exist (first commit), show the full file
      try {
        const { stdout } = await execFileAsync(
          "git",
          ["diff", "--cached", "--", ...existing],
          { cwd: targetPath, maxBuffer: 1024 * 1024 }
        );
        if (stdout.trim()) {
          console.log(stdout);
        } else {
          console.log(`\n[${project.name}] No diff available for ${stage} (may be initial commit).\n`);
        }
      } catch {
        console.log(`\n[${project.name}] Could not generate diff for ${stage}.\n`);
      }
    }
  });
