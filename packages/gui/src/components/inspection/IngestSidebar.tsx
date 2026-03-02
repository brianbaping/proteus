import React, { useState } from "react";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { FileDropZone } from "../shared/FileDropZone.js";

interface IngestSidebarProps {
  onRunInspection(options: { excludeStyle?: boolean }): void;
}

export function IngestSidebar({ onRunInspection }: IngestSidebarProps): React.JSX.Element {
  const { activeEntry } = useProjectStore();
  const { isRunning } = useSessionStore();
  const [ingestMethod, setIngestMethod] = useState<"upload" | "github">("upload");
  const [pocPath, setPocPath] = useState(activeEntry?.source ?? "");
  const [targetPath, setTargetPath] = useState(activeEntry?.target ?? "");
  const [excludeStyle, setExcludeStyle] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");

  async function handleBrowsePoc(): Promise<void> {
    const dir = await window.electronAPI.openDirectory();
    if (dir) setPocPath(dir);
  }

  async function handleBrowseTarget(): Promise<void> {
    const dir = await window.electronAPI.openDirectory();
    if (dir) setTargetPath(dir);
  }

  async function handleCloneRepo(): Promise<void> {
    if (!githubUrl.trim()) return;
    setCloning(true);
    setCloneError("");
    try {
      const clonedPath = await window.electronAPI.cloneRepo(githubUrl.trim());
      setPocPath(clonedPath);
      setIngestMethod("upload");
    } catch (err) {
      setCloneError((err as Error).message);
    } finally {
      setCloning(false);
    }
  }

  return (
    <div className="w-80 flex flex-col bg-bg-2 border-r border-border overflow-y-auto">
      {/* Ingest method selection */}
      <div className="p-4 space-y-3">
        <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
          CODE SOURCE
        </div>

        <button
          onClick={() => setIngestMethod("upload")}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            ingestMethod === "upload"
              ? "border-green/30 bg-green-dark"
              : "border-border-2 bg-bg-3 hover:border-border-2"
          }`}
        >
          <div className="text-sm font-bold text-fg">Upload Archive</div>
          <div className="text-2xs text-fg-dim mt-0.5">.zip or .tar.gz of your POC</div>
        </button>

        <button
          onClick={() => setIngestMethod("github")}
          className={`w-full text-left p-3 rounded-lg border transition-colors ${
            ingestMethod === "github"
              ? "border-green/30 bg-green-dark"
              : "border-border-2 bg-bg-3 hover:border-border-2"
          }`}
        >
          <div className="text-sm font-bold text-fg">GitHub Repo</div>
          <div className="text-2xs text-fg-dim mt-0.5">Clone from GitHub URL</div>
        </button>

        {ingestMethod === "upload" && (
          <FileDropZone
            onFilePath={(path) => setPocPath(path)}
            accept=".zip or .tar.gz"
            label="Drop archive or click to browse POC folder"
          />
        )}

        {ingestMethod === "github" && (
          <div className="space-y-2">
            <input
              type="text"
              className="w-full bg-bg text-fg text-xs font-mono px-2 py-1.5 rounded border border-border-2 outline-none focus:border-green/50"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
            <button
              onClick={handleCloneRepo}
              disabled={cloning || !githubUrl.trim()}
              className={`w-full py-1.5 rounded text-xs font-bold transition-colors ${
                cloning || !githubUrl.trim()
                  ? "bg-bg-3 text-fg-muted cursor-not-allowed"
                  : "bg-amber text-bg hover:bg-amber-dim"
              }`}
            >
              {cloning ? "Cloning..." : "Clone Repository"}
            </button>
            {cloneError && (
              <div className="text-2xs text-red">{cloneError}</div>
            )}
          </div>
        )}
      </div>

      {/* Path inputs */}
      <div className="p-4 space-y-3">
        <div className="text-2xs uppercase tracking-wider text-fg-muted border-b border-border pb-2">
          PRODUCTION CANDIDATE FOLDER
        </div>

        <div>
          <label className="text-2xs uppercase tracking-wider text-fg-muted">POC Repo Path</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              className="flex-1 bg-bg text-fg text-xs font-mono px-2 py-1.5 rounded border border-border-2 outline-none focus:border-green/50"
              value={pocPath}
              onChange={(e) => setPocPath(e.target.value)}
              placeholder="/projects/my-poc"
            />
            <button
              onClick={handleBrowsePoc}
              className="px-2 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber"
            >
              Browse
            </button>
          </div>
        </div>

        <div>
          <label className="text-2xs uppercase tracking-wider text-fg-muted">Candidate Repo Path</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              className="flex-1 bg-bg text-fg text-xs font-mono px-2 py-1.5 rounded border border-border-2 outline-none focus:border-green/50"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="/projects/my-prod"
            />
            <button
              onClick={handleBrowseTarget}
              className="px-2 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber"
            >
              Browse
            </button>
          </div>
          <div className="mt-1 p-2 bg-bg rounded text-2xs text-fg-muted">
            Generated production artifacts will be written to this folder at the end of each phase.
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-fg-dim">Exclude UI/Style</span>
          <button
            onClick={() => setExcludeStyle(!excludeStyle)}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              excludeStyle ? "bg-amber" : "bg-bg-3 border border-border-2"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                excludeStyle ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Run button */}
      <div className="p-4">
        <button
          onClick={() => onRunInspection({ excludeStyle })}
          disabled={isRunning}
          className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${
            isRunning
              ? "bg-bg-3 text-fg-muted cursor-not-allowed"
              : "bg-green text-bg hover:bg-green-dim"
          }`}
        >
          {isRunning ? "Running..." : "\u25b6 RUN INSPECTION"}
        </button>
      </div>
    </div>
  );
}
