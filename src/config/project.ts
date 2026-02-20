import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectConfig } from "./types.js";

export function getProjectForgeDir(targetPath: string): string {
  return join(targetPath, ".proteus-forge");
}

export function getProjectConfigPath(targetPath: string): string {
  return join(targetPath, ".proteus-forge", "config.json");
}

export async function ensureProjectDir(targetPath: string): Promise<void> {
  const forgeDir = getProjectForgeDir(targetPath);
  if (!existsSync(forgeDir)) {
    await mkdir(forgeDir, { recursive: true });
  }
}

export async function readProjectConfig(
  targetPath: string
): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath(targetPath);
  if (!existsSync(configPath)) {
    return null;
  }
  const content = await readFile(configPath, "utf-8");
  return JSON.parse(content) as ProjectConfig;
}

export async function writeProjectConfig(
  targetPath: string,
  config: ProjectConfig
): Promise<void> {
  await ensureProjectDir(targetPath);
  const configPath = getProjectConfigPath(targetPath);
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function createProjectConfig(
  name: string,
  sourcePath: string
): ProjectConfig {
  return {
    forgeVersion: "1.0.0",
    projectName: name,
    source: {
      path: sourcePath,
      readonly: true,
    },
  };
}
