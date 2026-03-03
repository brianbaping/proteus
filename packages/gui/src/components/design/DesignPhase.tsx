import React, { useCallback, useEffect, useState } from "react";
import { FileDropZone } from "../shared/FileDropZone.js";
import { DesignCanvas } from "./DesignCanvas.js";
import type { DesignData, ServiceEntry } from "./DesignCanvas.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

interface DesignMetaJson {
  architectureStyle?: string;
  targetStack?: Record<string, string>;
  services?: Array<{
    id: string;
    name: string;
    description?: string;
    discipline?: string;
    implementsFeatures?: string[];
    exposedInterfaces?: Array<{ type: string; path: string; methods?: string[] }>;
    ownedEntities?: string[];
  }>;
  featureToServiceMap?: Record<string, string>;
}

function designMetaToDesignData(meta: DesignMetaJson, hasMd: boolean): DesignData {
  const services: ServiceEntry[] = (meta.services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    discipline: s.discipline,
    implementsFeatures: s.implementsFeatures,
    exposedInterfaces: s.exposedInterfaces,
    ownedEntities: s.ownedEntities,
  }));

  const featureCount = Object.keys(meta.featureToServiceMap ?? {}).length;
  const stack = meta.targetStack ?? {};

  const artifacts = [
    { name: "design-meta.json", size: `${services.length} services`, icon: "\u{1f4cb}" },
  ];
  if (hasMd) {
    artifacts.push({ name: "design.md", size: "—", icon: "\u{1f4dd}" });
  }

  return {
    architectureStyle: meta.architectureStyle ?? "Unknown",
    framework: stack.framework ?? "—",
    servicesCount: services.length,
    featuresMapped: featureCount,
    targetStack: stack,
    services,
    artifacts,
  };
}

export function DesignPhase(): React.JSX.Element {
  const { activeEntry, activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { isRunning, startStage, endSession } = useSessionStore();
  const { addMessage, clearMessages } = useChatStore();
  const [brief, setBrief] = useState("");
  const [briefFile, setBriefFile] = useState("");
  const [excludeStyle, setExcludeStyle] = useState(false);
  const [designData, setDesignData] = useState<DesignData | null>(null);

  const designComplete = stageStatuses.find((s) => s.stage === "design")?.complete ?? false;

  const loadDesignArtifacts = useCallback(async () => {
    if (!activeEntry?.target) return;
    try {
      const result = await window.electronAPI.readArtifacts(activeEntry.target, "design");
      if (result?.designMeta) {
        setDesignData(designMetaToDesignData(
          result.designMeta as DesignMetaJson,
          typeof result.designMd === "string",
        ));
      }
    } catch {
      // Artifacts not available yet
    }
  }, [activeEntry?.target]);

  useEffect(() => {
    if (designComplete) {
      loadDesignArtifacts();
    }
  }, [designComplete, loadDesignArtifacts]);

  async function handleAbort(): Promise<void> {
    try {
      await window.electronAPI.abortStage();
    } catch {
      // Session may have already ended
    }
    endSession(false, 0, "0s");
    addMessage("ai", "Stage aborted by user.");
  }

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

      if (result.success) {
        addMessage("ai", "Design complete.");
        await loadDesignArtifacts();
      } else {
        addMessage("ai", "Design failed.");
      }
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
          {isRunning ? (
            <button
              onClick={handleAbort}
              className="w-full py-2.5 rounded font-bold text-sm bg-red text-bg hover:bg-red/80 transition-colors"
            >
              ⏹ STOP
            </button>
          ) : (
            <button
              onClick={handleRunDesign}
              className="w-full py-2.5 rounded font-bold text-sm bg-green text-bg hover:bg-green-dim transition-colors"
            >
              ▶ RUN DESIGN
            </button>
          )}
        </div>
      </div>

      <DesignCanvas data={designData} />
    </div>
  );
}
