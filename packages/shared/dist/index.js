// src/stages.ts
var STAGE_ARTIFACTS = {
  inspect: "01-inspect/features.json",
  design: "02-design/design.md",
  plan: "03-plan/plan.json",
  split: "04-tracks/manifest.json",
  execute: "05-execute/session.json"
};
var STAGE_DIRS = {
  inspect: "01-inspect",
  design: "02-design",
  plan: "03-plan",
  split: "04-tracks",
  execute: "05-execute"
};
var STAGE_ORDER = [
  "inspect",
  "design",
  "plan",
  "split",
  "execute"
];
function getStageDir(stage) {
  return STAGE_DIRS[stage];
}
function getStagesAfter(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return [];
  return STAGE_ORDER.slice(idx + 1);
}
function isValidStage(name) {
  return STAGE_ORDER.includes(name);
}
function getStageOrder() {
  return STAGE_ORDER;
}
export {
  STAGE_ARTIFACTS,
  STAGE_DIRS,
  STAGE_ORDER,
  getStageDir,
  getStageOrder,
  getStagesAfter,
  isValidStage
};
