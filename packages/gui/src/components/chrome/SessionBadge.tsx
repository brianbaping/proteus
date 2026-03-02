import React from "react";
import { useSessionStore } from "../../stores/session-store.js";

export function SessionBadge(): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning);

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-mono uppercase tracking-wider ${
        isRunning
          ? "bg-green-dark text-green border border-green/30"
          : "bg-bg-3 text-fg-muted border border-border"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isRunning ? "bg-green animate-pulse" : "bg-fg-muted"
        }`}
      />
      {isRunning ? "ACTIVE SESSION" : "IDLE"}
    </div>
  );
}
