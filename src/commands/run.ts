import { Command } from "commander";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { getCurrentStage, getStageOrder } from "../utils/stages.js";
import { appendLogEntry } from "../utils/log.js";
import type { StageName } from "../config/types.js";

// Import all stage runners
import { runInspect } from "./inspect.js";
import { runDesign } from "./design.js";
import { runPlan } from "./plan.js";
import { runSplit } from "./split.js";
import { runExecute } from "./execute.js";

type StageRunner = (
  projectName: string,
  options: { budget?: number; brief?: string; briefFile?: string }
) => Promise<boolean>;

const STAGE_RUNNERS: Record<StageName, StageRunner> = {
  inspect: (name, opts) => runInspect(name, { budget: opts.budget }),
  design: (name, opts) => runDesign(name, { budget: opts.budget, brief: opts.brief, briefFile: opts.briefFile }),
  plan: (name, opts) => runPlan(name, { budget: opts.budget }),
  split: (name, opts) => runSplit(name, { budget: opts.budget }),
  execute: (name, opts) => runExecute(name, { budget: opts.budget }),
};

export const runCommand = new Command("run")
  .description("Run the full pipeline or a range of stages without stopping")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--from <stage>", "Start from this stage (default: next incomplete)")
  .option("--to <stage>", "Stop after this stage (default: execute)")
  .option("--budget <amount>", "Maximum budget per stage in USD", parseFloat)
  .option("--brief <text>", "Architectural requirements for the design stage")
  .option("--brief-file <path>", "Path to architectural requirements file")
  .action(
    async (
      name: string | undefined,
      options: {
        from?: string;
        to?: string;
        budget?: number;
        brief?: string;
        briefFile?: string;
      }
    ) => {
      let project;
      try {
        project = await resolveProject(name);
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }

      const globalConfig = await readGlobalConfig();
      if (!globalConfig) {
        console.error("Global config not found. Run `proteus-forge setup` first.");
        process.exit(1);
      }

      const allStages = getStageOrder();

      // Determine starting stage
      let fromStage: StageName;
      if (options.from) {
        if (!allStages.includes(options.from as StageName)) {
          console.error(`Unknown stage "${options.from}". Valid: ${allStages.join(", ")}`);
          process.exit(1);
        }
        fromStage = options.from as StageName;
      } else {
        const current = getCurrentStage(project.entry.target);
        if (current === "done") {
          console.log(`\n[${project.name}] All stages already complete. Use --from to re-run.\n`);
          return;
        }
        fromStage = (current === "new" ? "inspect" : current) as StageName;
      }

      // Determine ending stage
      let toStage: StageName;
      if (options.to) {
        if (!allStages.includes(options.to as StageName)) {
          console.error(`Unknown stage "${options.to}". Valid: ${allStages.join(", ")}`);
          process.exit(1);
        }
        toStage = options.to as StageName;
      } else {
        toStage = "execute";
      }

      const fromIdx = allStages.indexOf(fromStage);
      const toIdx = allStages.indexOf(toStage);

      if (fromIdx > toIdx) {
        console.error(`--from (${fromStage}) must come before --to (${toStage}).`);
        process.exit(1);
      }

      const stagesToRun = allStages.slice(fromIdx, toIdx + 1);

      console.log(`\n[${project.name}] Running pipeline: ${stagesToRun.join(" → ")}\n`);

      await appendLogEntry(project.entry.target, {
        action: "run",
        status: "started",
        details: `Stages: ${stagesToRun.join(" → ")}`,
      });

      for (const stage of stagesToRun) {
        console.log(`${"═".repeat(60)}`);
        console.log(`  Stage: ${stage}`);
        console.log(`${"═".repeat(60)}\n`);

        const runner = STAGE_RUNNERS[stage];
        const success = await runner(project.name, options);

        if (!success) {
          console.error(`\n[${project.name}] Pipeline stopped — ${stage} failed.\n`);
          await appendLogEntry(project.entry.target, {
            action: "run",
            status: "failed",
            details: `Failed at: ${stage}`,
          });
          process.exit(1);
        }
      }

      console.log(`\n${"═".repeat(60)}`);
      console.log(`[${project.name}] Pipeline complete: ${stagesToRun.join(" → ")}`);
      console.log(`${"═".repeat(60)}\n`);

      await appendLogEntry(project.entry.target, {
        action: "run",
        status: "success",
        details: `Completed: ${stagesToRun.join(" → ")}`,
      });
    }
  );
