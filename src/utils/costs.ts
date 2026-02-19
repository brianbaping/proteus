import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ensureProjectDir } from "../config/project.js";
import type { StageCost, CostTracking } from "../config/types.js";

function getCostsPath(targetPath: string): string {
  return join(targetPath, ".proteus", "costs.json");
}

export async function readCosts(targetPath: string): Promise<CostTracking> {
  const costsPath = getCostsPath(targetPath);
  if (!existsSync(costsPath)) {
    return { stages: {}, totalCost: 0 };
  }
  const content = await readFile(costsPath, "utf-8");
  return JSON.parse(content) as CostTracking;
}

export async function appendCostEntry(
  targetPath: string,
  stage: string,
  cost: StageCost
): Promise<void> {
  await ensureProjectDir(targetPath);
  const costs = await readCosts(targetPath);
  costs.stages[stage] = cost;
  costs.totalCost = Object.values(costs.stages).reduce(
    (sum, c) => sum + c.estimatedCost,
    0
  );
  await writeFile(getCostsPath(targetPath), JSON.stringify(costs, null, 2) + "\n");
}
