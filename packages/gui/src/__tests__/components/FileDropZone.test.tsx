import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";

describe("FileDropZone", () => {
  let mockOpenFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenFile = vi.fn().mockResolvedValue("/path/to/file.md");

    window.electronAPI = {
      openFile: mockOpenFile,
      openDirectory: vi.fn(),
      runStage: vi.fn(),
      readArtifacts: vi.fn(),
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
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
    } as unknown as ElectronAPI;
  });

  it("renders with default label", async () => {
    const { FileDropZone } = await import("../../components/shared/FileDropZone.js");
    render(<FileDropZone onFilePath={vi.fn()} />);

    expect(screen.getByText(/Drop .pdf, .md, or .txt files or click to browse/)).toBeDefined();
  });

  it("renders with custom label", async () => {
    const { FileDropZone } = await import("../../components/shared/FileDropZone.js");
    render(<FileDropZone onFilePath={vi.fn()} label="Custom label" />);

    expect(screen.getByText("Custom label")).toBeDefined();
  });

  it("opens file dialog on click and calls onFilePath", async () => {
    const onFilePath = vi.fn();
    const { FileDropZone } = await import("../../components/shared/FileDropZone.js");
    render(<FileDropZone onFilePath={onFilePath} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOpenFile).toHaveBeenCalled();
      expect(onFilePath).toHaveBeenCalledWith("/path/to/file.md");
    });
  });

  it("does not call onFilePath when file dialog is canceled", async () => {
    mockOpenFile.mockResolvedValue(null);
    const onFilePath = vi.fn();
    const { FileDropZone } = await import("../../components/shared/FileDropZone.js");
    render(<FileDropZone onFilePath={onFilePath} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOpenFile).toHaveBeenCalled();
    });
    expect(onFilePath).not.toHaveBeenCalled();
  });

  it("handles drop event with file path", async () => {
    const onFilePath = vi.fn();
    const { FileDropZone } = await import("../../components/shared/FileDropZone.js");
    render(<FileDropZone onFilePath={onFilePath} />);

    const button = screen.getByRole("button");

    const file = new File(["content"], "brief.md", { type: "text/markdown" });
    Object.defineProperty(file, "path", { value: "/tmp/brief.md" });

    const dataTransfer = {
      files: [file],
      types: ["Files"],
    };

    fireEvent.dragOver(button, { dataTransfer });
    fireEvent.drop(button, { dataTransfer });

    expect(onFilePath).toHaveBeenCalledWith("/tmp/brief.md");
  });

  it("shows drag-over visual state", async () => {
    const { FileDropZone } = await import("../../components/shared/FileDropZone.js");
    render(<FileDropZone onFilePath={vi.fn()} />);

    const button = screen.getByRole("button");
    fireEvent.dragOver(button, { dataTransfer: { files: [], types: ["Files"] } });

    expect(button.className).toContain("border-green");
  });

  it("removes drag-over state on drag leave", async () => {
    const { FileDropZone } = await import("../../components/shared/FileDropZone.js");
    render(<FileDropZone onFilePath={vi.fn()} />);

    const button = screen.getByRole("button");
    fireEvent.dragOver(button, { dataTransfer: { files: [], types: ["Files"] } });
    expect(button.className).toContain("border-green");

    fireEvent.dragLeave(button, { dataTransfer: { files: [], types: ["Files"] } });
    expect(button.className).not.toContain("bg-green-dark");
  });

  it("does not call onFilePath when dropped file has no path property", async () => {
    const onFilePath = vi.fn();
    const { FileDropZone } = await import("../../components/shared/FileDropZone.js");
    render(<FileDropZone onFilePath={onFilePath} />);

    const button = screen.getByRole("button");
    const file = new File(["content"], "brief.md", { type: "text/markdown" });
    // No .path property

    fireEvent.drop(button, { dataTransfer: { files: [file] } });

    expect(onFilePath).not.toHaveBeenCalled();
  });
});
