import React, { useState } from "react";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { FileDropZone } from "../shared/FileDropZone.js";

interface IngestSidebarProps {
  onRunInspection(options: { excludeStyle?: boolean }): void;
  onAbort(): void;
}

export function IngestSidebar({ onRunInspection, onAbort }: IngestSidebarProps): React.JSX.Element {
  const { activeEntry, activeProjectName, updateProject } = useProjectStore();
  const { isRunning } = useSessionStore();
  const [ingestMethod, setIngestMethod] = useState<"upload" | "github">("upload");
  const [pocPath, setPocPath] = useState(activeEntry?.source ?? "");
  const [targetPath, setTargetPath] = useState(activeEntry?.target ?? "");
  const [excludeStyle, setExcludeStyle] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");

  async function persistPaths(updates: { source?: string; target?: string }): Promise<void> {
    if (!activeProjectName) return;
    try {
      await updateProject(activeProjectName, updates);
    } catch {
      // Silent — user sees correct paths locally, can retry
    }
  }

  function handlePocBlur(): void {
    if (pocPath !== (activeEntry?.source ?? "")) {
      persistPaths({ source: pocPath });
    }
  }

  function handleTargetBlur(): void {
    if (targetPath !== (activeEntry?.target ?? "")) {
      persistPaths({ target: targetPath });
    }
  }

  async function handleBrowsePoc(): Promise<void> {
    const dir = await window.electronAPI.openDirectory();
    if (dir) {
      setPocPath(dir);
      await persistPaths({ source: dir });
    }
  }

  async function handleBrowseTarget(): Promise<void> {
    const dir = await window.electronAPI.openDirectory();
    if (dir) {
      setTargetPath(dir);
      await persistPaths({ target: dir });
    }
  }

  async function handleCloneRepo(): Promise<void> {
    if (!githubUrl.trim()) return;
    setCloning(true);
    setCloneError("");
    try {
      const clonedPath = await window.electronAPI.cloneRepo(githubUrl.trim());
      setPocPath(clonedPath);
      setIngestMethod("upload");
      await persistPaths({ source: clonedPath });
    } catch (err) {
      setCloneError((err as Error).message);
    } finally {
      setCloning(false);
    }
  }

  function isArchivePath(path: string): boolean {
    const lower = path.toLowerCase();
    return lower.endsWith(".zip") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz");
  }

  async function handleFileDrop(path: string): Promise<void> {
    if (!isArchivePath(path)) {
      setPocPath(path);
      await persistPaths({ source: path });
      return;
    }

    setExtracting(true);
    setExtractError("");
    try {
      const extractedPath = await window.electronAPI.extractArchive(path);
      setPocPath(extractedPath);
      await persistPaths({ source: extractedPath });
    } catch (err) {
      setExtractError((err as Error).message);
    } finally {
      setExtracting(false);
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
          <>
            <FileDropZone
              onFilePath={handleFileDrop}
              accept=".zip or .tar.gz"
              label="Drop archive or click to browse POC folder"
            />
            {extracting && (
              <div className="text-2xs text-amber">Extracting archive...</div>
            )}
            {extractError && (
              <div className="text-2xs text-red">{extractError}</div>
            )}
          </>
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
              onBlur={handlePocBlur}
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
              onBlur={handleTargetBlur}
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

      {/* Run / Stop button */}
      <div className="p-4">
        {isRunning ? (
          <button
            onClick={onAbort}
            className="w-full py-2.5 rounded font-bold text-sm bg-red text-bg hover:bg-red/80 transition-colors"
          >
            ⏹ STOP
          </button>
        ) : (
          <button
            onClick={() => onRunInspection({ excludeStyle })}
            className="w-full py-2.5 rounded font-bold text-sm bg-green text-bg hover:bg-green-dim transition-colors"
          >
            ▶ RUN INSPECTION
          </button>
        )}
      </div>
    </div>
  );
}
