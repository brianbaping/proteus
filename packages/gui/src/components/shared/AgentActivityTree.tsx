import React, { useState } from "react";
import type { StageName } from "@proteus-forge/shared";
import { useAgentStore } from "../../stores/agent-store.js";
import { AgentNodeRow } from "./AgentNodeRow.js";

interface AgentActivityTreeProps {
  stage: StageName;
  collapsed?: boolean;
}

export function AgentActivityTree({ stage, collapsed: startCollapsed }: AgentActivityTreeProps): React.JSX.Element {
  const currentTree = useAgentStore((s) => s.currentTree);
  const currentStage = useAgentStore((s) => s.currentStage);
  const historyTree = useAgentStore((s) => s.phaseHistory[stage]);

  const tree = (currentStage === stage ? currentTree : null) ?? historyTree;
  const [expanded, setExpanded] = useState(!startCollapsed);

  if (!tree) {
    return <div />;
  }

  if (startCollapsed) {
    return (
      <div className="bg-bg-3 rounded-lg border border-border">
        <button
          type="button"
          className="w-full flex items-center gap-2 px-4 py-2 text-left"
          onClick={() => setExpanded(!expanded)}
          data-testid="session-log-toggle"
        >
          <span className="text-fg-muted text-2xs w-3">
            {expanded ? "\u25bc" : "\u25b6"}
          </span>
          <span className="text-2xs uppercase tracking-wider text-fg-muted">
            Session Log
          </span>
          <span className="text-2xs text-fg-muted ml-auto">
            {tree.agents.size} agent{tree.agents.size !== 1 ? "s" : ""}
          </span>
        </button>
        {expanded && (
          <div className="px-4 pb-3">
            {renderTree(tree)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="agent-activity-tree">
      {renderTree(tree)}
    </div>
  );
}

function renderTree(tree: { agents: Map<string, import("../../stores/agent-store.js").AgentNode>; rootIds: string[] }): React.JSX.Element {
  return (
    <div className="space-y-1">
      {tree.rootIds.map((id) => {
        const node = tree.agents.get(id);
        if (!node) return null;
        return (
          <AgentNodeRow
            key={id}
            node={node}
          />
        );
      })}
    </div>
  );
}
