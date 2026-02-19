import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { resolveProject } from "../utils/resolve-project.js";

const STAGE_REVIEW_FILES: Record<string, string> = {
  inspect: "01-inspect/features.json",
  design: "02-design/design.md",
  plan: "03-plan/plan.md",
  split: "04-tracks/manifest.json",
  execute: "05-execute/session.json",
};

export const reviewCommand = new Command("review")
  .description("Open a stage artifact in $EDITOR for review")
  .argument("<stage>", "Stage to review (inspect, design, plan, split, execute)")
  .argument("[name]", "Project name (uses active project if omitted)")
  .action(async (stage: string, name?: string) => {
    if (!STAGE_REVIEW_FILES[stage]) {
      console.error(
        `Unknown stage "${stage}". Valid stages: ${Object.keys(STAGE_REVIEW_FILES).join(", ")}`
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

    const artifactPath = join(
      project.entry.target,
      ".proteus",
      STAGE_REVIEW_FILES[stage]
    );

    if (!existsSync(artifactPath)) {
      console.error(
        `${stage} artifact not found. Run \`proteus ${stage}\` first.`
      );
      process.exit(1);
    }

    const editor = process.env.EDITOR || process.env.VISUAL || "vi";

    const child = spawn(editor, [artifactPath], { stdio: "inherit" });

    await new Promise<void>((resolve) => {
      child.on("close", () => resolve());
    });
  });
