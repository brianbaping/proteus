import React from "react";
import { ArtifactHeader } from "../shared/ArtifactHeader.js";
import { ArtifactList } from "../shared/ArtifactList.js";
import type { ArtifactFile } from "../shared/ArtifactList.js";
import { StalenessWarning } from "../shared/StalenessWarning.js";
import { StatCard } from "../shared/StatCard.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";

interface TrackDisplay {
  id: string;
  discipline: string;
  taskCount: number;
  dependsOnTracks: string[];
  requiredByTracks: string[];
}

interface BreakdownData {
  totalTracks: number;
  totalTasks: number;
  disciplines: string[];
  tracks: TrackDisplay[];
}

interface BreakdownCanvasProps {
  data: BreakdownData | null;
  files: ArtifactFile[];
}

export type { BreakdownData, TrackDisplay };

const DISCIPLINE_COLORS: Record<string, string> = {
  shared: "bg-purple-dark text-purple border-purple/30",
  data: "bg-cyan-dark text-cyan border-cyan/30",
  backend: "bg-green-dark text-green border-green/30",
  frontend: "bg-amber-dark text-amber border-amber/30",
  devops: "bg-red-dark text-red border-red/30",
  qa: "bg-cyan-dark text-cyan border-cyan/30",
};

export function BreakdownCanvas({ data, files }: BreakdownCanvasProps): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning && s.currentStage === "split");
  const stageStatuses = useProjectStore((s) => s.stageStatuses);
  const splitComplete = stageStatuses.find((s) => s.stage === "split")?.complete ?? false;

  const badge = isRunning ? "analyzing" : splitComplete ? "complete" : "idle";

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <ArtifactHeader
        title="Roadmap Break Down"
        badge={badge}
      />
      <StalenessWarning stage="split" />

      <div className="p-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Tracks" value={data?.totalTracks ?? "—"} />
          <StatCard label="Total Tasks" value={data?.totalTasks ?? "—"} />
          <StatCard label="Disciplines" value={data?.disciplines.length ?? "—"} />
        </div>

        {/* Track cards */}
        {data?.tracks && data.tracks.length > 0 && (
          <div className="space-y-2">
            <div className="text-2xs uppercase tracking-wider text-fg-muted">Tracks</div>
            {data.tracks.map((track) => (
              <div key={track.id} className="p-3 bg-bg-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-fg capitalize">{track.discipline}</span>
                  <span className={`px-1.5 py-0.5 text-2xs font-mono uppercase rounded border ${
                    DISCIPLINE_COLORS[track.discipline] ?? "bg-bg-3 text-fg-muted border-border"
                  }`}>
                    {track.discipline}
                  </span>
                  <span className="text-2xs text-fg-muted ml-auto">{track.taskCount} tasks</span>
                </div>
                <div className="flex flex-wrap gap-3 text-2xs text-fg-muted">
                  {track.dependsOnTracks.length > 0 && (
                    <span>depends on: {track.dependsOnTracks.join(", ")}</span>
                  )}
                  {track.requiredByTracks.length > 0 && (
                    <span>required by: {track.requiredByTracks.join(", ")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Artifacts */}
        <ArtifactList stage="split" files={files} title="Breakdown Artifacts" />

        {/* Empty state */}
        {!data && !isRunning && (
          <div className="flex items-center justify-center h-64 text-fg-muted text-sm">
            Approve breakdown to partition plan into discipline-specific tracks
          </div>
        )}

        {/* Running state */}
        {isRunning && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-fg-dim text-sm">Splitting into tracks...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
