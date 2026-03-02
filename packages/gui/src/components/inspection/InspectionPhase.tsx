import React, { useCallback, useEffect, useState } from "react";
import { IngestSidebar } from "./IngestSidebar.js";
import { InspectionCanvas } from "./InspectionCanvas.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

interface InspectionData {
  filesAnalyzed: number;
  linesOfCode: number;
  issuesFound: number;
  stackDetected: string;
  findings: Array<{ severity: "critical" | "warning" | "info"; text: string }>;
  fileTree: Array<{ name: string; type: "file" | "dir"; highlight?: boolean; indent: number }>;
  artifacts: Array<{ name: string; size: string; icon: string }>;
}

interface FeaturesJson {
  source?: {
    primaryLanguage?: string;
    languages?: string[];
    frameworks?: string[];
    entryPoints?: string[];
  };
  features?: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    sourceFiles: string[];
    complexity: string;
  }>;
  knownIssues?: string[];
  integrations?: Array<{ name: string; type: string; status: string }>;
  summary?: string;
}

function featuresJsonToInspectionData(features: FeaturesJson): InspectionData {
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
    findings.push({ severity: "warning", text: issue });
  }

  return {
    filesAnalyzed: allSourceFiles.size,
    linesOfCode: 0,
    issuesFound: (features.knownIssues ?? []).length,
    stackDetected: stack,
    findings,
    fileTree: [],
    artifacts: [
      { name: "features.json", size: `${(features.features ?? []).length} features`, icon: "\u{1f4cb}" },
      { name: "inspect.md", size: "—", icon: "\u{1f4dd}" },
    ],
  };
}

export function InspectionPhase(): React.JSX.Element {
  const { activeEntry, activeProjectName, stageStatuses, refreshStatus } = useProjectStore();
  const { startStage, endSession } = useSessionStore();
  const { addMessage, clearMessages } = useChatStore();
  const [inspectionData, setInspectionData] = useState<InspectionData | null>(null);

  const inspectComplete = stageStatuses.find((s) => s.stage === "inspect")?.complete ?? false;

  const loadInspectionArtifacts = useCallback(async () => {
    if (!activeEntry?.target) return;
    try {
      const result = await window.electronAPI.readArtifacts(activeEntry.target, "inspect");
      if (result?.features) {
        setInspectionData(featuresJsonToInspectionData(result.features as FeaturesJson));
      }
    } catch {
      // Artifacts not available yet
    }
  }, [activeEntry?.target]);

  // Load existing artifacts on mount if inspect stage is complete
  useEffect(() => {
    if (inspectComplete) {
      loadInspectionArtifacts();
    }
  }, [inspectComplete, loadInspectionArtifacts]);

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

      endSession(result.success, result.cost.estimatedCost, result.cost.duration);
      await refreshStatus();

      if (result.success) {
        addMessage("ai", "Inspection complete. Review the findings above.");
        await loadInspectionArtifacts();
      } else {
        addMessage("ai", "Inspection failed. Check the errors above.");
      }
    } catch (err) {
      endSession(false, 0, "0s");
      addMessage("ai", `Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex h-full">
      <IngestSidebar onRunInspection={handleRunInspection} />
      <InspectionCanvas data={inspectionData} />
    </div>
  );
}
