import React from "react";
interface ArtifactHeaderProps {
  title: string;
  badge: "complete" | "analyzing" | "draft" | "idle";
  actions?: React.ReactNode;
}

const BADGE_STYLES = {
  complete: "bg-green-dark text-green border-green/30",
  analyzing: "bg-amber-dark text-amber border-amber/30",
  draft: "bg-cyan-dark text-cyan border-cyan/30",
  idle: "bg-bg-3 text-fg-muted border-border",
};

const BADGE_LABELS = {
  complete: "COMPLETE",
  analyzing: "IN PROGRESS",
  draft: "DRAFT",
  idle: "IDLE",
};

export function ArtifactHeader({ title, badge, actions }: ArtifactHeaderProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl text-fg">{title}</h2>
        <span
          className={`px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded border ${BADGE_STYLES[badge]}`}
        >
          {BADGE_LABELS[badge]}
        </span>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
