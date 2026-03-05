import React from "react";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
import { ArtifactList } from "../shared/ArtifactList.js";
import type { ArtifactFile } from "../shared/ArtifactList.js";
import { StalenessWarning } from "../shared/StalenessWarning.js";
import { StatCard } from "../shared/StatCard.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";

interface TaskEntry {
  id: string;
  title: string;
  discipline?: string;
  estimatedComplexity?: string;
  testingExpectation?: string;
  dependsOn?: string[];
}

interface WaveEntry {
  wave: number;
  tasks: string[];
  rationale?: string;
}

interface PlanData {
  totalTasks: number;
  waveCount: number;
  criticalPathLength: number;
  disciplines: string[];
  waves: Array<WaveEntry & { taskDetails: TaskEntry[] }>;
  criticalPath: string[];
}

interface PlanningCanvasProps {
  data: PlanData | null;
  files: ArtifactFile[];
}

export type { PlanData, TaskEntry, WaveEntry };

const COMPLEXITY_STYLES: Record<string, string> = {
  low: "bg-green-dark text-green border-green/30",
  medium: "bg-amber-dark text-amber border-amber/30",
  high: "bg-red-dark text-red border-red/30",
};

const TESTING_STYLES: Record<string, string> = {
  unit: "bg-cyan-dark text-cyan border-cyan/30",
  integration: "bg-purple-dark text-purple border-purple/30",
  none: "bg-bg-3 text-fg-muted border-border",
};

export function PlanningCanvas({ data, files }: PlanningCanvasProps): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning && s.currentStage === "plan");
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const planComplete = stageStatuses.find((s) => s.stage === "plan")?.complete ?? false;

  const badge = isRunning ? "analyzing" : planComplete ? "complete" : "idle";

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <ArtifactHeader
        title="Milestone Roadmap"
        badge={badge}
      />
      <StalenessWarning stage="plan" />

      <div className="p-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Tasks" value={data?.totalTasks ?? "—"} />
          <StatCard label="Execution Waves" value={data?.waveCount ?? "—"} />
          <StatCard label="Critical Path" value={data?.criticalPathLength ?? "—"} />
          <StatCard label="Disciplines" value={data?.disciplines.length ?? "—"} />
        </div>

        {/* Waves timeline */}
        {data?.waves && data.waves.length > 0 && (
          <div className="space-y-3">
            <div className="text-2xs uppercase tracking-wider text-fg-muted">Execution Waves</div>
            {data.waves.map((wave) => (
              <div key={wave.wave} className="bg-bg-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-fg">Wave {wave.wave}</span>
                  <span className="text-2xs text-fg-muted">{wave.tasks.length} tasks</span>
                </div>
                {wave.rationale && (
                  <div className="text-xs text-fg-dim mb-3">{wave.rationale}</div>
                )}
                <div className="space-y-1">
                  {wave.taskDetails.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 py-1 px-2 rounded bg-bg">
                      <span className="text-2xs font-mono text-fg-muted w-16 shrink-0">{task.id}</span>
                      <span className="text-xs text-fg flex-1 truncate">{task.title}</span>
                      {task.discipline && (
                        <span className="px-1.5 py-0.5 text-2xs font-mono uppercase rounded bg-cyan-dark text-cyan border border-cyan/30 shrink-0">
                          {task.discipline}
                        </span>
                      )}
                      {task.estimatedComplexity && (
                        <span className={`px-1.5 py-0.5 text-2xs font-mono uppercase rounded border shrink-0 ${
                          COMPLEXITY_STYLES[task.estimatedComplexity] ?? COMPLEXITY_STYLES.medium
                        }`}>
                          {task.estimatedComplexity}
                        </span>
                      )}
                      {task.testingExpectation && (
                        <span className={`px-1.5 py-0.5 text-2xs font-mono uppercase rounded border shrink-0 ${
                          TESTING_STYLES[task.testingExpectation] ?? TESTING_STYLES.none
                        }`}>
                          {task.testingExpectation}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Critical path */}
        {data?.criticalPath && data.criticalPath.length > 0 && (
          <div className="bg-bg-3 rounded-lg border border-border p-4">
            <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">Critical Path</div>
            <div className="flex flex-wrap items-center gap-1">
              {data.criticalPath.map((taskId, i) => (
                <React.Fragment key={taskId}>
                  <span className="px-2 py-0.5 text-2xs font-mono rounded bg-amber-dark text-amber border border-amber/30">
                    {taskId}
                  </span>
                  {i < data.criticalPath.length - 1 && (
                    <span className="text-fg-muted text-xs">{"\u2192"}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Artifacts */}
        <ArtifactList stage="plan" files={files} title="Plan Artifacts" />

        {/* Empty state */}
        {!data && !isRunning && (
          <div className="flex items-center justify-center h-64 text-fg-muted text-sm">
            Approve plan to generate task DAG with execution waves
          </div>
        )}

        {/* Running state */}
        {isRunning && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-fg-dim text-sm">Generating execution plan...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
