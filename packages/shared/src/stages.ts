import type { StageName } from "./types.js";

export const STAGE_ARTIFACTS: Record<StageName, string> = {
  inspect: "01-inspect/features.json",
  design: "02-design/design.md",
  plan: "03-plan/plan.json",
  split: "04-tracks/manifest.json",
  execute: "05-execute/session.json",
};

export const STAGE_DIRS: Record<StageName, string> = {
  inspect: "01-inspect",
  design: "02-design",
  plan: "03-plan",
  split: "04-tracks",
  execute: "05-execute",
};

export const STAGE_ORDER: StageName[] = [
  "inspect",
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
