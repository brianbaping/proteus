import type { IpcMain } from "electron";
import { dialog } from "electron";
import { copyFile } from "node:fs/promises";

export function registerDialogHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("dialog:open-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:open-file", async (_event, filters?: Array<{ name: string; extensions: string[] }>) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:save-file", async (_event, sourcePath: string, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: "All Files", extensions: ["*"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await copyFile(sourcePath, result.filePath);
    return result.filePath;
  });
}
