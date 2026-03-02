import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";

describe("useProjectStore", () => {
  let mockElectronAPI: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockElectronAPI = {
      listProjects: vi.fn().mockResolvedValue({ activeProject: null, projects: {} }),
      getActiveProject: vi.fn().mockResolvedValue(null),
      setActiveProject: vi.fn().mockResolvedValue(undefined),
      createProject: vi.fn().mockResolvedValue(undefined),
      getProjectStatus: vi.fn().mockResolvedValue({ statuses: [], staleness: [] }),
    };
    window.electronAPI = mockElectronAPI as unknown as ElectronAPI;

    useProjectStore.setState({
      registry: null,
      activeProjectName: null,
      activeEntry: null,
      stageStatuses: [],
      staleness: [],
      loading: false,
    });
  });

  it("has correct initial state", () => {
    const state = useProjectStore.getState();
    expect(state.registry).toBeNull();
    expect(state.activeProjectName).toBeNull();
    expect(state.activeEntry).toBeNull();
    expect(state.stageStatuses).toEqual([]);
    expect(state.staleness).toEqual([]);
    expect(state.loading).toBe(false);
  });

  describe("loadRegistry", () => {
    it("fetches registry and active project from IPC", async () => {
      const registry = { activeProject: "proj", projects: { proj: { source: "/s", target: "/t", createdAt: "", currentStage: "new" } } };
      const active = { name: "proj", entry: { source: "/s", target: "/t", createdAt: "", currentStage: "new" } };
      mockElectronAPI.listProjects.mockResolvedValue(registry);
      mockElectronAPI.getActiveProject.mockResolvedValue(active);
      mockElectronAPI.getProjectStatus.mockResolvedValue({ statuses: [{ stage: "inspect", complete: true }], staleness: [] });

      await useProjectStore.getState().loadRegistry();

      const state = useProjectStore.getState();
      expect(state.registry).toBe(registry);
      expect(state.activeProjectName).toBe("proj");
      expect(state.activeEntry).toBe(active.entry);
      expect(state.loading).toBe(false);
    });

    it("calls refreshStatus when an active project exists", async () => {
      const active = { name: "proj", entry: { source: "/s", target: "/t", createdAt: "", currentStage: "new" } };
      mockElectronAPI.getActiveProject.mockResolvedValue(active);
      mockElectronAPI.getProjectStatus.mockResolvedValue({
        statuses: [{ stage: "inspect", complete: true }],
        staleness: [{ stage: "design", staleReason: "inspect changed" }],
      });

      await useProjectStore.getState().loadRegistry();

      expect(mockElectronAPI.getProjectStatus).toHaveBeenCalledWith("/t");
      const state = useProjectStore.getState();
      expect(state.stageStatuses).toEqual([{ stage: "inspect", complete: true }]);
      expect(state.staleness).toEqual([{ stage: "design", staleReason: "inspect changed" }]);
    });

    it("does not call refreshStatus when no active project", async () => {
      mockElectronAPI.getActiveProject.mockResolvedValue(null);

      await useProjectStore.getState().loadRegistry();

      expect(mockElectronAPI.getProjectStatus).not.toHaveBeenCalled();
    });

    it("sets loading false on error", async () => {
      mockElectronAPI.listProjects.mockRejectedValue(new Error("network"));

      await useProjectStore.getState().loadRegistry();

      expect(useProjectStore.getState().loading).toBe(false);
    });
  });

  describe("setActiveProject", () => {
    it("calls IPC setActiveProject then reloads registry", async () => {
      const active = { name: "other", entry: { source: "/s2", target: "/t2", createdAt: "", currentStage: "new" } };
      mockElectronAPI.getActiveProject.mockResolvedValue(active);

      await useProjectStore.getState().setActiveProject("other");

      expect(mockElectronAPI.setActiveProject).toHaveBeenCalledWith("other");
      expect(mockElectronAPI.listProjects).toHaveBeenCalled();
      expect(useProjectStore.getState().activeProjectName).toBe("other");
    });
  });

  describe("refreshStatus", () => {
    it("fetches statuses for the active entry target", async () => {
      useProjectStore.setState({
        activeEntry: { source: "/s", target: "/t", createdAt: "", currentStage: "plan" },
      });
      mockElectronAPI.getProjectStatus.mockResolvedValue({
        statuses: [{ stage: "plan", complete: true }],
        staleness: [],
      });

      await useProjectStore.getState().refreshStatus();

      expect(mockElectronAPI.getProjectStatus).toHaveBeenCalledWith("/t");
      expect(useProjectStore.getState().stageStatuses).toEqual([{ stage: "plan", complete: true }]);
    });

    it("does nothing when no active entry", async () => {
      await useProjectStore.getState().refreshStatus();

      expect(mockElectronAPI.getProjectStatus).not.toHaveBeenCalled();
    });

    it("keeps existing state on error", async () => {
      useProjectStore.setState({
        activeEntry: { source: "/s", target: "/t", createdAt: "", currentStage: "plan" },
        stageStatuses: [{ stage: "inspect", complete: true }] as never,
      });
      mockElectronAPI.getProjectStatus.mockRejectedValue(new Error("fail"));

      await useProjectStore.getState().refreshStatus();

      expect(useProjectStore.getState().stageStatuses).toEqual([{ stage: "inspect", complete: true }]);
    });
  });

  describe("createProject", () => {
    it("calls IPC createProject then reloads registry", async () => {
      await useProjectStore.getState().createProject("new-proj", "/source", "/target");

      expect(mockElectronAPI.createProject).toHaveBeenCalledWith("new-proj", "/source", "/target");
      expect(mockElectronAPI.listProjects).toHaveBeenCalled();
    });
  });
});
