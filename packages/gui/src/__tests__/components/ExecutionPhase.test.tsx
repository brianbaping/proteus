import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

vi.mock("../../components/shared/ArtifactHeader.js", () => ({
  ArtifactHeader: ({ title, badge }: { title: string; badge: string }) => (
    <div data-testid="artifact-header">{title} - {badge}</div>
  ),
}));

describe("ExecutionPhase", () => {
  let mockReadArtifacts: ReturnType<typeof vi.fn>;
  let mockRunStage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useChatStore.getState().clearMessages();

    mockReadArtifacts = vi.fn().mockResolvedValue(null);
    mockRunStage = vi.fn().mockResolvedValue({
      success: true,
      sessionId: "",
      cost: { estimatedCost: 5.0, duration: "15m 30s" },
    });

    window.electronAPI = {
      readArtifacts: mockReadArtifacts,
      runStage: mockRunStage,
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
    } as unknown as ElectronAPI;
  });

  function setProjectState(overrides: Partial<ReturnType<typeof useProjectStore.getState>>) {
    useProjectStore.setState({
      activeProjectName: "test-project",
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", currentStage: "execute" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
      ...overrides,
    });
  }

  it("loads manifest on mount when split stage is complete", async () => {
    const manifest = {
      tracks: [
        { id: "t1", discipline: "backend", taskCount: 5, file: "track-backend.md", dependsOnTracks: [] },
        { id: "t2", discipline: "frontend", taskCount: 3, file: "track-frontend.md", dependsOnTracks: ["t1"] },
      ],
    };
    mockReadArtifacts.mockResolvedValue({ manifest });

    setProjectState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
    render(<ExecutionPhase />);

    await waitFor(() => {
      expect(mockReadArtifacts).toHaveBeenCalledWith("/tgt", "split");
    });

    await waitFor(() => {
      expect(screen.getByText("backend")).toBeDefined();
      expect(screen.getByText("frontend")).toBeDefined();
    });
  });

  it("renders track entries with task counts", async () => {
    const manifest = {
      tracks: [
        { id: "t1", discipline: "backend", taskCount: 5, file: "track-backend.md", dependsOnTracks: [] },
      ],
    };
    mockReadArtifacts.mockResolvedValue({ manifest });

    setProjectState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
    render(<ExecutionPhase />);

    await waitFor(() => {
      expect(screen.getByText("5 tasks")).toBeDefined();
    });
  });

  it("shows placeholder when no tracks and split not complete", async () => {
    setProjectState({ stageStatuses: [] });

    const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
    render(<ExecutionPhase />);

    expect(screen.getByText("Run breakdown to see execution tickets")).toBeDefined();
  });

  it("shows 'No tracks found' when split is complete but manifest has no tracks", async () => {
    mockReadArtifacts.mockResolvedValue({ manifest: { tracks: [] } });

    setProjectState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
    render(<ExecutionPhase />);

    await waitFor(() => {
      expect(screen.getByText("No tracks found")).toBeDefined();
    });
  });

  it("shows track dependencies when present", async () => {
    const manifest = {
      tracks: [
        { id: "t1", discipline: "backend", taskCount: 5, file: "track-backend.md", dependsOnTracks: [] },
        { id: "t2", discipline: "frontend", taskCount: 3, file: "track-frontend.md", dependsOnTracks: ["t1"] },
      ],
    };
    mockReadArtifacts.mockResolvedValue({ manifest });

    setProjectState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
    render(<ExecutionPhase />);

    await waitFor(() => {
      expect(screen.getByText("depends on: t1")).toBeDefined();
    });
  });

  describe("handleBuildCandidate", () => {
    it("calls runStage with execute stage on button click", async () => {
      setProjectState({ stageStatuses: [] });

      const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
      render(<ExecutionPhase />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /BUILD CANDIDATE/i }));
      });

      await waitFor(() => {
        expect(mockRunStage).toHaveBeenCalledWith({
          projectName: "test-project",
          stage: "execute",
        });
      });

      const session = useSessionStore.getState();
      expect(session.isRunning).toBe(false);
      expect(session.cost).toBe(5.0);

      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text === "Execution complete.")).toBe(true);
    });

    it("handles runStage failure", async () => {
      mockRunStage.mockResolvedValue({
        success: false,
        sessionId: "",
        cost: { estimatedCost: 0, duration: "5s" },
      });
      setProjectState({ stageStatuses: [] });

      const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
      render(<ExecutionPhase />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /BUILD CANDIDATE/i }));
      });

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages.some((m) => m.text === "Execution failed.")).toBe(true);
      });
    });

    it("handles runStage exception", async () => {
      mockRunStage.mockRejectedValue(new Error("session crashed"));
      setProjectState({ stageStatuses: [] });

      const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
      render(<ExecutionPhase />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /BUILD CANDIDATE/i }));
      });

      await waitFor(() => {
        const session = useSessionStore.getState();
        expect(session.isRunning).toBe(false);
        expect(session.cost).toBe(0);
      });

      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text.includes("session crashed"))).toBe(true);
    });

    it("does nothing when no active project name", async () => {
      setProjectState({ activeProjectName: null });

      const { ExecutionPhase } = await import("../../components/execution/ExecutionPhase.js");
      render(<ExecutionPhase />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /BUILD CANDIDATE/i }));
      });

      expect(mockRunStage).not.toHaveBeenCalled();
    });
  });
});
