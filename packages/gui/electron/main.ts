import { app, BrowserWindow, Menu, ipcMain, nativeImage } from "electron";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { registerProjectHandlers } from "./ipc/project.js";
import { registerPipelineHandlers } from "./ipc/pipeline.js";
import { registerDialogHandlers } from "./ipc/dialog.js";
import { registerSessionLogHandlers } from "./ipc/session-log.js";
import type { IpcChannel, GlobalConfig } from "@proteus-forge/shared";

const ZOOM_MIN = -3;
const ZOOM_MAX = 5;

let mainWindow: BrowserWindow | null = null;

function clampZoom(level: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(level)));
}

const CONFIG_PATH = path.join(app.getPath("home"), ".proteus-forge", "config.json");

function persistZoomLevel(level: number): void {
  readFile(CONFIG_PATH, "utf-8")
    .then((content) => {
      const config = JSON.parse(content) as GlobalConfig;
      config.zoomLevel = level;
      return writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
    })
    .catch(() => { /* fire-and-forget */ });
}

function applyZoom(delta: number): void {
  if (!mainWindow) return;
  const current = mainWindow.webContents.getZoomLevel();
  const next = clampZoom(current + delta);
  mainWindow.webContents.setZoomLevel(next);
  persistZoomLevel(next);
}

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
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            mainWindow?.webContents.setZoomLevel(0);
            persistZoomLevel(0);
          },
        },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+=",
          click: () => applyZoom(1),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => applyZoom(-1),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const iconPath = path.join(__dirname, "..", "..", "build", "icon-256.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: "#0a0c0e",
    icon: nativeImage.createFromPath(iconPath),
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

app.whenReady().then(async () => {
  registerProjectHandlers(ipcMain);
  registerPipelineHandlers(ipcMain, getMainWindow);
  registerDialogHandlers(ipcMain);
  registerSessionLogHandlers(ipcMain);

  // Zoom IPC handlers
  ipcMain.handle("zoom:get" satisfies IpcChannel, () => {
    return mainWindow?.webContents.getZoomLevel() ?? 0;
  });
  ipcMain.handle("zoom:set" satisfies IpcChannel, (_event, level: number) => {
    const clamped = clampZoom(level);
    mainWindow?.webContents.setZoomLevel(clamped);
    persistZoomLevel(clamped);
  });

  buildMenu();
  createWindow();

  // Restore persisted zoom level and theme
  try {
    if (existsSync(CONFIG_PATH)) {
      const content = await readFile(CONFIG_PATH, "utf-8");
      const config = JSON.parse(content) as GlobalConfig;
      if (config.zoomLevel != null && mainWindow) {
        mainWindow.webContents.setZoomLevel(clampZoom(config.zoomLevel));
      }
      if (config.theme && mainWindow) {
        const theme = config.theme.replace(/[^a-z0-9-]/gi, "");
        mainWindow.webContents.executeJavaScript(
          `document.documentElement.setAttribute("data-theme","${theme}");localStorage.setItem("proteus-theme","${theme}");`
        ).catch(() => {});
      }
    }
  } catch { /* ignore missing config */ }

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
