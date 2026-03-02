import React from "react";
import { useProjectStore } from "../../stores/project-store.js";

export function ProjectSelector(): React.JSX.Element {
  const { registry, activeProjectName, setActiveProject } = useProjectStore();

  const projectNames = registry ? Object.keys(registry.projects) : [];

  if (projectNames.length === 0) {
    return (
      <span className="text-fg-dim text-sm">No projects</span>
    );
  }

  return (
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
    </div>
  );
}
