import React, { useState } from "react";
import { useProjectStore } from "../../stores/project-store.js";

interface DestroyDialogProps {
  projectName: string;
  sourcePath: string | undefined;
  onConfirm(deleteSource: boolean): void;
  onCancel(): void;
}

function DestroyDialog({ projectName, sourcePath, onConfirm, onCancel }: DestroyDialogProps): React.JSX.Element {
  const [deleteSource, setDeleteSource] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="destroy-dialog">
      <div className="w-[420px] bg-bg-2 border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-lg text-red">Destroy Project</h2>
          <button onClick={onCancel} className="text-fg-muted hover:text-fg text-lg">&times;</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-fg">
            Destroy <span className="font-bold text-fg">&quot;{projectName}&quot;</span>?
          </p>
          <p className="text-xs text-fg-dim">
            This will delete the target directory and remove the project from the registry. This cannot be undone.
          </p>

          {sourcePath && (
            <label className="flex items-start gap-3 p-3 rounded border border-border bg-bg-3 cursor-pointer hover:border-red/30 transition-colors">
              <input
                type="checkbox"
                checked={deleteSource}
                onChange={(e) => setDeleteSource(e.target.checked)}
                className="mt-0.5 accent-red"
                data-testid="delete-source-toggle"
              />
              <div>
                <span className="text-xs text-fg">Also delete POC source folder</span>
                <span className="block text-2xs text-fg-muted font-mono mt-0.5 break-all">{sourcePath}</span>
              </div>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm border border-border-2 text-fg-dim rounded hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(deleteSource)}
            className="px-4 py-1.5 text-sm font-bold rounded bg-red-dark text-red border border-red/30 hover:bg-red/20 transition-colors"
            data-testid="destroy-confirm"
          >
            Destroy
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectSelector(): React.JSX.Element {
  const { registry, activeProjectName, activeEntry, setActiveProject, destroyProject } = useProjectStore();
  const [showDestroyDialog, setShowDestroyDialog] = useState(false);

  const projectNames = registry ? Object.keys(registry.projects) : [];

  async function handleDestroyConfirm(deleteSource: boolean): Promise<void> {
    if (!activeProjectName) return;
    setShowDestroyDialog(false);
    await destroyProject(activeProjectName, { deleteSource });
  }

  if (projectNames.length === 0) {
    return (
      <span className="text-fg-dim text-sm">No projects</span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-fg-muted text-2xs uppercase tracking-wider">Project:</span>
        <select
          className="bg-transparent text-fg text-sm font-bold border-none outline-none cursor-pointer"
          value={activeProjectName ?? ""}
          onChange={(e) => setActiveProject(e.target.value)}
        >
          {projectNames.map((name) => (
            <option key={name} value={name} className="bg-bg-2 text-fg">
              {name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowDestroyDialog(true)}
          title="Destroy project"
          className="text-fg-muted hover:text-red transition-colors text-xs leading-none"
        >
          &#x2715;
        </button>
      </div>
      {showDestroyDialog && activeProjectName && (
        <DestroyDialog
          projectName={activeProjectName}
          sourcePath={activeEntry?.source}
          onConfirm={handleDestroyConfirm}
          onCancel={() => setShowDestroyDialog(false)}
        />
      )}
    </>
  );
}
