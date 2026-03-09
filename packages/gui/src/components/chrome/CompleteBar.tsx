import React from "react";
import type { StageName } from "@proteus-forge/shared";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";

interface CompleteBarProps {
  currentPhase: StageName;
  onDestroy(): void;
}

export function CompleteBar({ currentPhase, onDestroy }: CompleteBarProps): React.JSX.Element {
  const sessionCost = useSessionStore((s) => s.cost);
  const sessionDuration = useSessionStore((s) => s.duration);
  const sessionSessionId = useSessionStore((s) => s.sessionId);
  const isRunning = useSessionStore((s) => s.isRunning);
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const stageCosts = useProjectStore((s) => s.costs);

  const isDiskComplete = stageStatuses.find((s) => s.stage === currentPhase)?.complete ?? false;
  const destroyDisabled = isRunning || !isDiskComplete;

  const historicalStage = stageCosts?.stages[currentPhase];
  const cost = sessionCost > 0 ? sessionCost : (historicalStage?.estimatedCost ?? 0);
  const duration = sessionDuration || (historicalStage?.duration ?? "");
  const sessionId = sessionSessionId || (historicalStage?.sessionId ?? "");

  return (
    <div className="flex items-center justify-between h-12 px-4 bg-bg-2 border-t border-border">
      <div className="flex items-center gap-4">
        <button
          onClick={onDestroy}
          disabled={destroyDisabled}
          className={`px-4 py-1.5 text-sm border rounded transition-colors ${
            destroyDisabled
              ? "bg-bg-3 text-fg-muted border-border-2 cursor-not-allowed"
              : "bg-red-dark text-red border-red/30 hover:bg-red/20"
          }`}
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
    </div>
  );
}
