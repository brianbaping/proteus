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

const program = new Command();

program
  .name("proteus")
  .description(
    "Transform POC codebases into production-ready applications using coordinated AI agent teams"
  )
  .version("1.0.0");

program.addCommand(setupCommand);
program.addCommand(newCommand);
program.addCommand(listCommand);
program.addCommand(useCommand);
program.addCommand(destroyCommand);
program.addCommand(statusCommand);
program.addCommand(configCommand);
program.addCommand(inspectCommand);
program.addCommand(designCommand);

program.parse();
