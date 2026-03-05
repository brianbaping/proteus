import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { StageName, StageStatus } from "@proteus-forge/shared";
import {
  STAGE_ARTIFACTS,
  STAGE_ORDER,
} from "@proteus-forge/shared";

// Re-export pure functions and constants from shared
export {
  STAGE_ARTIFACTS,
  STAGE_DIRS,
  STAGE_ORDER,
  getStageDir,
  getStagesAfter,
  isValidStage,
  getStageOrder,
} from "@proteus-forge/shared";

// Node.js-dependent functions (filesystem access)

export function getStageStatuses(targetPath: string): StageStatus[] {
  const forgeDir = join(targetPath, ".proteus-forge");

  return STAGE_ORDER.map((stage) => {
    const artifactPath = join(forgeDir, STAGE_ARTIFACTS[stage]);
    const complete = existsSync(artifactPath);
    let modifiedAt: Date | undefined;

    if (complete) {
      modifiedAt = statSync(artifactPath).mtime;
    }

    return { stage, complete, artifactPath, modifiedAt };
  });
}

export function getCurrentStage(targetPath: string): string {
  const statuses = getStageStatuses(targetPath);
  const lastComplete = statuses.filter((s) => s.complete).pop();

  if (!lastComplete) return "new";

  const idx = STAGE_ORDER.indexOf(lastComplete.stage);
  if (idx === STAGE_ORDER.length - 1) return "done";
  return STAGE_ORDER[idx + 1];
}

export function checkStaleness(
  targetPath: string
): Array<{ stage: StageName; staleReason: string }> {
  const statuses = getStageStatuses(targetPath);
  const warnings: Array<{ stage: StageName; staleReason: string }> = [];

  for (let i = 1; i < statuses.length; i++) {
    const current = statuses[i];
    if (!current.complete || !current.modifiedAt) continue;

    for (let j = 0; j < i; j++) {
      const upstream = statuses[j];
      if (
        upstream.complete &&
        upstream.modifiedAt &&
        upstream.modifiedAt > current.modifiedAt
      ) {
        warnings.push({
          stage: current.stage,
          staleReason: `${upstream.stage} was modified after ${current.stage} was generated`,
        });
        break;
      }
    }
  }

  return warnings;
}
