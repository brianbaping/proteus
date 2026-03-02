import React from "react";
import type { StageName } from "@proteus-forge/shared";

interface CompleteBarProps {
  currentPhase: StageName;
  onDestroy(): void;
  onComplete(): void;
}

const COMPLETE_HINTS: Record<StageName, string> = {
  inspect: "Review findings before proceeding to design",
  design: "Review architecture before generating the plan",
  plan: "Review task DAG before breaking into tracks",
  split: "Review tracks before launching execution",
  execute: "Review generated code and verify output",
};

export function CompleteBar({ currentPhase, onDestroy, onComplete }: CompleteBarProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between h-12 px-4 bg-bg-2 border-t border-border">
      <button
        onClick={onDestroy}
        className="px-4 py-1.5 text-sm bg-red-dark text-red border border-red/30 rounded hover:bg-red/20 transition-colors"
      >
        &larr; Destroy Phase &amp; Revert
      </button>

      <div className="flex items-center gap-4">
        <span className="text-fg-muted text-xs">
          {COMPLETE_HINTS[currentPhase]}
        </span>
        <button
          onClick={onComplete}
          className="px-4 py-1.5 text-sm bg-amber text-bg font-bold rounded hover:bg-amber-dim transition-colors"
        >
          Complete Phase &amp; Unlock Next &rarr;
        </button>
      </div>
    </div>
  );
}
