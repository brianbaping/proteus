import { getActiveProject, getProject } from "../config/registry.js";
import type { ProjectEntry } from "../config/types.js";

export interface ResolvedProject {
  name: string;
  entry: ProjectEntry;
}

export async function resolveProject(
  nameArg?: string
): Promise<ResolvedProject> {
  if (nameArg) {
    const entry = await getProject(nameArg);
    if (!entry) {
      throw new Error(
        `Project "${nameArg}" not found. Run \`proteus-forge list\` to see available projects.`
      );
    }
    return { name: nameArg, entry };
  }

  const active = await getActiveProject();
  if (!active) {
    throw new Error(
      "No active project set. Run `proteus-forge use <name>` or pass a project name."
    );
  }
  return active;
}
