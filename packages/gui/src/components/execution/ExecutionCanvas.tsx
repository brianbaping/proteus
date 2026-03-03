import React, { useCallback } from "react";
import { STAGE_DIRS } from "@proteus-forge/shared";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
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
  artifacts: Array<{ name: string; size: string; icon: string }>;
}

interface ExecutionCanvasProps {
  data: ExecutionData | null;
}

export type { ExecutionData };

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-dark text-green border-green/30",
  failed: "bg-red-dark text-red border-red/30",
  partial: "bg-amber-dark text-amber border-amber/30",
};

export function ExecutionCanvas({ data }: ExecutionCanvasProps): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning && s.currentStage === "execute");
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const activeEntry = useProjectStore((s) => s.activeEntry);
  const executeComplete = stageStatuses.find((s) => s.stage === "execute")?.complete ?? false;

  const badge = isRunning ? "analyzing" : executeComplete ? "complete" : "idle";

  const handleExport = useCallback(async (filename: string) => {
    if (!activeEntry?.target) return;
    const sourcePath = `${activeEntry.target}/.proteus-forge/${STAGE_DIRS.execute}/${filename}`;
    await window.electronAPI.saveFile(sourcePath, filename);
  }, [activeEntry]);

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
        actions={
          executeComplete ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("session.json")}
                className="px-3 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber transition-colors"
              >
                Export JSON
              </button>
            </div>
          ) : undefined
        }
      />

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
        {data?.artifacts && data.artifacts.length > 0 && (
          <div className="bg-bg-3 rounded-lg border border-border p-4">
            <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">Execution Artifacts</div>
            <div className="grid grid-cols-3 gap-2">
              {data.artifacts.map((a, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center p-3 bg-bg rounded-lg border border-border hover:border-green/30 cursor-pointer transition-colors"
                >
                  <span className="text-2xl mb-1">{a.icon}</span>
                  <span className="text-xs text-fg truncate w-full text-center">{a.name}</span>
                  <span className="text-2xs text-fg-muted">{a.size}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
