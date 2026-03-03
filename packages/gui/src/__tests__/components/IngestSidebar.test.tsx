import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";

vi.mock("../../components/shared/FileDropZone.js", () => ({
  FileDropZone: ({ onFilePath }: { onFilePath: (p: string) => void }) => (
    <button data-testid="file-drop-zone" onClick={() => onFilePath("/dropped/path")}>
      DropZone
    </button>
  ),
}));

describe("IngestSidebar", () => {
  let mockUpdateProject: ReturnType<typeof vi.fn>;
  let mockOpenDirectory: ReturnType<typeof vi.fn>;
  let mockCloneRepo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();

    mockUpdateProject = vi.fn().mockResolvedValue(undefined);
    mockOpenDirectory = vi.fn().mockResolvedValue("/browsed/dir");
    mockCloneRepo = vi.fn().mockResolvedValue("/cloned/path");

    window.electronAPI = {
      runStage: vi.fn(),
      readArtifacts: vi.fn(),
      listProjects: vi.fn().mockResolvedValue({ projects: {} }),
      getActiveProject: vi.fn().mockResolvedValue({
        name: "test-project",
        entry: { source: "/original/src", target: "/original/tgt", createdAt: "", currentStage: "inspect" },
      }),
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
      openDirectory: mockOpenDirectory,
      openFile: vi.fn(),
      saveFile: vi.fn(),
      cloneRepo: mockCloneRepo,
      updateProject: mockUpdateProject,
    } as unknown as ElectronAPI;

    useProjectStore.setState({
      activeProjectName: "test-project",
      activeEntry: { source: "/original/src", target: "/original/tgt", createdAt: "", currentStage: "inspect" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  async function renderSidebar() {
    const { IngestSidebar } = await import("../../components/inspection/IngestSidebar.js");
    return render(<IngestSidebar onRunInspection={vi.fn()} onAbort={vi.fn()} />);
  }

  describe("blur persistence", () => {
    it("persists source on POC input blur when value differs from activeEntry", async () => {
      await renderSidebar();

      const pocInput = screen.getAllByRole("textbox")[0];
      fireEvent.change(pocInput, { target: { value: "/new/source" } });
      fireEvent.blur(pocInput);

      await waitFor(() => {
        expect(mockUpdateProject).toHaveBeenCalledWith("test-project", { source: "/new/source" });
      });
    });

    it("persists target on candidate input blur when value differs", async () => {
      await renderSidebar();

      const targetInput = screen.getAllByRole("textbox")[1];
      fireEvent.change(targetInput, { target: { value: "/new/target" } });
      fireEvent.blur(targetInput);

      await waitFor(() => {
        expect(mockUpdateProject).toHaveBeenCalledWith("test-project", { target: "/new/target" });
      });
    });

    it("does not persist on blur when value matches activeEntry (dirty check)", async () => {
      await renderSidebar();

      const pocInput = screen.getAllByRole("textbox")[0];
      // Value should already be /original/src — blur without changing
      fireEvent.blur(pocInput);

      expect(mockUpdateProject).not.toHaveBeenCalled();
    });

    it("does not persist when no active project name", async () => {
      useProjectStore.setState({ activeProjectName: null });
      await renderSidebar();

      const pocInput = screen.getAllByRole("textbox")[0];
      fireEvent.change(pocInput, { target: { value: "/new/path" } });
      fireEvent.blur(pocInput);

      expect(mockUpdateProject).not.toHaveBeenCalled();
    });
  });

  describe("browse persistence", () => {
    it("persists source after browsing POC directory", async () => {
      await renderSidebar();

      const browseButtons = screen.getAllByText("Browse");
      await act(async () => {
        fireEvent.click(browseButtons[0]);
      });

      await waitFor(() => {
        expect(mockOpenDirectory).toHaveBeenCalled();
        expect(mockUpdateProject).toHaveBeenCalledWith("test-project", { source: "/browsed/dir" });
      });
    });

    it("persists target after browsing candidate directory", async () => {
      await renderSidebar();

      const browseButtons = screen.getAllByText("Browse");
      await act(async () => {
        fireEvent.click(browseButtons[1]);
      });

      await waitFor(() => {
        expect(mockOpenDirectory).toHaveBeenCalled();
        expect(mockUpdateProject).toHaveBeenCalledWith("test-project", { target: "/browsed/dir" });
      });
    });

    it("does not persist when browse dialog is cancelled", async () => {
      mockOpenDirectory.mockResolvedValue(null);
      await renderSidebar();

      const browseButtons = screen.getAllByText("Browse");
      await act(async () => {
        fireEvent.click(browseButtons[0]);
      });

      expect(mockUpdateProject).not.toHaveBeenCalled();
    });
  });

  describe("clone persistence", () => {
    it("persists source after cloning a repo", async () => {
      await renderSidebar();

      // Switch to GitHub tab
      const githubButton = screen.getByText("GitHub Repo");
      fireEvent.click(githubButton);

      const urlInput = screen.getByPlaceholderText("https://github.com/owner/repo");
      fireEvent.change(urlInput, { target: { value: "https://github.com/test/repo" } });

      const cloneButton = screen.getByText("Clone Repository");
      await act(async () => {
        fireEvent.click(cloneButton);
      });

      await waitFor(() => {
        expect(mockCloneRepo).toHaveBeenCalledWith("https://github.com/test/repo");
        expect(mockUpdateProject).toHaveBeenCalledWith("test-project", { source: "/cloned/path" });
      });
    });
  });

  describe("error handling", () => {
    it("silently handles updateProject failures on blur", async () => {
      mockUpdateProject.mockRejectedValue(new Error("write failed"));
      await renderSidebar();

      const pocInput = screen.getAllByRole("textbox")[0];
      fireEvent.change(pocInput, { target: { value: "/failing/path" } });
      fireEvent.blur(pocInput);

      // Should not throw — component stays functional
      await waitFor(() => {
        expect(mockUpdateProject).toHaveBeenCalled();
      });
    });

    it("silently handles updateProject failures on browse", async () => {
      mockUpdateProject.mockRejectedValue(new Error("write failed"));
      await renderSidebar();

      const browseButtons = screen.getAllByText("Browse");
      await act(async () => {
        fireEvent.click(browseButtons[0]);
      });

      // Should not throw
      await waitFor(() => {
        expect(mockUpdateProject).toHaveBeenCalled();
      });
    });
  });
});
