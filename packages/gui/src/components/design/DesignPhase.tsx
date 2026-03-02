import React, { useState } from "react";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
import { FileDropZone } from "../shared/FileDropZone.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

export function DesignPhase(): React.JSX.Element {
  const { activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { isRunning, startStage, endSession } = useSessionStore();
  const { addMessage, clearMessages } = useChatStore();
  const [brief, setBrief] = useState("");
  const [briefFile, setBriefFile] = useState("");
  const [excludeStyle, setExcludeStyle] = useState(false);

  const designComplete = stageStatuses.find((s) => s.stage === "design")?.complete ?? false;
  const badge = isRunning && useSessionStore.getState().currentStage === "design"
    ? "analyzing" : designComplete ? "complete" : "idle";

  async function handleRunDesign(): Promise<void> {
    if (!activeProjectName) return;
    clearMessages();
    startStage("design");
    addMessage("ai", "Starting design phase...");

    try {
      const result = await window.electronAPI.runStage({
        projectName: activeProjectName,
        stage: "design",
        options: {
          brief: brief || undefined,
          briefFile: briefFile || undefined,
          excludeStyle: excludeStyle || undefined,
        },
      });
      endSession(result.success, result.cost.estimatedCost, result.cost.duration);
      await refreshStatus();
      addMessage("ai", result.success ? "Design complete." : "Design failed.");
    } catch (err) {
      endSession(false, 0, "0s");
      addMessage("ai", `Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex h-full">
      {/* Design sidebar */}
      <div className="w-72 flex flex-col bg-bg-2 border-r border-border overflow-y-auto">
        <div className="p-4 space-y-3">
          <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
            MANUAL BRIEF
          </div>
          <textarea
            className="w-full h-32 bg-bg text-fg text-xs font-mono px-3 py-2 rounded border border-border-2 outline-none focus:border-green/50 resize-none"
            placeholder="Describe your architectural requirements..."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />

          <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
            UPLOAD BRIEF
          </div>
          <FileDropZone onFilePath={(path) => setBriefFile(path)} />
          {briefFile && (
            <div className="text-2xs text-fg-dim font-mono truncate" title={briefFile}>
              {briefFile}
            </div>
          )}

          <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
            OPTIONS
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-dim">Exclude UI</span>
            <button
              onClick={() => setExcludeStyle(!excludeStyle)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                excludeStyle ? "bg-amber" : "bg-bg-3 border border-border-2"
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                excludeStyle ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </button>
          </div>
        </div>

        <div className="flex-1" />

        <div className="p-4">
          <button
            onClick={handleRunDesign}
            disabled={isRunning}
            className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${
              isRunning ? "bg-bg-3 text-fg-muted cursor-not-allowed" : "bg-green text-bg hover:bg-green-dim"
            }`}
          >
            {isRunning ? "Running..." : "\u25b6 RUN DESIGN"}
          </button>
        </div>
      </div>

      {/* Design content */}
      <div className="flex-1 overflow-y-auto bg-bg">
        <ArtifactHeader title="Architecture Design" badge={badge} />
        <div className="p-4">
          {!designComplete && !isRunning && (
            <div className="flex items-center justify-center h-64 text-fg-muted text-sm">
              Run design to generate architecture decisions
            </div>
          )}
          {isRunning && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-fg-dim text-sm">Designing production architecture...</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
