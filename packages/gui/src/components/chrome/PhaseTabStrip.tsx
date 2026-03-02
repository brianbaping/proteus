import React from "react";
import { STAGE_ORDER } from "@proteus-forge/shared";
import type { StageName } from "@proteus-forge/shared";
import { useProjectStore } from "../../stores/project-store.js";

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

  function getTabState(stage: StageName): "active" | "completed" | "locked" {
    if (stage === activePhase) return "active";
    const status = stageStatuses.find((s) => s.stage === stage);
    if (status?.complete) return "completed";
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
                    : "text-fg-muted cursor-not-allowed"
              }`}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center text-2xs rounded font-bold ${
                  state === "active"
                    ? "bg-green text-bg"
                    : state === "completed"
                      ? "border border-green-dim text-green-dim"
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
