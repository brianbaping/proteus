import React, { useCallback, useEffect, useState } from "react";
import { ExecutionCanvas } from "./ExecutionCanvas.js";
import type { ExecutionData } from "./ExecutionCanvas.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

interface TrackEntry {
  id: string;
  discipline: string;
  taskCount: number;
  file: string;
  dependsOnTracks: string[];
}

interface ManifestJson {
  tracks?: TrackEntry[];
}

interface SessionJson {
  status?: string;
  sessionId?: string;
  startedAt?: string;
  completedAt?: string;
  progress?: {
    totalTasks: number;
    completed: number;
    failed: number;
  };
}

function sessionJsonToExecutionData(session: SessionJson): ExecutionData {
  const progress = session.progress ?? { totalTasks: 0, completed: 0, failed: 0 };
  const successRate = progress.totalTasks > 0
    ? `${Math.round((progress.completed / progress.totalTasks) * 100)}%`
    : "—";

  let duration = "—";
  if (session.startedAt && session.completedAt) {
    const start = new Date(session.startedAt).getTime();
    const end = new Date(session.completedAt).getTime();
    const diffMs = end - start;
    if (diffMs > 0) {
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }
  }

  return {
    totalTasks: progress.totalTasks,
    completed: progress.completed,
    failed: progress.failed,
    successRate,
    status: session.status ?? "unknown",
    sessionId: session.sessionId ?? "",
    startedAt: session.startedAt ?? "",
    completedAt: session.completedAt ?? "",
    duration,
    artifacts: [
      { name: "session.json", size: `${progress.totalTasks} tasks`, icon: "\u{1f4cb}" },
    ],
  };
}

export function ExecutionPhase(): React.JSX.Element {
  const { activeEntry, activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { isRunning, startStage, endSession } = useSessionStore();
  const { addMessage, clearMessages } = useChatStore();
  const [tracks, setTracks] = useState<TrackEntry[]>([]);
  const [executionData, setExecutionData] = useState<ExecutionData | null>(null);

  const splitComplete = stageStatuses.find((s) => s.stage === "split")?.complete ?? false;
  const executeComplete = stageStatuses.find((s) => s.stage === "execute")?.complete ?? false;

  const loadManifest = useCallback(async () => {
    if (!activeEntry?.target) return;
    try {
      const result = await window.electronAPI.readArtifacts(activeEntry.target, "split");
      if (result?.manifest) {
        const manifest = result.manifest as ManifestJson;
        setTracks(manifest.tracks ?? []);
      }
    } catch {
      // Manifest not available
    }
  }, [activeEntry?.target]);

  const loadSessionArtifacts = useCallback(async () => {
    if (!activeEntry?.target) return;
    try {
      const result = await window.electronAPI.readArtifacts(activeEntry.target, "execute");
      if (result?.session) {
        setExecutionData(sessionJsonToExecutionData(result.session as SessionJson));
      }
    } catch {
      // Session artifacts not available
    }
  }, [activeEntry?.target]);

  useEffect(() => {
    if (splitComplete) {
      loadManifest();
    }
  }, [splitComplete, loadManifest]);

  useEffect(() => {
    if (executeComplete) {
      loadSessionArtifacts();
    }
  }, [executeComplete, loadSessionArtifacts]);

  async function handleAbort(): Promise<void> {
    try {
      await window.electronAPI.abortStage();
    } catch {
      // Session may have already ended
    }
    endSession(false, 0, "0s");
    addMessage("ai", "Stage aborted by user.");
  }

  async function handleBuildCandidate(): Promise<void> {
    if (!activeProjectName) return;
    clearMessages();
    startStage("execute");
    addMessage("ai", "Launching Agent Team for execution...");

    try {
      const result = await window.electronAPI.runStage({
        projectName: activeProjectName,
        stage: "execute",
      });
      endSession(result.success, result.cost.estimatedCost, result.cost.duration);
      await refreshStatus();

      if (result.success) {
        addMessage("ai", "Execution complete.");
        await loadSessionArtifacts();
      } else {
        addMessage("ai", "Execution failed.");
      }
    } catch (err) {
      endSession(false, 0, "0s");
      addMessage("ai", `Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex h-full">
      {/* Ticket sidebar */}
      <div className="w-64 flex flex-col bg-bg-2 border-r border-border overflow-y-auto">
        <div className="p-4">
          <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
            EXECUTION TICKETS
          </div>
        </div>

        <div className="flex-1 px-4 space-y-1">
          {tracks.length > 0 ? (
            tracks.map((track) => (
              <div
                key={track.id}
                className="p-2 rounded border border-border bg-bg-3 hover:border-green/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-fg capitalize">{track.discipline}</span>
                  <span className="text-2xs text-fg-muted">{track.taskCount} tasks</span>
                </div>
                {track.dependsOnTracks.length > 0 && (
                  <div className="text-2xs text-fg-muted mt-1">
                    depends on: {track.dependsOnTracks.join(", ")}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-fg-muted text-xs p-3 text-center">
              {splitComplete ? "No tracks found" : "Run breakdown to see execution tickets"}
            </div>
          )}
        </div>

        <div className="p-4">
          {isRunning ? (
            <button
              onClick={handleAbort}
              className="w-full py-2.5 rounded font-bold text-sm bg-red text-bg hover:bg-red/80 transition-colors"
            >
              ⏹ STOP
            </button>
          ) : (
            <button
              onClick={handleBuildCandidate}
              className="w-full py-2.5 rounded font-bold text-sm bg-green text-bg hover:bg-green-dim transition-colors"
            >
              ▶ BUILD CANDIDATE
            </button>
          )}
        </div>
      </div>

      <ExecutionCanvas data={executionData} />
    </div>
  );
}
