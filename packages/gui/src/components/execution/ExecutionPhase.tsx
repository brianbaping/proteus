import React, { useCallback, useEffect, useState } from "react";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
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

export function ExecutionPhase(): React.JSX.Element {
  const { activeEntry, activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { isRunning, startStage, endSession } = useSessionStore();
  const { addMessage, clearMessages } = useChatStore();
  const [tracks, setTracks] = useState<TrackEntry[]>([]);

  const splitComplete = stageStatuses.find((s) => s.stage === "split")?.complete ?? false;
  const executeComplete = stageStatuses.find((s) => s.stage === "execute")?.complete ?? false;
  const badge = isRunning && useSessionStore.getState().currentStage === "execute"
    ? "analyzing" : executeComplete ? "complete" : "idle";

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

  useEffect(() => {
    if (splitComplete) {
      loadManifest();
    }
  }, [splitComplete, loadManifest]);

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
      addMessage("ai", result.success ? "Execution complete." : "Execution failed.");
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
          <button
            onClick={handleBuildCandidate}
            disabled={isRunning}
            className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${
              isRunning ? "bg-bg-3 text-fg-muted cursor-not-allowed" : "bg-green text-bg hover:bg-green-dim"
            }`}
          >
            {isRunning ? "Building..." : "\u25b6 BUILD CANDIDATE"}
          </button>
        </div>
      </div>

      {/* Execution main content */}
      <div className="flex-1 overflow-y-auto bg-bg">
        <ArtifactHeader title="Execution" badge={badge} />
        <div className="p-4">
          {!executeComplete && !isRunning && (
            <div className="flex items-center justify-center h-64 text-fg-muted text-sm">
              Click "Build Candidate" to start production code generation
            </div>
          )}
          {isRunning && (
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
    </div>
  );
}
