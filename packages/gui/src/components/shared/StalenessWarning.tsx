import React from "react";
import type { StageName } from "@proteus-forge/shared";
import { useProjectStore } from "../../stores/project-store.js";

interface StalenessWarningProps {
  stage: StageName;
}

export function StalenessWarning({ stage }: StalenessWarningProps): React.JSX.Element | null {
  const staleness = useProjectStore((s) => s.staleness);
  const entry = staleness.find((e) => e.stage === stage);

  if (!entry) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-dark border-b border-amber/30 text-amber text-xs">
      <span className="font-mono uppercase tracking-wider text-2xs shrink-0">Stale</span>
      <span>{entry.staleReason}</span>
    </div>
  );
}
