import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { StageName, StageStatus } from "../config/types.js";

const STAGE_ARTIFACTS: Record<StageName, string> = {
  inspect: "01-inspect/features.json",
  design: "02-design/design.md",
  plan: "03-plan/plan.json",
  split: "04-tracks/manifest.json",
  execute: "05-execute/session.json",
};

const STAGE_ORDER: StageName[] = [
  "inspect",
  "design",
  "plan",
  "split",
  "execute",
];

export function getStageOrder(): StageName[] {
  return STAGE_ORDER;
}

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
    const upstream = statuses[i - 1];

    if (
      current.complete &&
      upstream.complete &&
      upstream.modifiedAt &&
      current.modifiedAt &&
      upstream.modifiedAt > current.modifiedAt
    ) {
      warnings.push({
        stage: current.stage,
        staleReason: `${upstream.stage} was modified after ${current.stage} was generated`,
      });
    }
  }

  return warnings;
}
