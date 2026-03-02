import React from "react";
import { Logo } from "./Logo.js";
import { ProjectSelector } from "./ProjectSelector.js";
import { SessionBadge } from "./SessionBadge.js";

interface TopBarProps {
  onStartNew(): void;
}

export function TopBar({ onStartNew }: TopBarProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between h-12 px-4 bg-bg-2 border-b border-border">
      <div className="flex items-center gap-4">
        <Logo />
        <div className="w-px h-5 bg-border" />
        <ProjectSelector />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onStartNew}
          className="px-3 py-1 text-sm border border-border-2 text-fg-dim rounded hover:text-amber hover:border-amber/30 transition-colors"
        >
          + Start New
        </button>
        <SessionBadge />
      </div>
    </div>
  );
}
