import React from "react";
import { STAGE_ORDER } from "@proteus-forge/shared";
import type { StageName } from "@proteus-forge/shared";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";

const PHASE_LABELS: Record<StageName, string> = {
  inspect: "Inspection",
  design: "Design",
  plan: "Planning",
  split: "Breakdown",
  execute: "Execution",
};

interface PhaseTabStripProps {
  activePhase: StageName;
  onPhaseClick(phase: StageName): void;
}

export function PhaseTabStrip({ activePhase, onPhaseClick }: PhaseTabStripProps): React.JSX.Element {
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const completedStages = useSessionStore((s) => s.completedStages);

  function getTabState(stage: StageName): "active" | "completed" | "unlocked" | "locked" {
    if (stage === activePhase) return "active";

    // "completed" — user has explicitly completed this stage
    if (completedStages.includes(stage)) return "completed";

    // "unlocked" — all prior stages are user-completed AND complete on disk
    const stageIdx = STAGE_ORDER.indexOf(stage);
    const allPriorUserCompleted = STAGE_ORDER.slice(0, stageIdx).every(
      (s) => completedStages.includes(s)
    );
    const allPriorDiskComplete = STAGE_ORDER.slice(0, stageIdx).every(
      (s) => stageStatuses.find((st) => st.stage === s)?.complete
    );
    if (stageIdx === 0 || (allPriorUserCompleted && allPriorDiskComplete)) return "unlocked";

    return "locked";
  }

  return (
    <div className="flex items-center h-11 px-4 gap-0 bg-bg-2 border-b border-border">
      {STAGE_ORDER.map((stage, i) => {
        const state = getTabState(stage);
        const phaseNum = i + 1;

        return (
          <div key={stage} className="flex items-center">
            {i > 0 && (
              <span className="text-fg-muted text-xs mx-2 select-none">&rsaquo;</span>
            )}
            <button
              onClick={() => state !== "locked" && onPhaseClick(stage)}
              disabled={state === "locked"}
              className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors relative ${
                state === "active"
                  ? "text-green"
                  : state === "completed"
                    ? "text-green-dim cursor-pointer hover:text-green"
                    : state === "unlocked"
                      ? "text-fg-dim cursor-pointer hover:text-green"
                      : "text-fg-muted cursor-not-allowed"
              }`}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center text-2xs rounded font-bold ${
                  state === "active"
                    ? "bg-green text-bg"
                    : state === "completed"
                      ? "border border-green-dim text-green-dim"
                      : state === "unlocked"
                        ? "border border-fg-muted text-fg-dim"
                        : "bg-bg-3 text-fg-muted"
                }`}
              >
                {phaseNum}
              </span>
              <span>{PHASE_LABELS[stage]}</span>
              {state === "active" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-green" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
