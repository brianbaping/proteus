import React, { useCallback, useEffect, useState } from "react";
import { FileDropZone } from "../shared/FileDropZone.js";
import { PlanningCanvas } from "./PlanningCanvas.js";
import type { PlanData, TaskEntry } from "./PlanningCanvas.js";
import type { ArtifactFile } from "../shared/ArtifactList.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

interface PlanJson {
  tasks?: Array<{
    id: string;
    title: string;
    discipline?: string;
    estimatedComplexity?: string;
    testingExpectation?: string;
    dependsOn?: string[];
  }>;
  executionWaves?: Array<{
    wave: number;
    tasks: string[];
    rationale?: string;
  }>;
  criticalPath?: string[];
}

function planJsonToPlanData(plan: PlanJson): PlanData {
  const tasks = plan.tasks ?? [];
  const waves = plan.executionWaves ?? [];
  const criticalPath = plan.criticalPath ?? [];
  const taskMap = new Map<string, TaskEntry>(tasks.map((t) => [t.id, t]));

  const disciplines = [...new Set(tasks.map((t) => t.discipline).filter(Boolean) as string[])];

  const waveDetails = waves.map((w) => ({
    ...w,
    taskDetails: w.tasks.map((id) => taskMap.get(id) ?? { id, title: id }).map((t) => ({
      id: t.id,
      title: t.title,
      discipline: t.discipline,
      estimatedComplexity: t.estimatedComplexity,
      testingExpectation: t.testingExpectation,
      dependsOn: t.dependsOn,
    })),
  }));

  return {
    totalTasks: tasks.length,
    waveCount: waves.length,
    criticalPathLength: criticalPath.length,
    disciplines,
    waves: waveDetails,
    criticalPath,
  };
}

export function PlanningPhase(): React.JSX.Element {
  const { activeEntry, activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { isRunning, startStage, endSession, completedStages } = useSessionStore();
  const phaseCompleted = completedStages.includes("plan");
  const { addMessage, clearMessages } = useChatStore();
  const [notes, setNotes] = useState("");
  const [briefFile, setBriefFile] = useState("");
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [artifactFiles, setArtifactFiles] = useState<ArtifactFile[]>([]);

  const planComplete = stageStatuses.find((s) => s.stage === "plan")?.complete ?? false;

  const loadPlanArtifacts = useCallback(async () => {
    if (!activeEntry?.target) return;
    try {
      const result = await window.electronAPI.readArtifacts(activeEntry.target, "plan");
      if (result?.plan) {
        setPlanData(planJsonToPlanData(result.plan as PlanJson));
      }
      if (result?.files) {
        setArtifactFiles(result.files as ArtifactFile[]);
      }
    } catch {
      // Artifacts not available yet
    }
  }, [activeEntry?.target]);

  useEffect(() => {
    if (planComplete) {
      loadPlanArtifacts();
    }
  }, [planComplete, loadPlanArtifacts]);

  async function handleAbort(): Promise<void> {
    try {
      await window.electronAPI.abortStage();
    } catch {
      // Session may have already ended
    }
    endSession(false, 0, "0s", "");
    addMessage("ai", "Stage aborted by user.");
  }

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
      endSession(result.success, result.cost.estimatedCost, result.cost.duration, result.sessionId);
      await refreshStatus();

      if (result.success) {
        addMessage("ai", "Plan generated.");
        await loadPlanArtifacts();
      } else {
        addMessage("ai", "Plan failed.");
      }
    } catch (err) {
      endSession(false, 0, "0s", "");
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
          {isRunning ? (
            <button
              onClick={handleAbort}
              className="w-full py-2.5 rounded font-bold text-sm bg-red text-bg hover:bg-red/80 transition-colors"
            >
              ⏹ STOP
            </button>
          ) : (
            <button
              onClick={handleApprovePlan}
              disabled={phaseCompleted}
              className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${
                phaseCompleted
                  ? "bg-green text-bg opacity-50 cursor-not-allowed"
                  : "bg-green text-bg hover:bg-green-dim"
              }`}
            >
              ▶ APPROVE PLAN
            </button>
          )}
        </div>
      </div>

      <PlanningCanvas data={planData} files={artifactFiles} />
    </div>
  );
}
