import React from "react";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
import { ArtifactList } from "../shared/ArtifactList.js";
import type { ArtifactFile } from "../shared/ArtifactList.js";
import { StalenessWarning } from "../shared/StalenessWarning.js";
import { StatCard } from "../shared/StatCard.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";

interface ExecutionData {
  totalTasks: number;
  completed: number;
  failed: number;
  successRate: string;
  status: string;
  sessionId: string;
  startedAt: string;
  completedAt: string;
  duration: string;
}

interface ExecutionCanvasProps {
  data: ExecutionData | null;
  files: ArtifactFile[];
}

export type { ExecutionData };

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-dark text-green border-green/30",
  failed: "bg-red-dark text-red border-red/30",
  partial: "bg-amber-dark text-amber border-amber/30",
};

export function ExecutionCanvas({ data, files }: ExecutionCanvasProps): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning && s.currentStage === "execute");
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const executeComplete = stageStatuses.find((s) => s.stage === "execute")?.complete ?? false;

  const badge = isRunning ? "analyzing" : executeComplete ? "complete" : "idle";

  const progressPercent = data
    ? data.totalTasks > 0
      ? Math.round((data.completed / data.totalTasks) * 100)
      : 0
    : 0;
  const failedPercent = data
    ? data.totalTasks > 0
      ? Math.round((data.failed / data.totalTasks) * 100)
      : 0
    : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <ArtifactHeader
        title="Execution"
        badge={badge}
      />
      <StalenessWarning stage="execute" />

      <div className="p-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Tasks" value={data?.totalTasks ?? "—"} />
          <StatCard label="Completed" value={data?.completed ?? "—"} />
          <StatCard label="Failed" value={data?.failed ?? "—"} />
          <StatCard label="Success Rate" value={data?.successRate ?? "—"} />
        </div>

        {/* Session details */}
        {data && (
          <div className="bg-bg-3 rounded-lg border border-border p-4">
            <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">Session Details</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg-muted">Status</span>
                <span className={`px-2 py-0.5 text-2xs font-mono uppercase rounded border ${
                  STATUS_STYLES[data.status] ?? STATUS_STYLES.partial
                }`}>
                  {data.status}
                </span>
              </div>
              {data.sessionId && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-fg-muted">Session ID</span>
                  <span className="text-xs text-fg font-mono truncate max-w-[200px]">{data.sessionId}</span>
                </div>
              )}
              {data.startedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-fg-muted">Started</span>
                  <span className="text-xs text-fg font-mono">{data.startedAt}</span>
                </div>
              )}
              {data.completedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-fg-muted">Completed</span>
                  <span className="text-xs text-fg font-mono">{data.completedAt}</span>
                </div>
              )}
              {data.duration && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-fg-muted">Duration</span>
                  <span className="text-xs text-fg font-mono">{data.duration}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {data && data.totalTasks > 0 && (
          <div className="bg-bg-3 rounded-lg border border-border p-4">
            <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">Progress</div>
            <div className="w-full h-4 bg-bg rounded-full overflow-hidden flex">
              {progressPercent > 0 && (
                <div
                  className="h-full bg-green transition-all"
                  style={{ width: `${progressPercent - failedPercent}%` }}
                />
              )}
              {failedPercent > 0 && (
                <div
                  className="h-full bg-red transition-all"
                  style={{ width: `${failedPercent}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-1 text-2xs text-fg-muted">
              <span>{data.completed} completed</span>
              {data.failed > 0 && <span>{data.failed} failed</span>}
              <span>{data.totalTasks} total</span>
            </div>
          </div>
        )}

        {/* Artifacts */}
        <ArtifactList stage="execute" files={files} title="Execution Artifacts" />

        {/* Empty state */}
        {!data && !isRunning && (
          <div className="flex items-center justify-center h-64 text-fg-muted text-sm">
            Click "Build Candidate" to start production code generation
          </div>
        )}

        {/* Running state */}
        {isRunning && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-fg-dim text-sm">Agent Team executing production build...</div>
              <div className="text-fg-muted text-2xs">Check AI Chat for real-time agent activity</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
