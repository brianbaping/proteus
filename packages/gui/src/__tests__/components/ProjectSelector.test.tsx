import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";

describe("ProjectSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({
      registry: {
        activeProject: "demo",
        projects: {
          demo: {
            source: "/home/user/poc/demo",
            target: "/home/user/prod/demo-prod",
            createdAt: "2026-01-01",
            lastCompletedStage: "new",
          },
        },
      },
      activeProjectName: "demo",
      activeEntry: {
        source: "/home/user/poc/demo",
        target: "/home/user/prod/demo-prod",
        createdAt: "2026-01-01",
        lastCompletedStage: "new",
      },
      stageStatuses: [],
      staleness: [],
      costs: null,
      loading: false,
    });

    window.electronAPI = {
      destroyProject: vi.fn().mockResolvedValue(undefined),
      listProjects: vi.fn().mockResolvedValue({ activeProject: null, projects: {} }),
      getActiveProject: vi.fn().mockResolvedValue(null),
      setActiveProject: vi.fn(),
      createProject: vi.fn(),
      getProjectStatus: vi.fn(),
      readArtifacts: vi.fn(),
      readGlobalConfig: vi.fn(),
      abortStage: vi.fn(),
      runStage: vi.fn(),
      sendMessage: vi.fn(),
      onSessionEvent: vi.fn().mockReturnValue(() => {}),
      onReporterLog: vi.fn().mockReturnValue(() => {}),
      onReporterWarn: vi.fn().mockReturnValue(() => {}),
      onReporterError: vi.fn().mockReturnValue(() => {}),
      readCosts: vi.fn(),
      openDirectory: vi.fn(),
      openFile: vi.fn(),
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
      updateProject: vi.fn(),
      exportChat: vi.fn(),
    } as unknown as ElectronAPI;
  });

  it("shows destroy button for active project", async () => {
    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    expect(screen.getByTitle("Destroy project")).toBeDefined();
  });

  it("opens destroy dialog on click", async () => {
    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));

    expect(screen.getByTestId("destroy-dialog")).toBeDefined();
    expect(screen.getByText("Destroy Project")).toBeDefined();
  });

  it("closes dialog on Cancel", async () => {
    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));
    expect(screen.getByTestId("destroy-dialog")).toBeDefined();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("destroy-dialog")).toBeNull();
    expect(window.electronAPI.destroyProject).not.toHaveBeenCalled();
  });

  it("shows source path with toggle unchecked by default", async () => {
    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));

    const toggle = screen.getByTestId("delete-source-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(screen.getByText("/home/user/poc/demo")).toBeDefined();
  });

  it("destroys without deleting source when toggle is off", async () => {
    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));
    fireEvent.click(screen.getByTestId("destroy-confirm"));

    await waitFor(() => {
      expect(window.electronAPI.destroyProject).toHaveBeenCalledWith("demo", { deleteSource: false });
    });
  });

  it("destroys with deleting source when toggle is on", async () => {
    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));
    fireEvent.click(screen.getByTestId("delete-source-toggle"));
    fireEvent.click(screen.getByTestId("destroy-confirm"));

    await waitFor(() => {
      expect(window.electronAPI.destroyProject).toHaveBeenCalledWith("demo", { deleteSource: true });
    });
  });

  it("does not show source toggle when no source path", async () => {
    useProjectStore.setState({
      activeEntry: {
        source: "",
        target: "/home/user/prod/demo-prod",
        createdAt: "2026-01-01",
        lastCompletedStage: "new",
      },
    });

    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));

    expect(screen.queryByTestId("delete-source-toggle")).toBeNull();
  });
});
