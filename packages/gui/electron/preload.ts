import { contextBridge, ipcRenderer } from "electron";
import type { IpcChannel, StageRunOptions, StageName } from "@proteus-forge/shared";
import type { ProjectRegistry, GlobalConfig, StageStatus, CostTracking } from "@proteus-forge/shared";

export interface ElectronAPI {
  // Project management
  listProjects(): Promise<ProjectRegistry>;
  getActiveProject(): Promise<{ name: string; entry: { source: string; target: string; createdAt: string; currentStage: string } } | null>;
  setActiveProject(name: string): Promise<void>;
  createProject(name: string, source: string, target?: string): Promise<void>;
  destroyProject(name: string): Promise<void>;
  getProjectStatus(targetPath: string): Promise<{ statuses: StageStatus[]; staleness: Array<{ stage: string; staleReason: string }> }>;
  readArtifacts(targetPath: string, stage: StageName): Promise<Record<string, unknown> | null>;
  updateProject(name: string, updates: { source?: string; target?: string }): Promise<void>;

  // Config
  readGlobalConfig(): Promise<GlobalConfig | null>;

  // Pipeline
  runStage(options: StageRunOptions): Promise<{ success: boolean; sessionId: string; cost: { estimatedCost: number; duration: string } }>;
  abortStage(): Promise<void>;

  // Session events (subscription)
  onSessionEvent(callback: (event: unknown) => void): () => void;
  onReporterLog(callback: (message: string) => void): () => void;
  onReporterWarn(callback: (message: string) => void): () => void;
  onReporterError(callback: (message: string) => void): () => void;

  // Chat / Inbox
  sendMessage(targetAgent: string, message: string): Promise<void>;

  // Costs
  readCosts(targetPath: string): Promise<CostTracking>;

  // Dialogs
  openDirectory(): Promise<string | null>;
  openFile(filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null>;
  saveFile(sourcePath: string, defaultName: string): Promise<string | null>;

  // Git
  cloneRepo(url: string): Promise<string>;
}

const electronAPI: ElectronAPI = {
  // Project management
  listProjects: () => ipcRenderer.invoke("project:list" satisfies IpcChannel),
  getActiveProject: () => ipcRenderer.invoke("project:get-active" satisfies IpcChannel),
  setActiveProject: (name) => ipcRenderer.invoke("project:set-active" satisfies IpcChannel, name),
  createProject: (name, source, target) => ipcRenderer.invoke("project:create" satisfies IpcChannel, name, source, target),
  destroyProject: (name) => ipcRenderer.invoke("project:destroy" satisfies IpcChannel, name),
  getProjectStatus: (targetPath) => ipcRenderer.invoke("project:status" satisfies IpcChannel, targetPath),
  readArtifacts: (targetPath, stage) => ipcRenderer.invoke("project:read-artifacts" satisfies IpcChannel, targetPath, stage),
  updateProject: (name, updates) => ipcRenderer.invoke("project:update" satisfies IpcChannel, name, updates),

  // Config
  readGlobalConfig: () => ipcRenderer.invoke("config:read-global" satisfies IpcChannel),

  // Pipeline
  runStage: (options) => ipcRenderer.invoke("stage:run" satisfies IpcChannel, options),
  abortStage: () => ipcRenderer.invoke("stage:abort" satisfies IpcChannel),

  // Session events (subscription)
  onSessionEvent: (callback) => {
    const handler = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("session:event" satisfies IpcChannel, handler);
    return () => ipcRenderer.removeListener("session:event" satisfies IpcChannel, handler);
  },
  onReporterLog: (callback) => {
    const handler = (_event: unknown, msg: string) => callback(msg);
    ipcRenderer.on("reporter:log" satisfies IpcChannel, handler);
    return () => ipcRenderer.removeListener("reporter:log" satisfies IpcChannel, handler);
  },
  onReporterWarn: (callback) => {
    const handler = (_event: unknown, msg: string) => callback(msg);
    ipcRenderer.on("reporter:warn" satisfies IpcChannel, handler);
    return () => ipcRenderer.removeListener("reporter:warn" satisfies IpcChannel, handler);
  },
  onReporterError: (callback) => {
    const handler = (_event: unknown, msg: string) => callback(msg);
    ipcRenderer.on("reporter:error" satisfies IpcChannel, handler);
    return () => ipcRenderer.removeListener("reporter:error" satisfies IpcChannel, handler);
  },

  // Chat / Inbox
  sendMessage: (targetAgent, message) => ipcRenderer.invoke("session:send-message" satisfies IpcChannel, targetAgent, message),

  // Costs
  readCosts: (targetPath) => ipcRenderer.invoke("costs:read" satisfies IpcChannel, targetPath),

  // Dialogs
  openDirectory: () => ipcRenderer.invoke("dialog:open-directory" satisfies IpcChannel),
  openFile: (filters) => ipcRenderer.invoke("dialog:open-file" satisfies IpcChannel, filters),
  saveFile: (sourcePath, defaultName) => ipcRenderer.invoke("dialog:save-file" satisfies IpcChannel, sourcePath, defaultName),

  // Git
  cloneRepo: (url) => ipcRenderer.invoke("project:clone-repo" satisfies IpcChannel, url),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
