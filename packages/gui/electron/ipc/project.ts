import type { IpcMain } from "electron";
import { shell } from "electron";
import type { StageName } from "@proteus-forge/shared";
import {
  readRegistry,
  getActiveProject,
  setActiveProject,
  registerProject,
  unregisterProject,
  getProject,
  updateProject,
} from "@proteus-forge/cli/api";
import { getStageStatuses, checkStaleness } from "@proteus-forge/cli/api";
import { createProjectConfig, writeProjectConfig } from "@proteus-forge/cli/api";
import { STAGE_DIRS } from "@proteus-forge/shared";
import { join } from "node:path";
import { mkdir, readFile, readdir, lstat, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCb);

async function listFilesRecursive(dir: string, base: string = ""): Promise<Array<{ name: string; size: number }>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: Array<{ name: string; size: number }> = [];
  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(join(dir, entry.name), relativePath));
    } else {
      const stat = await lstat(join(dir, entry.name));
      files.push({ name: relativePath, size: stat.size });
    }
  }
  return files;
}

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
      lastCompletedStage: "new",
    });
  });

  ipcMain.handle("project:destroy", async (_event, name: string, options?: { deleteSource?: boolean }) => {
    const entry = await getProject(name);
    if (!entry) throw new Error(`Project "${name}" not found`);
    await rm(entry.target, { recursive: true, force: true });
    if (options?.deleteSource && entry.source) {
      await rm(entry.source, { recursive: true, force: true });
    }
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
    } else if (stage === "design") {
      const metaPath = join(stageDir, "design-meta.json");
      if (existsSync(metaPath)) {
        artifacts.designMeta = JSON.parse(await readFile(metaPath, "utf-8"));
      }
      const mdPath = join(stageDir, "design.md");
      if (existsSync(mdPath)) {
        artifacts.designMd = await readFile(mdPath, "utf-8");
      }
    } else if (stage === "plan") {
      const planPath = join(stageDir, "plan.json");
      if (existsSync(planPath)) {
        artifacts.plan = JSON.parse(await readFile(planPath, "utf-8"));
      }
      const planMdPath = join(stageDir, "plan.md");
      if (existsSync(planMdPath)) {
        artifacts.planMd = await readFile(planMdPath, "utf-8");
      }
    } else if (stage === "split") {
      const manifestPath = join(stageDir, "manifest.json");
      if (existsSync(manifestPath)) {
        artifacts.manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      }
    } else if (stage === "execute") {
      const sessionPath = join(stageDir, "session.json");
      if (existsSync(sessionPath)) {
        artifacts.session = JSON.parse(await readFile(sessionPath, "utf-8"));
      }
    }

    const files = await listFilesRecursive(stageDir);
    artifacts.files = files;

    return Object.keys(artifacts).length > 1 || files.length > 0 ? artifacts : null;
  });

  ipcMain.handle("project:open-artifact", async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle("project:update", async (_event, name: string, updates: { source?: string; target?: string }) => {
    await updateProject(name, updates);
  });

  ipcMain.handle("project:clone-repo", async (_event, url: string, targetDir?: string) => {
    const cloneDir = targetDir ?? await mkdtemp(join(tmpdir(), "proteus-clone-"));
    if (targetDir) {
      await mkdir(targetDir, { recursive: true });
    }
    try {
      await execFileAsync("git", ["clone", "--depth", "1", url, cloneDir], {
        shell: true,
        env: { ...process.env },
      });
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("ENOENT") || message.includes("not found")) {
        throw new Error("git is not available. Please install git and ensure it is in your PATH.");
      }
      throw new Error(`git clone failed: ${message}`, { cause: err });
    }
    return cloneDir;
  });

  ipcMain.handle("project:extract-archive", async (_event, archivePath: string, targetDir?: string) => {
    const extractDir = targetDir ?? await mkdtemp(join(tmpdir(), "proteus-extract-"));
    if (targetDir) {
      await mkdir(targetDir, { recursive: true });
    }
    const lower = archivePath.toLowerCase();

    if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
      try {
        await execFileAsync("tar", ["xzf", archivePath, "-C", extractDir], {
          shell: true,
          env: { ...process.env },
        });
      } catch (err) {
        throw new Error(`tar extraction failed: ${(err as Error).message}`, { cause: err });
      }
    } else if (lower.endsWith(".zip")) {
      try {
        await execFileAsync("unzip", ["-q", archivePath, "-d", extractDir], {
          shell: true,
          env: { ...process.env },
        });
      } catch (err) {
        throw new Error(`unzip extraction failed: ${(err as Error).message}`, { cause: err });
      }
    } else {
      throw new Error(`Unsupported archive format: ${archivePath}`);
    }

    // Single-directory unwrap: if the archive contains exactly one top-level
    // directory (common for GitHub downloads), return that directory instead
    // Only do this when extracting to a temp dir (no explicit target)
    if (!targetDir) {
      const entries = await readdir(extractDir);
      if (entries.length === 1) {
        const singleEntry = join(extractDir, entries[0]);
        const stat = await lstat(singleEntry);
        if (stat.isDirectory()) {
          return singleEntry;
        }
      }
    }

    return extractDir;
  });
}
