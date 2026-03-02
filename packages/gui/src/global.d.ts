import type { ElectronAPI } from "../electron/preload.js";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
