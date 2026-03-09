import type { IpcMain } from "electron";
import { BrowserWindow, dialog } from "electron";
import { copyFile } from "node:fs/promises";

export function registerDialogHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("dialog:open-directory", async (_event, defaultPath?: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showOpenDialog(win!, {
      properties: ["openDirectory"],
      defaultPath,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:open-file", async (_event, filters?: Array<{ name: string; extensions: string[] }>) => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showOpenDialog(win!, {
      properties: ["openFile"],
      filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:save-file", async (_event, sourcePath: string, defaultName: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: defaultName,
      filters: [{ name: "All Files", extensions: ["*"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await copyFile(sourcePath, result.filePath);
    return result.filePath;
  });
}
