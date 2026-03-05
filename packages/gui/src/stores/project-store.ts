import { create } from "zustand";
import type { ProjectRegistry, ProjectEntry, StageStatus, CostTracking } from "@proteus-forge/shared";

interface ProjectState {
  registry: ProjectRegistry | null;
  activeProjectName: string | null;
  activeEntry: ProjectEntry | null;
  stageStatuses: StageStatus[];
  staleness: Array<{ stage: string; staleReason: string }>;
  costs: CostTracking | null;
  loading: boolean;

  loadRegistry(): Promise<void>;
  setActiveProject(name: string): Promise<void>;
  refreshStatus(): Promise<void>;
  createProject(name: string, source: string, target?: string): Promise<void>;
  updateProject(name: string, updates: { source?: string; target?: string }): Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  registry: null,
  activeProjectName: null,
  activeEntry: null,
  stageStatuses: [],
  staleness: [],
  costs: null,
  loading: false,

  loadRegistry: async () => {
    set({ loading: true });
    try {
      const registry = await window.electronAPI.listProjects();
      const active = await window.electronAPI.getActiveProject();
      set({
        registry,
        activeProjectName: active?.name ?? null,
        activeEntry: active?.entry ?? null,
        loading: false,
      });
      if (active) {
        await get().refreshStatus();
      }
    } catch {
      set({ loading: false });
    }
  },

  setActiveProject: async (name: string) => {
    await window.electronAPI.setActiveProject(name);
    await get().loadRegistry();
  },

  refreshStatus: async () => {
    const { activeEntry } = get();
    if (!activeEntry) return;
    try {
      const result = await window.electronAPI.getProjectStatus(activeEntry.target);
      let costs: CostTracking | null = null;
      try {
        costs = await window.electronAPI.readCosts(activeEntry.target);
      } catch {
        // costs.json may not exist yet
      }
      set({
        stageStatuses: result.statuses,
        staleness: result.staleness,
        costs,
      });
    } catch {
      // Status refresh failed — keep existing state
    }
  },

  createProject: async (name: string, source: string, target?: string) => {
    await window.electronAPI.createProject(name, source, target);
    await get().loadRegistry();
  },

  updateProject: async (name: string, updates: { source?: string; target?: string }) => {
    await window.electronAPI.updateProject(name, updates);
    await get().loadRegistry();
  },
}));
