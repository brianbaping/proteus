import type { IpcMain } from "electron";
import { BrowserWindow, dialog } from "electron";
import type { IpcChannel, StageName } from "@proteus-forge/shared";
import { STAGE_DIRS, STAGE_ORDER } from "@proteus-forge/shared";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

interface SerializedAgentTree {
  agents: Array<[string, unknown]>;
  rootIds: string[];
  startTime: number;
  endTime?: number;
}

export function registerSessionLogHandlers(ipcMain: IpcMain): void {
  // Save one stage's session log
  ipcMain.handle(
    "session-log:save" satisfies IpcChannel,
    async (_event, targetPath: string, stage: StageName, tree: SerializedAgentTree) => {
      const stageDir = STAGE_DIRS[stage];
      const dir = join(targetPath, ".proteus-forge", stageDir);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      const filePath = join(dir, "session-log.json");
      await writeFile(filePath, JSON.stringify(tree, null, 2), "utf-8");
    },
  );

  // Read all stages' session logs for a project
  ipcMain.handle(
    "session-log:read" satisfies IpcChannel,
    async (_event, targetPath: string) => {
      const result: Partial<Record<StageName, SerializedAgentTree>> = {};
      for (const stage of STAGE_ORDER) {
        const stageDir = STAGE_DIRS[stage];
        const filePath = join(targetPath, ".proteus-forge", stageDir, "session-log.json");
        if (existsSync(filePath)) {
          try {
            const raw = await readFile(filePath, "utf-8");
            result[stage] = JSON.parse(raw) as SerializedAgentTree;
          } catch {
            // Skip corrupted files
          }
        }
      }
      return result;
    },
  );

  // Export combined session logs via save dialog
  ipcMain.handle(
    "session-log:export" satisfies IpcChannel,
    async (_event, targetPath: string) => {
      const win = BrowserWindow.getFocusedWindow();
      const dialogResult = await dialog.showSaveDialog(win ?? undefined as never, {
        title: "Export Session Logs",
        defaultPath: "session-logs.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (dialogResult.canceled || !dialogResult.filePath) return null;

      // Read all logs
      const combined: Record<string, SerializedAgentTree> = {};
      for (const stage of STAGE_ORDER) {
        const stageDir = STAGE_DIRS[stage];
        const filePath = join(targetPath, ".proteus-forge", stageDir, "session-log.json");
        if (existsSync(filePath)) {
          try {
            const raw = await readFile(filePath, "utf-8");
            combined[stage] = JSON.parse(raw) as SerializedAgentTree;
          } catch {
            // Skip
          }
        }
      }

      await writeFile(dialogResult.filePath, JSON.stringify(combined, null, 2), "utf-8");
      return dialogResult.filePath;
    },
  );

  // Export chat messages via save dialog
  ipcMain.handle(
    "chat:export" satisfies IpcChannel,
    async (_event, messages: Array<{ sender: string; agentName?: string; text: string; timestamp: number }>) => {
      const win = BrowserWindow.getFocusedWindow();
      const dialogResult = await dialog.showSaveDialog(win ?? undefined as never, {
        title: "Export Chat Log",
        defaultPath: "chat-log.txt",
        filters: [{ name: "Text", extensions: ["txt"] }],
      });
      if (dialogResult.canceled || !dialogResult.filePath) return null;

      const lines = messages.map((m) => {
        const time = new Date(m.timestamp).toISOString();
        const who = m.sender === "user" ? "you" : (m.agentName ?? "agent");
        return `[${time}] ${who}: ${m.text}`;
      });

      await writeFile(dialogResult.filePath, lines.join("\n"), "utf-8");
      return dialogResult.filePath;
    },
  );
}
