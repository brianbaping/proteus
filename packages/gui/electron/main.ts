import { app, BrowserWindow, Menu, ipcMain } from "electron";
import path from "node:path";
import { registerProjectHandlers } from "./ipc/project.js";
import { registerPipelineHandlers } from "./ipc/pipeline.js";
import { registerDialogHandlers } from "./ipc/dialog.js";

let mainWindow: BrowserWindow | null = null;

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        {
          label: "Toggle Developer Tools",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: "#0a0c0e",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

app.whenReady().then(() => {
  registerProjectHandlers(ipcMain);
  registerPipelineHandlers(ipcMain, getMainWindow);
  registerDialogHandlers(ipcMain);

  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
