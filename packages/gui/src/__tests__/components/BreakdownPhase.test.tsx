import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

vi.mock("../../components/shared/FileDropZone.js", () => ({
  FileDropZone: () => <div data-testid="file-drop-zone">DropZone</div>,
}));

vi.mock("../../components/breakdown/BreakdownCanvas.js", () => ({
  BreakdownCanvas: ({ data }: { data: unknown }) => (
    <div data-testid="canvas">{data ? "has-data" : "no-data"}</div>
  ),
}));

describe("BreakdownPhase", () => {
  let mockRunStage: ReturnType<typeof vi.fn>;
  let mockReadArtifacts: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useChatStore.getState().clearMessages();

    mockReadArtifacts = vi.fn().mockResolvedValue(null);
    mockRunStage = vi.fn().mockResolvedValue({
      success: true,
      sessionId: "",
      cost: { estimatedCost: 0.8, duration: "2m 5s" },
    });

    window.electronAPI = {
      runStage: mockRunStage,
      readArtifacts: mockReadArtifacts,
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
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
      updateProject: vi.fn(),
    } as unknown as ElectronAPI;
  });

  function setProjectStoreState(overrides: Partial<ReturnType<typeof useProjectStore.getState>>) {
    useProjectStore.setState({
      activeProjectName: "test-project",
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", lastCompletedStage: "split" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
      ...overrides,
    });
  }

  it("loads artifacts on mount when split stage is complete", async () => {
    const manifest = {
      tracks: [
        { id: "t1", discipline: "backend", taskCount: 5, file: "backend.json", dependsOnTracks: [], requiredByTracks: ["t2"] },
        { id: "t2", discipline: "frontend", taskCount: 3, file: "frontend.json", dependsOnTracks: ["t1"], requiredByTracks: [] },
      ],
    };
    mockReadArtifacts.mockResolvedValue({ manifest });

    setProjectStoreState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    await waitFor(() => {
      expect(mockReadArtifacts).toHaveBeenCalledWith("/tgt", "split");
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas").textContent).toBe("has-data");
    });
  });

  it("does not load artifacts on mount when split stage is incomplete", async () => {
    setProjectStoreState({
      stageStatuses: [{ stage: "split", complete: false, artifactPath: "/p" }] as never,
    });

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockReadArtifacts).not.toHaveBeenCalled();
  });

  it("shows canvas with no data when artifacts are not available", async () => {
    setProjectStoreState({ stageStatuses: [] });

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    expect(screen.getByTestId("canvas").textContent).toBe("no-data");
  });

  it("handles readArtifacts failure gracefully", async () => {
    mockReadArtifacts.mockRejectedValue(new Error("file not found"));

    setProjectStoreState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas").textContent).toBe("no-data");
    });
  });

  it("renders the textarea for breakdown notes", async () => {
    setProjectStoreState({});

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    const textarea = screen.getByPlaceholderText("Add breakdown notes...");
    expect(textarea).toBeDefined();
  });

  it("textarea is controlled via local state", async () => {
    setProjectStoreState({});

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    const textarea = screen.getByPlaceholderText("Add breakdown notes...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Split by domain" } });
    expect(textarea.value).toBe("Split by domain");
  });

  it("forwards notes as brief option in runStage call", async () => {
    setProjectStoreState({});

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    const textarea = screen.getByPlaceholderText("Add breakdown notes...");
    fireEvent.change(textarea, { target: { value: "Split by domain" } });

    const button = screen.getByRole("button", { name: /APPROVE BREAKDOWN/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(mockRunStage).toHaveBeenCalledWith({
        projectName: "test-project",
        stage: "split",
        options: { brief: "Split by domain", briefFile: undefined },
      });
    });
  });

  it("does not set options.brief when notes are empty", async () => {
    setProjectStoreState({});

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    const button = screen.getByRole("button", { name: /APPROVE BREAKDOWN/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(mockRunStage).toHaveBeenCalledWith({
        projectName: "test-project",
        stage: "split",
        options: undefined,
      });
    });
  });

  it("loads artifacts after successful run", async () => {
    const manifest = {
      tracks: [
        { id: "t1", discipline: "backend", taskCount: 5, file: "backend.json", dependsOnTracks: [] },
      ],
    };
    mockRunStage.mockResolvedValue({
      success: true,
      sessionId: "s1",
      cost: { estimatedCost: 0.8, duration: "2m" },
    });
    mockReadArtifacts
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ manifest });

    setProjectStoreState({ stageStatuses: [] });

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /APPROVE BREAKDOWN/i }));
    });

    await waitFor(() => {
      expect(mockReadArtifacts).toHaveBeenCalledWith("/tgt", "split");
    });

    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("Breakdown complete"))).toBe(true);
  });

  it("calls abortStage when stop button is clicked during run", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "split" });
    setProjectStoreState({});

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /STOP/i }));
    });

    expect(window.electronAPI.abortStage).toHaveBeenCalled();
    expect(useSessionStore.getState().isRunning).toBe(false);
    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("aborted"))).toBe(true);
  });

  it("handles runStage exception with error message", async () => {
    mockRunStage.mockRejectedValue(new Error("breakdown failed"));

    setProjectStoreState({});

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /APPROVE BREAKDOWN/i }));
    });

    await waitFor(() => {
      const session = useSessionStore.getState();
      expect(session.isRunning).toBe(false);
      expect(session.cost).toBe(0);
    });

    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("breakdown failed"))).toBe(true);
  });

  it("disables Run button when phase is already completed", async () => {
    useSessionStore.setState({ completedStages: ["split"] });

    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    const button = screen.getByRole("button", { name: /APPROVE BREAKDOWN/i });
    expect(button.disabled).toBe(true);
    expect(button.className).toContain("opacity-50");
  });
});
