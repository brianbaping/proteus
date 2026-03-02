import React, { useState } from "react";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
import { FileDropZone } from "../shared/FileDropZone.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

export function PlanningPhase(): React.JSX.Element {
  const { activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { isRunning, startStage, endSession } = useSessionStore();
  const { addMessage, clearMessages } = useChatStore();
  const [notes, setNotes] = useState("");
  const [briefFile, setBriefFile] = useState("");

  const planComplete = stageStatuses.find((s) => s.stage === "plan")?.complete ?? false;
  const badge = isRunning && useSessionStore.getState().currentStage === "plan"
    ? "analyzing" : planComplete ? "complete" : "idle";

  async function handleApprovePlan(): Promise<void> {
    if (!activeProjectName) return;
    clearMessages();
    startStage("plan");
    addMessage("ai", "Generating execution plan...");

    try {
      const result = await window.electronAPI.runStage({
        projectName: activeProjectName,
        stage: "plan",
        options: notes.trim() || briefFile
          ? { brief: notes.trim() || undefined, briefFile: briefFile || undefined }
          : undefined,
      });
      endSession(result.success, result.cost.estimatedCost, result.cost.duration);
      await refreshStatus();
      addMessage("ai", result.success ? "Plan generated." : "Plan failed.");
    } catch (err) {
      endSession(false, 0, "0s");
      addMessage("ai", `Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex h-full">
      {/* Planning sidebar */}
      <div className="w-72 flex flex-col bg-bg-2 border-r border-border overflow-y-auto">
        <div className="p-4 space-y-3">
          <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
            MANUAL PLAN NOTES
          </div>
          <textarea
            className="w-full h-32 bg-bg text-fg text-xs font-mono px-3 py-2 rounded border border-border-2 outline-none focus:border-green/50 resize-none"
            placeholder="Add planning notes or constraints..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
            UPLOAD PLAN
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
          <button
            onClick={handleApprovePlan}
            disabled={isRunning}
            className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${
              isRunning ? "bg-bg-3 text-fg-muted cursor-not-allowed" : "bg-green text-bg hover:bg-green-dim"
            }`}
          >
            {isRunning ? "Running..." : "\u25b6 APPROVE PLAN"}
          </button>
        </div>
      </div>

      {/* Planning content */}
      <div className="flex-1 overflow-y-auto bg-bg">
        <ArtifactHeader title="Milestone Roadmap" badge={badge} />
        <div className="p-4">
          {!planComplete && !isRunning && (
            <div className="flex items-center justify-center h-64 text-fg-muted text-sm">
              Approve plan to generate task DAG with execution waves
            </div>
          )}
          {isRunning && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-fg-dim text-sm">Generating execution plan...</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
