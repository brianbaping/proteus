import React from "react";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
import { ArtifactList } from "../shared/ArtifactList.js";
import type { ArtifactFile } from "../shared/ArtifactList.js";
import { AgentActivityTree } from "../shared/AgentActivityTree.js";
import { StatCard } from "../shared/StatCard.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useAgentStore } from "../../stores/agent-store.js";

export interface InspectionData {
  filesAnalyzed: number;
  linesOfCode: number;
  issuesFound: number;
  stackDetected: string;
  findings: Array<{ severity: "critical" | "warning" | "info"; text: string }>;
  fileTree: Array<{ name: string; type: "file" | "dir"; highlight?: boolean; indent: number }>;
}

interface InspectionCanvasProps {
  data: InspectionData | null;
  files: ArtifactFile[];
}

export function InspectionCanvas({ data, files }: InspectionCanvasProps): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning && s.currentStage === "inspect");
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const inspectComplete = stageStatuses.find((s) => s.stage === "inspect")?.complete ?? false;

  const badge = isRunning ? "analyzing" : inspectComplete ? "complete" : "idle";

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <ArtifactHeader
        title="Code Inspection"
        badge={badge}
      />

      <div className="p-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Files Analyzed" value={data?.filesAnalyzed ?? "—"} />
          <StatCard label="Lines of Code" value={data?.linesOfCode?.toLocaleString() ?? "—"} />
          <StatCard label="Issues Found" value={data?.issuesFound ?? "—"} />
          <StatCard label="Stack Detected" value={data?.stackDetected ?? "—"} />
        </div>

        {/* File tree */}
        {data?.fileTree && data.fileTree.length > 0 && (
          <div className="bg-bg-3 rounded-lg border border-border p-4">
            <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">File Structure</div>
            <div className="space-y-0.5 font-mono text-xs">
              {data.fileTree.map((item, i) => (
                <div
                  key={i}
                  className={`py-0.5 ${item.highlight ? "text-amber" : "text-fg-dim"}`}
                  style={{ paddingLeft: `${item.indent * 16}px` }}
                >
                  <span className="text-fg-muted mr-1">
                    {item.type === "dir" ? "\u{1f4c1}" : "\u{1f4c4}"}
                  </span>
                  {item.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Findings */}
        {data?.findings && data.findings.length > 0 && (
          <div className="space-y-2">
            <div className="text-2xs uppercase tracking-wider text-fg-muted">Findings</div>
            {data.findings.map((f, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-bg-3 rounded-lg border border-border">
                <span
                  className={`px-1.5 py-0.5 text-2xs font-bold uppercase rounded ${
                    f.severity === "critical"
                      ? "bg-red-dark text-red"
                      : f.severity === "warning"
                        ? "bg-amber-dark text-amber"
                        : "bg-green-dark text-green"
                  }`}
                >
                  {f.severity}
                </span>
                <span className="text-xs text-fg-dim">{f.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Agent activity during run */}
        {isRunning && <AgentActivityTree stage="inspect" />}

        {/* Artifacts */}
        <ArtifactList stage="inspect" files={files} title="Inspection Artifacts" />

        {/* Session log after run */}
        {!isRunning && <AgentActivityTree stage="inspect" collapsed />}

        {/* Empty state */}
        {!data && !isRunning && !useAgentStore.getState().phaseHistory.inspect && (
          <div className="flex items-center justify-center h-64 text-fg-muted text-sm">
            Run inspection to analyze the source codebase
          </div>
        )}
      </div>
    </div>
  );
}
