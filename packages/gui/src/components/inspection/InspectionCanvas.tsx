import React, { useCallback } from "react";
import { STAGE_DIRS } from "@proteus-forge/shared";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
import { StatCard } from "../shared/StatCard.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";

interface InspectionData {
  filesAnalyzed: number;
  linesOfCode: number;
  issuesFound: number;
  stackDetected: string;
  findings: Array<{ severity: "critical" | "warning" | "info"; text: string }>;
  fileTree: Array<{ name: string; type: "file" | "dir"; highlight?: boolean; indent: number }>;
  artifacts: Array<{ name: string; size: string; icon: string }>;
}

interface InspectionCanvasProps {
  data: InspectionData | null;
}

export function InspectionCanvas({ data }: InspectionCanvasProps): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning && s.currentStage === "inspect");
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const activeEntry = useProjectStore((s) => s.activeEntry);
  const inspectComplete = stageStatuses.find((s) => s.stage === "inspect")?.complete ?? false;

  const badge = isRunning ? "analyzing" : inspectComplete ? "complete" : "idle";

  const handleExport = useCallback(async (filename: string) => {
    if (!activeEntry?.target) return;
    const sourcePath = `${activeEntry.target}/.proteus-forge/${STAGE_DIRS.inspect}/${filename}`;
    await window.electronAPI.saveFile(sourcePath, filename);
  }, [activeEntry]);

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <ArtifactHeader
        title="Code Inspection"
        badge={badge}
        actions={
          inspectComplete ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("features.json")}
                className="px-3 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => handleExport("inspect.md")}
                className="px-3 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber transition-colors"
              >
                Export MD
              </button>
            </div>
          ) : undefined
        }
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

        {/* Artifacts */}
        {data?.artifacts && data.artifacts.length > 0 && (
          <div className="bg-bg-3 rounded-lg border border-border p-4">
            <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">Inspection Artifacts</div>
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
            Run inspection to analyze the source codebase
          </div>
        )}

        {/* Running state */}
        {isRunning && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-fg-dim text-sm">Inspecting source codebase...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
