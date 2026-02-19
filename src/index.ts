#!/usr/bin/env node

import { Command } from "commander";
import { setupCommand } from "./commands/setup.js";
import { newCommand } from "./commands/new.js";
import { listCommand } from "./commands/list.js";
import { useCommand } from "./commands/use.js";
import { destroyCommand } from "./commands/destroy.js";
import { statusCommand } from "./commands/status.js";
import { configCommand } from "./commands/config.js";
import { inspectCommand } from "./commands/inspect.js";
import { designCommand } from "./commands/design.js";
import { planCommand } from "./commands/plan.js";
import { splitCommand } from "./commands/split.js";
import { executeCommand } from "./commands/execute.js";
import { informCommand } from "./commands/inform.js";
import { logCommand } from "./commands/log.js";
import { costsCommand } from "./commands/costs.js";
import { reviewCommand } from "./commands/review.js";
import { validateCommand } from "./commands/validate.js";
import { diffCommand } from "./commands/diff.js";
import { compareCommand } from "./commands/compare.js";
import { explainCommand } from "./commands/explain.js";
import { resumeCommand } from "./commands/resume.js";
import { abortCommand } from "./commands/abort.js";
import { watchCommand } from "./commands/watch.js";

const program = new Command();

program
  .name("proteus")
  .description(
    "Transform POC codebases into production-ready applications using coordinated AI agent teams"
  )
  .version("1.0.0");

// Global
program.addCommand(setupCommand);
program.addCommand(configCommand);

// Project management
program.addCommand(newCommand);
program.addCommand(listCommand);
program.addCommand(useCommand);
program.addCommand(destroyCommand);

// Pipeline stages
program.addCommand(inspectCommand);
program.addCommand(designCommand);
program.addCommand(planCommand);
program.addCommand(splitCommand);
program.addCommand(executeCommand);

// Execution control
program.addCommand(informCommand);
program.addCommand(resumeCommand);
program.addCommand(abortCommand);
program.addCommand(watchCommand);

// Analysis & review
program.addCommand(statusCommand);
program.addCommand(validateCommand);
program.addCommand(reviewCommand);
program.addCommand(diffCommand);
program.addCommand(compareCommand);
program.addCommand(costsCommand);
program.addCommand(explainCommand);
program.addCommand(logCommand);

program.parse();
