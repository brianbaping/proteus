import React, { useState, useEffect, useRef } from "react";
import type { AgentNode } from "../../stores/agent-store.js";

interface AgentNodeRowProps {
  node: AgentNode;
}

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  spawned: { label: "spawned", className: "bg-amber-dark text-amber" },
  active: { label: "active", className: "bg-green-dark text-green" },
  done: { label: "done", className: "bg-bg-3 text-fg-muted" },
};

export function AgentNodeRow({ node }: AgentNodeRowProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(node.status === "done");
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (node.status === "done") {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [node.status]);

  useEffect(() => {
    if (node.status !== "done") {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - node.startTime);
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    setElapsed((node.endTime ?? Date.now()) - node.startTime);
    return undefined;
  }, [node.status, node.startTime, node.endTime]);

  const badge = STATUS_BADGE[node.status] ?? STATUS_BADGE.spawned;

  return (
    <div className="bg-bg-3 rounded border border-border mb-1">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
        onClick={() => setCollapsed(!collapsed)}
        data-testid={`agent-row-${node.id}`}
      >
        <span className="text-fg-muted text-2xs w-3">
          {collapsed ? "\u25b6" : "\u25bc"}
        </span>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: node.color }}
        />
        <span
          className="text-xs font-bold shrink-0"
          style={{ color: node.color }}
        >
          {node.name}
        </span>
        <span className={`px-1.5 py-0.5 text-2xs rounded ${badge.className}`}>
          {badge.label}
        </span>
        <span className="ml-auto text-2xs text-fg-muted font-mono">
          {formatElapsed(elapsed)}
        </span>
      </button>

      {!collapsed && node.messages.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {node.messages.map((msg, i) => (
            <div key={i} className="flex gap-2 text-xs font-mono">
              {msg.tool && (
                <span className="text-cyan text-2xs shrink-0">{msg.tool}</span>
              )}
              <span className={
                msg.type === "error" ? "text-red" :
                msg.type === "warn" ? "text-amber" :
                "text-fg-dim"
              }>
                {msg.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
