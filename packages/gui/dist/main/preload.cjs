"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var electronAPI = {
  // Project management
  listProjects: () => import_electron.ipcRenderer.invoke("project:list"),
  getActiveProject: () => import_electron.ipcRenderer.invoke("project:get-active"),
  setActiveProject: (name) => import_electron.ipcRenderer.invoke("project:set-active", name),
  createProject: (name, source, target) => import_electron.ipcRenderer.invoke("project:create", name, source, target),
  destroyProject: (name) => import_electron.ipcRenderer.invoke("project:destroy", name),
  getProjectStatus: (targetPath) => import_electron.ipcRenderer.invoke("project:status", targetPath),
  readArtifacts: (targetPath, stage) => import_electron.ipcRenderer.invoke("project:read-artifacts", targetPath, stage),
  // Config
  readGlobalConfig: () => import_electron.ipcRenderer.invoke("config:read-global"),
  // Pipeline
  runStage: (options) => import_electron.ipcRenderer.invoke("stage:run", options),
  abortStage: () => import_electron.ipcRenderer.invoke("stage:abort"),
  // Session events (subscription)
  onSessionEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("session:event", handler);
    return () => import_electron.ipcRenderer.removeListener("session:event", handler);
  },
  onReporterLog: (callback) => {
    const handler = (_event, msg) => callback(msg);
    import_electron.ipcRenderer.on("reporter:log", handler);
    return () => import_electron.ipcRenderer.removeListener("reporter:log", handler);
  },
  onReporterWarn: (callback) => {
    const handler = (_event, msg) => callback(msg);
    import_electron.ipcRenderer.on("reporter:warn", handler);
    return () => import_electron.ipcRenderer.removeListener("reporter:warn", handler);
  },
  onReporterError: (callback) => {
    const handler = (_event, msg) => callback(msg);
    import_electron.ipcRenderer.on("reporter:error", handler);
    return () => import_electron.ipcRenderer.removeListener("reporter:error", handler);
  },
  // Chat / Inbox
  sendMessage: (targetAgent, message) => import_electron.ipcRenderer.invoke("session:send-message", targetAgent, message),
  // Costs
  readCosts: (targetPath) => import_electron.ipcRenderer.invoke("costs:read", targetPath),
  // Dialogs
  openDirectory: () => import_electron.ipcRenderer.invoke("dialog:open-directory"),
  openFile: (filters) => import_electron.ipcRenderer.invoke("dialog:open-file", filters)
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
