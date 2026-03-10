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

export type ActiveTab = StageName | "log";

interface PhaseTabStripProps {
  activePhase: ActiveTab;
  onPhaseClick(phase: ActiveTab): void;
}

export function PhaseTabStrip({ activePhase, onPhaseClick }: PhaseTabStripProps): React.JSX.Element {
  const stageStatuses = useProjectStore((s) => s.stageStatuses);

  function getTabState(stage: StageName): "active" | "completed" | "idle" {
    if (stage === activePhase) return "active";
    const isDiskComplete = stageStatuses.find((s) => s.stage === stage)?.complete ?? false;
    return isDiskComplete ? "completed" : "idle";
  }

  const logActive = activePhase === "log";

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
              onClick={() => onPhaseClick(stage)}
              className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors relative cursor-pointer ${
                state === "active"
                  ? "text-green"
                  : state === "completed"
                    ? "text-green-dim hover:text-green"
                    : "text-fg-dim hover:text-green"
              }`}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center text-2xs rounded font-bold ${
                  state === "active"
                    ? "bg-green text-bg"
                    : state === "completed"
                      ? "border border-green-dim text-green-dim"
                      : "border border-fg-muted text-fg-dim"
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

      {/* Log tab */}
      <div className="flex items-center">
        <span className="text-fg-muted text-xs mx-2 select-none">&rsaquo;</span>
        <button
          onClick={() => onPhaseClick("log")}
          className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors relative cursor-pointer ${
            logActive ? "text-green" : "text-fg-dim hover:text-green"
          }`}
          data-testid="log-tab-button"
        >
          <span>Log</span>
          {logActive && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-green" />
          )}
        </button>
      </div>
    </div>
  );
}
