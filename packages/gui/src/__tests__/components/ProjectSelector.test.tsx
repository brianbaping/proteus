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

  it("does not destroy when first confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));

    expect(window.electronAPI.destroyProject).not.toHaveBeenCalled();
  });

  it("asks about source folder after confirming destroy", async () => {
    const confirmSpy = vi.spyOn(window, "confirm")
      .mockReturnValueOnce(true)   // first confirm: destroy
      .mockReturnValueOnce(false); // second confirm: keep source

    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(2);
    });

    expect(confirmSpy.mock.calls[1][0]).toContain("/home/user/poc/demo");
    expect(window.electronAPI.destroyProject).toHaveBeenCalledWith("demo", { deleteSource: false });
  });

  it("passes deleteSource true when user confirms source deletion", async () => {
    vi.spyOn(window, "confirm")
      .mockReturnValueOnce(true)  // first confirm: destroy
      .mockReturnValueOnce(true); // second confirm: delete source

    const { ProjectSelector } = await import("../../components/chrome/ProjectSelector.js");
    render(<ProjectSelector />);

    fireEvent.click(screen.getByTitle("Destroy project"));

    await waitFor(() => {
      expect(window.electronAPI.destroyProject).toHaveBeenCalledWith("demo", { deleteSource: true });
    });
  });
});
