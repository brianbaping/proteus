import React, { useState } from "react";
import { useProjectStore } from "../../stores/project-store.js";

interface NewProjectDialogProps {
  open: boolean;
  onClose(): void;
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps): React.JSX.Element | null {
  const { createProject } = useProjectStore();
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  async function handleBrowseSource(): Promise<void> {
    const dir = await window.electronAPI.openDirectory(source);
    if (dir) setSource(dir);
  }

  async function handleBrowseTarget(): Promise<void> {
    const dir = await window.electronAPI.openDirectory(target);
    if (dir) setTarget(dir);
  }

  async function handleCreate(): Promise<void> {
    if (!name.trim() || !source.trim()) return;
    setCreating(true);
    try {
      await createProject(name.trim(), source.trim(), target.trim() || undefined);
      setName("");
      setSource("");
      setTarget("");
      onClose();
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[480px] bg-bg-2 border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg text-fg">New Project</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg text-lg">&times;</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-2xs uppercase tracking-wider text-fg-muted">Project Name</label>
            <input
              type="text"
              className="w-full mt-1 bg-bg text-fg text-sm font-mono px-3 py-2 rounded border border-border-2 outline-none focus:border-green/50"
              placeholder="my-project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-2xs uppercase tracking-wider text-fg-muted">Source Path (POC)</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                className="flex-1 bg-bg text-fg text-sm font-mono px-3 py-2 rounded border border-border-2 outline-none focus:border-green/50"
                placeholder="/path/to/poc"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <button
                onClick={handleBrowseSource}
                className="px-3 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber"
              >
                Browse
              </button>
            </div>
          </div>

          <div>
            <label className="text-2xs uppercase tracking-wider text-fg-muted">Target Path (optional)</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                className="flex-1 bg-bg text-fg text-sm font-mono px-3 py-2 rounded border border-border-2 outline-none focus:border-green/50"
                placeholder="Auto-generated if empty"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <button
                onClick={handleBrowseTarget}
                className="px-3 py-1 text-xs border border-border-2 text-fg-dim rounded hover:text-amber"
              >
                Browse
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-border-2 text-fg-dim rounded hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !source.trim() || creating}
            className={`px-4 py-1.5 text-sm font-bold rounded transition-colors ${
              !name.trim() || !source.trim() || creating
                ? "bg-bg-3 text-fg-muted cursor-not-allowed"
                : "bg-green text-bg hover:bg-green-dim"
            }`}
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
