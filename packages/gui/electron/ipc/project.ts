import type { IpcMain } from "electron";
import type { StageName } from "@proteus-forge/shared";
import {
  readRegistry,
  getActiveProject,
  setActiveProject,
  registerProject,
  unregisterProject,
  getProject,
} from "@proteus-forge/cli/api";
import { getStageStatuses, checkStaleness } from "@proteus-forge/cli/api";
import { createProjectConfig, writeProjectConfig } from "@proteus-forge/cli/api";
import { STAGE_DIRS } from "@proteus-forge/shared";
import { join } from "node:path";
import { mkdir, readFile, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("project:list", async () => {
    return readRegistry();
  });

  ipcMain.handle("project:get-active", async () => {
    return getActiveProject();
  });

  ipcMain.handle("project:set-active", async (_event, name: string) => {
    await setActiveProject(name);
  });

  ipcMain.handle("project:create", async (_event, name: string, source: string, target?: string) => {
    const targetPath = target ?? join(source, "..", `${name}-prod`);
    await mkdir(targetPath, { recursive: true });

    const config = createProjectConfig(name, source);
    await writeProjectConfig(targetPath, config);
    await registerProject(name, {
      source,
      target: targetPath,
      createdAt: new Date().toISOString(),
      currentStage: "new",
    });
  });

  ipcMain.handle("project:destroy", async (_event, name: string) => {
    const entry = await getProject(name);
    if (!entry) throw new Error(`Project "${name}" not found`);
    await unregisterProject(name);
  });

  ipcMain.handle("project:status", async (_event, targetPath: string) => {
    const statuses = getStageStatuses(targetPath);
    const staleness = checkStaleness(targetPath);
    return { statuses, staleness };
  });

  ipcMain.handle("project:read-artifacts", async (_event, targetPath: string, stage: StageName) => {
    const stageDir = join(targetPath, ".proteus-forge", STAGE_DIRS[stage]);
    if (!existsSync(stageDir)) return null;

    const artifacts: Record<string, unknown> = {};

    if (stage === "inspect") {
      const featuresPath = join(stageDir, "features.json");
      if (existsSync(featuresPath)) {
        artifacts.features = JSON.parse(await readFile(featuresPath, "utf-8"));
      }
    } else if (stage === "split") {
      const manifestPath = join(stageDir, "manifest.json");
      if (existsSync(manifestPath)) {
        artifacts.manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      }
    }

    return Object.keys(artifacts).length > 0 ? artifacts : null;
  });

  ipcMain.handle("project:clone-repo", async (_event, url: string) => {
    const targetDir = await mkdtemp(join(tmpdir(), "proteus-clone-"));
    return new Promise<string>((resolve, reject) => {
      execFile("git", ["clone", "--depth", "1", url, targetDir], (error) => {
        if (error) reject(new Error(`git clone failed: ${error.message}`));
        else resolve(targetDir);
      });
    });
  });
}
