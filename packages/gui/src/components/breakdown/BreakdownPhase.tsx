import React, { useCallback, useEffect, useState } from "react";
import { FileDropZone } from "../shared/FileDropZone.js";
import { BreakdownCanvas } from "./BreakdownCanvas.js";
import type { BreakdownData, TrackDisplay } from "./BreakdownCanvas.js";
import type { ArtifactFile } from "../shared/ArtifactList.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

interface ManifestJson {
  tracks?: Array<{
    id: string;
    discipline: string;
    taskCount: number;
    file: string;
    dependsOnTracks: string[];
    requiredByTracks?: string[];
  }>;
}

function manifestToBreakdownData(manifest: ManifestJson): BreakdownData {
  const tracks: TrackDisplay[] = (manifest.tracks ?? []).map((t) => ({
    id: t.id,
    discipline: t.discipline,
    taskCount: t.taskCount,
    dependsOnTracks: t.dependsOnTracks ?? [],
    requiredByTracks: t.requiredByTracks ?? [],
  }));

  const totalTasks = tracks.reduce((sum, t) => sum + t.taskCount, 0);
  const disciplines = [...new Set(tracks.map((t) => t.discipline))];

  return {
    totalTracks: tracks.length,
    totalTasks,
    disciplines,
    tracks,
  };
}

export function BreakdownPhase(): React.JSX.Element {
  const { activeEntry, activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { isRunning, startStage, endSession } = useSessionStore();
  const { addMessage, clearMessages } = useChatStore();
  const [notes, setNotes] = useState("");
  const [briefFile, setBriefFile] = useState("");
  const [breakdownData, setBreakdownData] = useState<BreakdownData | null>(null);
  const [artifactFiles, setArtifactFiles] = useState<ArtifactFile[]>([]);

  const splitComplete = stageStatuses.find((s) => s.stage === "split")?.complete ?? false;

  const loadBreakdownArtifacts = useCallback(async () => {
    if (!activeEntry?.target) return;
    try {
      const result = await window.electronAPI.readArtifacts(activeEntry.target, "split");
      if (result?.manifest) {
        setBreakdownData(manifestToBreakdownData(result.manifest as ManifestJson));
      }
      if (result?.files) {
        setArtifactFiles(result.files as ArtifactFile[]);
      }
    } catch {
      // Artifacts not available yet
    }
  }, [activeEntry?.target]);

  useEffect(() => {
    if (splitComplete) {
      loadBreakdownArtifacts();
    }
  }, [splitComplete, loadBreakdownArtifacts]);

  async function handleAbort(): Promise<void> {
    try {
      await window.electronAPI.abortStage();
    } catch {
      // Session may have already ended
    }
    endSession(false, 0, "0s", "");
    addMessage("ai", "Stage aborted by user.");
  }

  async function handleApproveBreakdown(): Promise<void> {
    if (!activeProjectName) return;
    clearMessages();
    startStage("split");
    addMessage("ai", "Splitting plan into discipline tracks...");

    try {
      const result = await window.electronAPI.runStage({
        projectName: activeProjectName,
        stage: "split",
        options: notes.trim() || briefFile
          ? { brief: notes.trim() || undefined, briefFile: briefFile || undefined }
          : undefined,
      });
      endSession(result.success, result.cost.estimatedCost, result.cost.duration, result.sessionId);
      await refreshStatus();

      if (result.success) {
        addMessage("ai", "Breakdown complete.");
        await loadBreakdownArtifacts();
      } else {
        addMessage("ai", "Breakdown failed.");
      }
    } catch (err) {
      endSession(false, 0, "0s", "");
      addMessage("ai", `Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex h-full">
      {/* Breakdown sidebar */}
      <div className="w-72 flex flex-col bg-bg-2 border-r border-border overflow-y-auto">
        <div className="p-4 space-y-3">
          <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
            MANUAL BREAKDOWN NOTES
          </div>
          <textarea
            className="w-full h-32 bg-bg text-fg text-xs font-mono px-3 py-2 rounded border border-border-2 outline-none focus:border-green/50 resize-none"
            placeholder="Add breakdown notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
            UPLOAD BREAKDOWN
          </div>
          <FileDropZone onFilePath={(path) => setBriefFile(path)} />
          {briefFile && (
            <div className="text-2xs text-fg-dim font-mono truncate" title={briefFile}>
              {briefFile}
            </div>
          )}
        </div>

        <div className="flex-1" />

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
              onClick={handleApproveBreakdown}
              className="w-full py-2.5 rounded font-bold text-sm bg-green text-bg hover:bg-green-dim transition-colors"
            >
              ▶ APPROVE BREAKDOWN
            </button>
          )}
        </div>
      </div>

      <BreakdownCanvas data={breakdownData} files={artifactFiles} />
    </div>
  );
}
