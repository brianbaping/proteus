import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { StageName } from "@proteus-forge/shared";
import { getStagesAfter, getStageDir } from "@proteus-forge/shared";
import { removeCostEntries } from "./costs.js";
import { appendLogEntry } from "./log.js";
import { gitStageAndCommit } from "./git.js";

export async function revertStage(
  targetPath: string,
  stage: StageName,
): Promise<{ removed: StageName[] }> {
  const downstream = getStagesAfter(stage);
  if (downstream.length === 0) {
    return { removed: [] };
  }

  const forgeDir = join(targetPath, ".proteus-forge");
  const existingDirs = downstream
    .map((s) => ({ stage: s, path: join(forgeDir, getStageDir(s)) }))
    .filter((d) => existsSync(d.path));

  if (existingDirs.length === 0) {
    return { removed: [] };
  }

  for (const d of existingDirs) {
    await rm(d.path, { recursive: true, force: true });
  }

  const removedStages = existingDirs.map((d) => d.stage);

  await removeCostEntries(targetPath, downstream);

  await appendLogEntry(targetPath, {
    action: "revert",
    status: "success",
    details: `Reverted to ${stage}, removed: ${removedStages.join(", ")}`,
  });

  try {
    await gitStageAndCommit(targetPath, `proteus-forge: revert to ${stage}`);
  } catch {
    // Git commit is non-blocking
  }

  return { removed: removedStages };
}
