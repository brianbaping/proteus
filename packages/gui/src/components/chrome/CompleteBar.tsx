import React from "react";
import type { StageName } from "@proteus-forge/shared";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";

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
  const sessionCost = useSessionStore((s) => s.cost);
  const sessionDuration = useSessionStore((s) => s.duration);
  const sessionSessionId = useSessionStore((s) => s.sessionId);
  const isRunning = useSessionStore((s) => s.isRunning);
  const completedStages = useSessionStore((s) => s.completedStages);
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const stageCosts = useProjectStore((s) => s.costs);

  const isDiskComplete = stageStatuses.find((s) => s.stage === currentPhase)?.complete ?? false;
  const alreadyCompleted = completedStages.includes(currentPhase);
  const completeDisabled = isRunning || !isDiskComplete || alreadyCompleted;

  const historicalStage = stageCosts?.stages[currentPhase];
  const cost = sessionCost > 0 ? sessionCost : (historicalStage?.estimatedCost ?? 0);
  const duration = sessionDuration || (historicalStage?.duration ?? "");
  const sessionId = sessionSessionId || (historicalStage?.sessionId ?? "");

  return (
    <div className="flex items-center justify-between h-12 px-4 bg-bg-2 border-t border-border">
      <div className="flex items-center gap-4">
        <button
          onClick={onDestroy}
          className="px-4 py-1.5 text-sm bg-red-dark text-red border border-red/30 rounded hover:bg-red/20 transition-colors"
        >
          &larr; Destroy Phase &amp; Revert
        </button>
        {(cost > 0 || duration) && (
          <span className="text-xs" data-testid="cost-duration">
            {cost > 0 && <span className="text-green">${cost.toFixed(2)}</span>}
            {cost > 0 && duration && <span className="text-fg-muted"> · </span>}
            {duration && <span className="text-fg-muted">{duration}</span>}
          </span>
        )}
        {sessionId && (
          <span
            className="text-2xs text-fg-muted font-mono truncate max-w-48"
            data-testid="session-id"
            title={sessionId}
          >
            {sessionId}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-fg-muted text-xs">
          {COMPLETE_HINTS[currentPhase]}
        </span>
        <button
          onClick={onComplete}
          disabled={completeDisabled}
          className={`px-4 py-1.5 text-sm font-bold rounded transition-colors ${
            completeDisabled
              ? "bg-amber text-bg opacity-50 cursor-not-allowed"
              : "bg-amber text-bg hover:bg-amber-dim"
          }`}
        >
          Complete Phase &amp; Unlock Next &rarr;
        </button>
      </div>
    </div>
  );
}
