import React, { useCallback, useEffect, useState } from "react";
import { IngestSidebar } from "./IngestSidebar.js";
import { InspectionCanvas, type InspectionData } from "./InspectionCanvas.js";
import type { ArtifactFile } from "../shared/ArtifactList.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

interface FeaturesJson {
  source?: {
    primaryLanguage?: string;
    languages?: string[];
    frameworks?: string[];
    entryPoints?: string[];
    totalLines?: number;
    fileTree?: Array<{ path: string; type: "file" | "dir" }>;
  };
  features?: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    sourceFiles: string[];
    complexity: string;
  }>;
  knownIssues?: Array<string | { severity?: string; category?: string; description?: string }>;
  integrations?: Array<{ name: string; type: string; status: string }>;
  summary?: string;
}

export function featuresJsonToInspectionData(features: FeaturesJson): InspectionData {
  const allSourceFiles = new Set<string>();
  for (const feat of features.features ?? []) {
    for (const f of feat.sourceFiles ?? []) {
      allSourceFiles.add(f);
    }
  }

  const frameworks = features.source?.frameworks ?? [];
  const languages = features.source?.languages ?? [];
  const stack = [...frameworks, ...languages].slice(0, 3).join(", ") || "Unknown";

  const findings: InspectionData["findings"] = [];
  for (const issue of features.knownIssues ?? []) {
    if (typeof issue === "string") {
      findings.push({ severity: "warning", text: issue });
    } else {
      const severity = issue.severity === "high" ? "critical"
        : issue.severity === "low" ? "info"
        : "warning";
      findings.push({ severity, text: issue.description ?? "Unknown issue" });
    }
  }

  const fileTree: InspectionData["fileTree"] = (features.source?.fileTree ?? []).map((entry) => {
    const segments = entry.path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? entry.path;
    return {
      name: entry.type === "dir" ? `${lastSegment}/` : lastSegment,
      type: entry.type,
      indent: segments.length - 1,
    };
  });

  return {
    filesAnalyzed: allSourceFiles.size,
    linesOfCode: features.source?.totalLines ?? 0,
    issuesFound: (features.knownIssues ?? []).length,
    stackDetected: stack,
    findings,
    fileTree,
  };
}

export function InspectionPhase(): React.JSX.Element {
  const { activeEntry, activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { startStage, endSession } = useSessionStore();
  const { addMessage, clearMessages } = useChatStore();
  const [inspectionData, setInspectionData] = useState<InspectionData | null>(null);
  const [artifactFiles, setArtifactFiles] = useState<ArtifactFile[]>([]);

  const inspectComplete = stageStatuses.find((s) => s.stage === "inspect")?.complete ?? false;

  const loadInspectionArtifacts = useCallback(async () => {
    if (!activeEntry?.target) return;
    try {
      const result = await window.electronAPI.readArtifacts(activeEntry.target, "inspect");
      if (result?.features) {
        setInspectionData(featuresJsonToInspectionData(result.features as FeaturesJson));
      }
      if (result?.files) {
        setArtifactFiles(result.files as ArtifactFile[]);
      }
    } catch {
      // Artifacts not available yet
    }
  }, [activeEntry?.target]);

  // Load existing artifacts on mount if inspect stage is complete
  useEffect(() => {
    if (inspectComplete) {
      loadInspectionArtifacts();
    } else {
      setInspectionData(null);
      setArtifactFiles([]);
    }
  }, [inspectComplete, loadInspectionArtifacts]);

  async function handleAbort(): Promise<void> {
    try {
      await window.electronAPI.abortStage();
    } catch {
      // Session may have already ended
    }
    endSession(false, 0, "0s", "");
    addMessage("ai", "Stage aborted by user.");
  }

  async function handleRunInspection(options: { excludeStyle?: boolean }): Promise<void> {
    if (!activeProjectName) return;

    clearMessages();
    startStage("inspect");
    addMessage("ai", "Starting inspection of source codebase...");

    try {
      const result = await window.electronAPI.runStage({
        projectName: activeProjectName,
        stage: "inspect",
        options: { excludeStyle: options.excludeStyle },
      });

      endSession(result.success, result.cost.estimatedCost, result.cost.duration, result.sessionId);
      await refreshStatus();

      if (result.success) {
        addMessage("ai", "Inspection complete. Review the findings above.");
        await loadInspectionArtifacts();
      } else {
        addMessage("ai", "Inspection failed. Check the errors above.");
      }
    } catch (err) {
      endSession(false, 0, "0s", "");
      addMessage("ai", `Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex h-full">
      <IngestSidebar onRunInspection={handleRunInspection} onAbort={handleAbort} />
      <InspectionCanvas data={inspectionData} files={artifactFiles} />
    </div>
  );
}
