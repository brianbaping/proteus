import { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { registerProject } from "../config/registry.js";
import { writeProjectConfig, createProjectConfig } from "../config/project.js";
import { globalConfigExists } from "../config/global.js";
import { gitInit } from "../utils/git.js";

const CLAUDE_MD_CONTENT = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a Proteus-managed production repository. The source POC is read-only reference material.
All production code is built here by coordinated AI agent teams.

## Proteus Context

- This repo was created by \`proteus new\`
- Pipeline artifacts are in \`.proteus/\`
- Do not manually edit files in \`.proteus/\` unless you know what you're doing
- Human-editable artifacts: \`.proteus/02-design/design.md\`, \`.proteus/03-plan/plan.md\`
`;

export const newCommand = new Command("new")
  .description("Create a new Proteus project")
  .argument("<name>", "Project name")
  .requiredOption("--source <path>", "Path to the source POC repository")
  .option("--target <path>", "Path for the production target repository")
  .option("--template <name>", "Template to use for specialist hints")
  .action(async (name: string, options: { source: string; target?: string; template?: string }) => {
    // Check setup
    if (!globalConfigExists()) {
      console.error("Proteus is not configured. Run `proteus setup` first.");
      process.exit(1);
    }

    // Resolve paths
    const sourcePath = resolve(options.source);
    if (!existsSync(sourcePath)) {
      console.error(`Source path not found: ${sourcePath}`);
      process.exit(1);
    }

    const targetPath = options.target
      ? resolve(options.target)
      : resolve(dirname(sourcePath), `${basename(sourcePath)}-prod`);

    if (existsSync(targetPath)) {
      console.error(`Target path already exists: ${targetPath}`);
      console.error("Choose a different target or remove the existing directory.");
      process.exit(1);
    }

    console.log(`Creating project "${name}"...\n`);
    console.log(`  Source (read-only): ${sourcePath}`);
    console.log(`  Target: ${targetPath}\n`);

    // Create target directory
    await mkdir(targetPath, { recursive: true });
    console.log("  \u2713 Created target directory");

    // Init git
    await gitInit(targetPath);
    console.log("  \u2713 Initialized git repo");

    // Create .proteus/ and project config
    await writeProjectConfig(targetPath, createProjectConfig(name, sourcePath));
    console.log("  \u2713 Created .proteus/config.json");

    // Create CLAUDE.md
    await writeFile(resolve(targetPath, "CLAUDE.md"), CLAUDE_MD_CONTENT);
    console.log("  \u2713 Created CLAUDE.md");

    // Register project
    await registerProject(name, {
      source: sourcePath,
      target: targetPath,
      createdAt: new Date().toISOString(),
      currentStage: "new",
    });
    console.log("  \u2713 Registered project (set as active)");

    console.log(`\nProject ready. Run \`proteus inspect\` to begin.`);
  });
