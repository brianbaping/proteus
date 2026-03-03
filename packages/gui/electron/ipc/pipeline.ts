import type { IpcMain, BrowserWindow } from "electron";
import type { ProgressReporter, StageRunOptions, GlobalConfig } from "@proteus-forge/shared";
import type { StageName } from "@proteus-forge/shared";
import {
  runInspect,
  runDesign,
  runPlan,
  runSplit,
  runExecute,
  readGlobalConfig,
  writeGlobalConfig,
  readCosts,
  writeInboxMessage,
  getInboxDir,
  getActiveProject,
  revertStage,
} from "@proteus-forge/cli/api";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { GuiDashboard } from "../gui-dashboard.js";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function createIpcReporter(getWindow: () => BrowserWindow | null): ProgressReporter {
  return {
    log: (msg) => getWindow()?.webContents.send("reporter:log", msg),
    warn: (msg) => getWindow()?.webContents.send("reporter:warn", msg),
    error: (msg) => getWindow()?.webContents.send("reporter:error", msg),
  };
}

export function registerPipelineHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle("stage:run", async (_event, options: StageRunOptions) => {
    const reporter = createIpcReporter(getMainWindow);
    const dashboard = new GuiDashboard(getMainWindow);

    const stageOpts = options.options ?? {};
    const name = options.projectName;

    let success = false;
    const startTime = Date.now();

    switch (options.stage) {
      case "inspect":
        success = await runInspect(name, stageOpts, reporter, dashboard.onMessage);
        break;
      case "design":
        success = await runDesign(name, stageOpts, reporter, dashboard.onMessage);
        break;
      case "plan":
        success = await runPlan(name, stageOpts, reporter, dashboard.onMessage);
        break;
      case "split":
        success = await runSplit(name, stageOpts, reporter, dashboard.onMessage);
        break;
      case "execute":
        success = await runExecute(name, stageOpts, reporter, dashboard.onMessage);
        break;
    }

    const elapsedMs = Date.now() - startTime;
    const duration = formatDuration(elapsedMs);

    // Read cost from costs.json if the stage completed
    let estimatedCost = 0;
    if (success) {
      try {
        const active = await getActiveProject();
        if (active) {
          const costs = await readCosts(active.entry.target);
          const stageCost = costs.stages[options.stage];
          if (stageCost) {
            estimatedCost = stageCost.estimatedCost;
          }
        }
      } catch {
        // Cost read failed — leave at 0
      }
    }

    return { success, sessionId: "", cost: { estimatedCost, duration } };
  });

  ipcMain.handle("stage:abort", async () => {
    const active = await getActiveProject();
    if (!active) throw new Error("No active project");

    const targetPath = active.entry.target;
    const sentinelPath = join(getInboxDir(targetPath), ".active");

    if (!existsSync(sentinelPath)) {
      throw new Error("No active execute session found. Nothing to abort.");
    }

    // Remove sentinel — inbox watcher stops on next poll
    try {
      await unlink(sentinelPath);
    } catch {
      // Already gone
    }

    // Write abort message so the Lead sees it
    await writeInboxMessage(
      targetPath,
      "lead",
      "USER ABORT: The user has requested an immediate stop. Shut down all teammates and clean up the team. Do not start any new tasks.",
    );
  });

  ipcMain.handle("session:send-message", async (_event, targetAgent: string, message: string) => {
    const active = await getActiveProject();
    if (!active) throw new Error("No active project");
    await writeInboxMessage(active.entry.target, targetAgent, message);
  });

  ipcMain.handle("config:read-global", async () => {
    return readGlobalConfig();
  });

  ipcMain.handle("config:write-global", async (_event, config: GlobalConfig) => {
    await writeGlobalConfig(config);
  });

  ipcMain.handle("costs:read", async (_event, targetPath: string) => {
    return readCosts(targetPath);
  });

  ipcMain.handle("stage:revert", async (_event, stage: StageName) => {
    const active = await getActiveProject();
    if (!active) throw new Error("No active project");
    return revertStage(active.entry.target, stage);
  });
}
