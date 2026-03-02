import React from "react";
import { useProjectStore } from "../../stores/project-store.js";

export function ProgressBar(): React.JSX.Element {
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const completedCount = stageStatuses.filter((s) => s.complete).length;
  const widthPercent = (completedCount / 5) * 100;

  return (
    <div className="h-[2px] w-full bg-border">
      <div
        className="h-full bg-gradient-to-r from-green to-amber transition-all duration-500"
        style={{ width: `${widthPercent}%` }}
      />
    </div>
  );
}
