import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getForgeDir, ensureForgeDir } from "./global.js";
import type { ProjectRegistry, ProjectEntry } from "./types.js";

const REGISTRY_PATH = join(getForgeDir(), "projects.json");

function getDefaultRegistry(): ProjectRegistry {
  return {
    activeProject: null,
    projects: {},
  };
}

export async function readRegistry(): Promise<ProjectRegistry> {
  if (!existsSync(REGISTRY_PATH)) {
    return getDefaultRegistry();
  }
  const content = await readFile(REGISTRY_PATH, "utf-8");
  return JSON.parse(content) as ProjectRegistry;
}

export async function writeRegistry(registry: ProjectRegistry): Promise<void> {
  await ensureForgeDir();
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
}

export async function registerProject(
  name: string,
  entry: ProjectEntry
): Promise<void> {
  const registry = await readRegistry();
  registry.projects[name] = entry;
  registry.activeProject = name;
  await writeRegistry(registry);
}

export async function unregisterProject(name: string): Promise<void> {
  const registry = await readRegistry();
  delete registry.projects[name];
  if (registry.activeProject === name) {
    const remaining = Object.keys(registry.projects);
    registry.activeProject = remaining.length > 0 ? remaining[0] : null;
  }
  await writeRegistry(registry);
}

export async function setActiveProject(name: string): Promise<void> {
  const registry = await readRegistry();
  if (!registry.projects[name]) {
    throw new Error(`Project "${name}" not found. Run \`proteus-forge list\` to see available projects.`);
  }
  registry.activeProject = name;
  await writeRegistry(registry);
}

export async function getActiveProject(): Promise<{
  name: string;
  entry: ProjectEntry;
} | null> {
  const registry = await readRegistry();
  if (!registry.activeProject || !registry.projects[registry.activeProject]) {
    return null;
  }
  return {
    name: registry.activeProject,
    entry: registry.projects[registry.activeProject],
  };
}

export async function getProject(
  name: string
): Promise<ProjectEntry | null> {
  const registry = await readRegistry();
  return registry.projects[name] ?? null;
}
