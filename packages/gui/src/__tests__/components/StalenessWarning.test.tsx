import React from "react";
import { render, screen } from "@testing-library/react";
import { useProjectStore } from "../../stores/project-store.js";
import type { ElectronAPI } from "#electron/preload.js";

describe("StalenessWarning", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    window.electronAPI = {
      saveFile: vi.fn(),
      readArtifacts: vi.fn(),
      runStage: vi.fn(),
      listProjects: vi.fn(),
      getActiveProject: vi.fn(),
      setActiveProject: vi.fn(),
      createProject: vi.fn(),
      destroyProject: vi.fn(),
      getProjectStatus: vi.fn().mockResolvedValue({ statuses: [], staleness: [] }),
      readGlobalConfig: vi.fn(),
      abortStage: vi.fn(),
      onSessionEvent: vi.fn().mockReturnValue(() => {}),
      onReporterLog: vi.fn().mockReturnValue(() => {}),
      onReporterWarn: vi.fn().mockReturnValue(() => {}),
      onReporterError: vi.fn().mockReturnValue(() => {}),
      sendMessage: vi.fn(),
      readCosts: vi.fn(),
      openDirectory: vi.fn(),
      openFile: vi.fn(),
      cloneRepo: vi.fn(),
      updateProject: vi.fn(),
    } as unknown as ElectronAPI;

    useProjectStore.setState({
      activeProjectName: "test",
      activeEntry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "design" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("returns null when no staleness for the given stage", async () => {
    useProjectStore.setState({ staleness: [] });

    const { StalenessWarning } = await import("../../components/shared/StalenessWarning.js");
    const { container } = render(<StalenessWarning stage="design" />);

    expect(container.innerHTML).toBe("");
  });

  it("renders warning banner when staleness exists for the stage", async () => {
    useProjectStore.setState({
      staleness: [{ stage: "design", staleReason: "inspect was modified after design was generated" }],
    });

    const { StalenessWarning } = await import("../../components/shared/StalenessWarning.js");
    render(<StalenessWarning stage="design" />);

    expect(screen.getByText("Stale")).toBeDefined();
    expect(screen.getByText("inspect was modified after design was generated")).toBeDefined();
  });

  it("displays the stale reason text from the store", async () => {
    useProjectStore.setState({
      staleness: [{ stage: "plan", staleReason: "design changed since plan was generated" }],
    });

    const { StalenessWarning } = await import("../../components/shared/StalenessWarning.js");
    render(<StalenessWarning stage="plan" />);

    expect(screen.getByText("design changed since plan was generated")).toBeDefined();
  });

  it("does not render when staleness exists for a different stage", async () => {
    useProjectStore.setState({
      staleness: [{ stage: "plan", staleReason: "design changed since plan was generated" }],
    });

    const { StalenessWarning } = await import("../../components/shared/StalenessWarning.js");
    const { container } = render(<StalenessWarning stage="design" />);

    expect(container.innerHTML).toBe("");
  });
});
