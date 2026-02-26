#!/usr/bin/env node

import { Command, Help } from "commander";
import { setupCommand } from "./commands/setup.js";
import { newCommand } from "./commands/new.js";
import { listCommand } from "./commands/list.js";
import { useCommand } from "./commands/use.js";
import { destroyCommand } from "./commands/destroy.js";
import { revertCommand } from "./commands/revert.js";
import { resetCommand } from "./commands/reset.js";
import { retargetCommand } from "./commands/retarget.js";
import { statusCommand } from "./commands/status.js";
import { configCommand } from "./commands/config.js";
import { inspectCommand } from "./commands/inspect.js";
import { styleCommand } from "./commands/style.js";
import { designCommand } from "./commands/design.js";
import { planCommand } from "./commands/plan.js";
import { splitCommand } from "./commands/split.js";
import { executeCommand } from "./commands/execute.js";
import { runCommand } from "./commands/run.js";
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
import { listModelsCommand } from "./commands/list-models.js";

const program = new Command();

program
  .name("proteus-forge")
  .description(
    "Transform POC codebases into production-ready applications using coordinated AI agent teams"
  )
  .version("1.0.0");

// Primary workflow (in order of use)
const PRIMARY_COMMAND_COUNT = 8;
program.addCommand(setupCommand);
program.addCommand(newCommand);
program.addCommand(useCommand);
program.addCommand(inspectCommand);
program.addCommand(designCommand);
program.addCommand(planCommand);
program.addCommand(splitCommand);
program.addCommand(executeCommand);

// Remaining commands (alphabetical)
program.addCommand(abortCommand);
program.addCommand(compareCommand);
program.addCommand(configCommand);
program.addCommand(costsCommand);
program.addCommand(destroyCommand);
program.addCommand(diffCommand);
program.addCommand(explainCommand);
program.addCommand(informCommand);
program.addCommand(listCommand);
program.addCommand(listModelsCommand);
program.addCommand(logCommand);
program.addCommand(resetCommand);
program.addCommand(resumeCommand);
program.addCommand(retargetCommand);
program.addCommand(revertCommand);
program.addCommand(reviewCommand);
program.addCommand(runCommand);
program.addCommand(statusCommand);
program.addCommand(styleCommand);
program.addCommand(validateCommand);
program.addCommand(watchCommand);

// Insert a blank line between primary and remaining commands in help output
program.configureHelp({
  formatHelp(cmd, helper) {
    const output = Help.prototype.formatHelp.call(this, cmd, helper);
    if (cmd.parent) return output;
    const lines = output.split("\n");
    const idx = lines.findIndex((l) => l.trimEnd() === "Commands:");
    if (idx >= 0) {
      lines.splice(idx + 1 + PRIMARY_COMMAND_COUNT, 0, "");
    }
    return lines.join("\n");
  },
});

program.parse();
