import React, { useState } from "react";
import { STAGE_ORDER } from "@proteus-forge/shared";
import type { StageName } from "@proteus-forge/shared";
import { useAgentStore } from "../../stores/agent-store.js";
import { useProjectStore } from "../../stores/project-store.js";
import { AgentActivityTree } from "../shared/AgentActivityTree.js";

const STAGE_LABELS: Record<StageName, string> = {
  inspect: "Inspection",
  design: "Design",
  plan: "Planning",
  split: "Breakdown",
  execute: "Execution",
};

function formatDuration(startTime: number, endTime?: number): string {
  if (!endTime) return "";
  const seconds = Math.round((endTime - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function LogTab(): React.JSX.Element {
  const phaseHistory = useAgentStore((s) => s.phaseHistory);
  const activeEntry = useProjectStore((s) => s.activeEntry);
  const [expandedStages, setExpandedStages] = useState<Set<StageName>>(new Set());

  function toggleStage(stage: StageName): void {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  }

  async function handleExport(): Promise<void> {
    if (!activeEntry?.target) return;
    try {
      await window.electronAPI.exportSessionLogs(activeEntry.target);
    } catch {
      // Export cancelled or failed
    }
  }

  const stagesWithLogs = STAGE_ORDER.filter((stage) => phaseHistory[stage]);
  const stagesWithoutLogs = STAGE_ORDER.filter((stage) => !phaseHistory[stage]);

  return (
    <div className="h-full flex flex-col" data-testid="log-tab">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-display text-fg">Session Logs</h2>
        <button
          onClick={handleExport}
          disabled={stagesWithLogs.length === 0}
          className="px-4 py-1.5 text-sm bg-bg-3 text-fg-dim border border-border-2 rounded hover:text-fg hover:border-fg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="export-button"
        >
          Export
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {stagesWithLogs.map((stage) => {
          const tree = phaseHistory[stage]!;
          const isExpanded = expandedStages.has(stage);
          const agentCount = tree.agents.size;
          const duration = formatDuration(tree.startTime, tree.endTime);

          return (
            <div key={stage} className="bg-bg-3 rounded-lg border border-border">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-2 transition-colors rounded-lg"
                onClick={() => toggleStage(stage)}
                data-testid={`log-stage-${stage}`}
              >
                <span className="text-fg-muted text-xs w-3">
                  {isExpanded ? "\u25bc" : "\u25b6"}
                </span>
                <span className="text-sm font-medium text-fg">
                  {STAGE_LABELS[stage]}
                </span>
                <span className="text-2xs text-fg-muted ml-auto">
                  {agentCount} agent{agentCount !== 1 ? "s" : ""}
                  {duration && `, ${duration}`}
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4">
                  <AgentActivityTree stage={stage} />
                </div>
              )}
            </div>
          );
        })}

        {stagesWithoutLogs.length > 0 && (
          <div className="text-xs text-fg-muted py-2" data-testid="no-logs-message">
            No logs for {stagesWithoutLogs.map((s) => STAGE_LABELS[s]).join(", ")}
          </div>
        )}

        {stagesWithLogs.length === 0 && (
          <div className="flex items-center justify-center h-48 text-fg-muted text-sm">
            No session logs yet. Run a stage to generate logs.
          </div>
        )}
      </div>
    </div>
  );
}
