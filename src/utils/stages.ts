import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { StageName, StageStatus } from "../config/types.js";

const STAGE_ARTIFACTS: Record<StageName, string> = {
  inspect: "01-inspect/features.json",
  style: "02-style/style-guide.json",
  design: "03-design/design.md",
  plan: "04-plan/plan.json",
  split: "05-tracks/manifest.json",
  execute: "06-execute/session.json",
};

const STAGE_DIRS: Record<StageName, string> = {
  inspect: "01-inspect",
  style: "02-style",
  design: "03-design",
  plan: "04-plan",
  split: "05-tracks",
  execute: "06-execute",
};

const STAGE_ORDER: StageName[] = [
  "inspect",
  "style",
  "design",
  "plan",
  "split",
  "execute",
];

export function getStageDir(stage: StageName): string {
  return STAGE_DIRS[stage];
}

export function getStagesAfter(stage: StageName): StageName[] {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return [];
  return STAGE_ORDER.slice(idx + 1);
}

export function isValidStage(name: string): name is StageName {
  return STAGE_ORDER.includes(name as StageName);
}

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
