import { Command } from "commander";
import { resolveProject } from "../utils/resolve-project.js";
import { readCosts } from "../utils/costs.js";

export const costsCommand = new Command("costs")
  .description("Show token usage and cost breakdown per stage")
  .argument("[name]", "Project name (uses active project if omitted)")
  .action(async (name?: string) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const costs = await readCosts(project.entry.target);

    if (Object.keys(costs.stages).length === 0) {
      console.log(`\n[${project.name}] No cost data yet.\n`);
      return;
    }

    console.log(`\n[${project.name}] Cost Breakdown\n`);

    const stageOrder = ["inspect", "design", "plan", "split", "execute"];

    for (const stage of stageOrder) {
      const entry = costs.stages[stage];
      if (!entry) continue;

      const tokens =
        entry.inputTokens + entry.outputTokens > 0
          ? `${(entry.inputTokens / 1000).toFixed(0)}K in / ${(entry.outputTokens / 1000).toFixed(0)}K out`
          : "";
      const teammates = entry.teammates > 0 ? `${entry.teammates} teammates` : "single session";

      console.log(`  ${stage.padEnd(10)} $${entry.estimatedCost.toFixed(2).padStart(6)}   ${entry.duration.padEnd(10)} ${teammates.padEnd(16)} ${tokens}`);
    }

    console.log(`  ${"─".repeat(60)}`);
    console.log(`  ${"Total".padEnd(10)} $${costs.totalCost.toFixed(2).padStart(6)}`);
    console.log("");
  });
