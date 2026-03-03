import React, { useCallback } from "react";
import { STAGE_DIRS } from "@proteus-forge/shared";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
import { StalenessWarning } from "../shared/StalenessWarning.js";
import { StatCard } from "../shared/StatCard.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";

interface ServiceEntry {
  id: string;
  name: string;
  description?: string;
  discipline?: string;
  implementsFeatures?: string[];
  exposedInterfaces?: Array<{ type: string; path: string; methods?: string[] }>;
  ownedEntities?: string[];
}

interface DesignData {
  architectureStyle: string;
  framework: string;
  servicesCount: number;
  featuresMapped: number;
  targetStack: Record<string, string>;
  services: ServiceEntry[];
  artifacts: Array<{ name: string; size: string; icon: string }>;
}

interface DesignCanvasProps {
  data: DesignData | null;
}

export type { DesignData, ServiceEntry };

export function DesignCanvas({ data }: DesignCanvasProps): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning && s.currentStage === "design");
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const activeEntry = useProjectStore((s) => s.activeEntry);
  const designComplete = stageStatuses.find((s) => s.stage === "design")?.complete ?? false;

  const badge = isRunning ? "analyzing" : designComplete ? "complete" : "idle";

  const handleExport = useCallback(async (filename: string) => {
    if (!activeEntry?.target) return;
    const sourcePath = `${activeEntry.target}/.proteus-forge/${STAGE_DIRS.design}/${filename}`;
    await window.electronAPI.saveFile(sourcePath, filename);
  }, [activeEntry]);

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <ArtifactHeader
        title="Architecture Design"
        badge={badge}
        actions={
          designComplete ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("design-meta.json")}
                className="px-3 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => handleExport("design.md")}
                className="px-3 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber transition-colors"
              >
                Export MD
              </button>
            </div>
          ) : undefined
        }
      />
      <StalenessWarning stage="design" />

      <div className="p-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Architecture Style" value={data?.architectureStyle ?? "—"} />
          <StatCard label="Services" value={data?.servicesCount ?? "—"} />
          <StatCard label="Features Mapped" value={data?.featuresMapped ?? "—"} />
          <StatCard label="Framework" value={data?.framework ?? "—"} />
        </div>

        {/* Target Stack */}
        {data?.targetStack && Object.keys(data.targetStack).length > 0 && (
          <div className="bg-bg-3 rounded-lg border border-border p-4">
            <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">Target Stack</div>
            <div className="space-y-1">
              {Object.entries(data.targetStack).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-xs text-fg-muted capitalize">{key}</span>
                  <span className="text-xs text-fg font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        {data?.services && data.services.length > 0 && (
          <div className="space-y-2">
            <div className="text-2xs uppercase tracking-wider text-fg-muted">Services</div>
            {data.services.map((svc) => (
              <div key={svc.id} className="p-3 bg-bg-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-fg">{svc.name}</span>
                  {svc.discipline && (
                    <span className="px-1.5 py-0.5 text-2xs font-mono uppercase rounded bg-cyan-dark text-cyan border border-cyan/30">
                      {svc.discipline}
                    </span>
                  )}
                </div>
                {svc.description && (
                  <div className="text-xs text-fg-dim mb-2">{svc.description}</div>
                )}
                <div className="flex gap-4 text-2xs text-fg-muted">
                  {svc.implementsFeatures && (
                    <span>{svc.implementsFeatures.length} features</span>
                  )}
                  {svc.exposedInterfaces && (
                    <span>{svc.exposedInterfaces.length} interfaces</span>
                  )}
                  {svc.ownedEntities && (
                    <span>{svc.ownedEntities.length} entities</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Artifacts */}
        {data?.artifacts && data.artifacts.length > 0 && (
          <div className="bg-bg-3 rounded-lg border border-border p-4">
            <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">Design Artifacts</div>
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
            Run design to generate architecture decisions
          </div>
        )}

        {/* Running state */}
        {isRunning && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-fg-dim text-sm">Designing production architecture...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
