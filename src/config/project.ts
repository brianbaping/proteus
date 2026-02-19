import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ProjectConfig } from "./types.js";

export function getProjectProteusDir(targetPath: string): string {
  return join(targetPath, ".proteus");
}

export function getProjectConfigPath(targetPath: string): string {
  return join(targetPath, ".proteus", "config.json");
}

export async function ensureProjectDir(targetPath: string): Promise<void> {
  const proteusDir = getProjectProteusDir(targetPath);
  if (!existsSync(proteusDir)) {
    await mkdir(proteusDir, { recursive: true });
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
    proteusVersion: "1.0.0",
    projectName: name,
    source: {
      path: sourcePath,
      readonly: true,
    },
  };
}
