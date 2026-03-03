import React from "react";
import { Logo } from "./Logo.js";
import { ProjectSelector } from "./ProjectSelector.js";
import { SessionBadge } from "./SessionBadge.js";

interface TopBarProps {
  onStartNew(): void;
  onOpenSettings(): void;
}

export function TopBar({ onStartNew, onOpenSettings }: TopBarProps): React.JSX.Element {
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
        <button
          onClick={onOpenSettings}
          className="px-2 py-1 text-sm text-fg-muted hover:text-fg transition-colors"
          aria-label="Settings"
          data-testid="settings-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <SessionBadge />
      </div>
    </div>
  );
}
