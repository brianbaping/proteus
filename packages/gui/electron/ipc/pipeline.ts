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
  updateProject,
} from "@proteus-forge/cli/api";
import { STAGE_DIRS, STAGE_ORDER } from "@proteus-forge/shared";
import { existsSync } from "node:fs";
import { rm, unlink } from "node:fs/promises";
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

    // Read cost and sessionId from costs.json if the stage completed
    let estimatedCost = 0;
    let sessionId = "";
    if (success) {
      try {
        const active = await getActiveProject();
        if (active) {
          const costs = await readCosts(active.entry.target);
          const stageCost = costs.stages[options.stage];
          if (stageCost) {
            estimatedCost = stageCost.estimatedCost;
            sessionId = stageCost.sessionId ?? "";
          }
        }
      } catch {
        // Cost read failed — leave at defaults
      }
    }

    return { success, sessionId, cost: { estimatedCost, duration } };
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
    const targetPath = active.entry.target;

    // revertStage removes stages *after* the given stage.
    // The GUI "Destroy Phase & Revert" should also remove the current stage.
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx > 0) {
      // Revert to previous stage — removes current + downstream
      await revertStage(targetPath, STAGE_ORDER[idx - 1]);
    } else {
      // First stage (inspect) — revert downstream then remove inspect dir
      await revertStage(targetPath, stage);
      const forgeDir = join(targetPath, ".proteus-forge");
      const stageDir = join(forgeDir, STAGE_DIRS[stage]);
      if (existsSync(stageDir)) {
        await rm(stageDir, { recursive: true, force: true });
      }
      // Also remove 02-style (auto-generated side-effect of inspect)
      const styleDir = join(forgeDir, "02-style");
      if (existsSync(styleDir)) {
        await rm(styleDir, { recursive: true, force: true });
      }
    }

    // Determine the new lastCompletedStage
    const newLast = idx > 0 ? STAGE_ORDER[idx - 1] : "new";
    await updateProject(active.name, { lastCompletedStage: newLast });

    return { removed: [stage, ...STAGE_ORDER.slice(idx + 1)] };
  });
}
