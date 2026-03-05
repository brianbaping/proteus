import React from "react";
import { STAGE_DIRS } from "@proteus-forge/shared";
import type { StageName } from "@proteus-forge/shared";
import { useProjectStore } from "../../stores/project-store.js";

export interface ArtifactFile {
  name: string;
  size: number;
}

interface ArtifactListProps {
  stage: StageName;
  files: ArtifactFile[];
  title: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForFile(name: string): string {
  if (name.endsWith(".json")) return "\u{1f4cb}";
  if (name.endsWith(".md")) return "\u{1f4dd}";
  if (name.endsWith(".txt")) return "\u{1f4c4}";
  return "\u{1f4c4}";
}

export function ArtifactList({ stage, files, title }: ArtifactListProps): React.JSX.Element {
  const activeEntry = useProjectStore((s) => s.activeEntry);

  function handleDoubleClick(fileName: string): void {
    if (!activeEntry?.target) return;
    const filePath = `${activeEntry.target}/.proteus-forge/${STAGE_DIRS[stage]}/${fileName}`;
    window.electronAPI.openArtifact(filePath);
  }

  if (files.length === 0) return <></>;

  return (
    <div className="bg-bg-3 rounded-lg border border-border p-4">
      <div className="text-2xs uppercase tracking-wider text-fg-muted mb-3">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {files.map((f) => (
          <div
            key={f.name}
            onDoubleClick={() => handleDoubleClick(f.name)}
            className="flex flex-col items-center p-3 bg-bg rounded-lg border border-border hover:border-green/30 cursor-pointer transition-colors"
            title={`Double-click to open: ${f.name}`}
          >
            <span className="text-2xl mb-1">{iconForFile(f.name)}</span>
            <span className="text-xs text-fg truncate w-full text-center">{f.name}</span>
            <span className="text-2xs text-fg-muted">{formatSize(f.size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
