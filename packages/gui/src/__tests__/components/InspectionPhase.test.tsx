import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

// Mock child components to isolate InspectionPhase logic
vi.mock("../../components/inspection/IngestSidebar.js", () => ({
  IngestSidebar: ({ onRunInspection }: { onRunInspection: (opts: { excludeStyle?: boolean }) => void }) => (
    <button data-testid="run-btn" onClick={() => onRunInspection({})}>
      Run
    </button>
  ),
}));

vi.mock("../../components/inspection/InspectionCanvas.js", () => ({
  InspectionCanvas: ({ data }: { data: unknown }) => (
    <div data-testid="canvas">{data ? "has-data" : "no-data"}</div>
  ),
}));

describe("InspectionPhase", () => {
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
      cost: { estimatedCost: 0.5, duration: "1m 30s" },
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
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
    } as unknown as ElectronAPI;
  });

  function setProjectStoreState(overrides: Partial<ReturnType<typeof useProjectStore.getState>>) {
    useProjectStore.setState({
      activeProjectName: "test-project",
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", currentStage: "inspect" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
      ...overrides,
    });
  }

  it("loads artifacts on mount when inspect stage is complete", async () => {
    const features = {
      source: { primaryLanguage: "TypeScript", languages: ["TypeScript"], frameworks: ["React"] },
      features: [{ id: "f1", name: "Auth", description: "Auth", category: "core", sourceFiles: ["auth.ts"], complexity: "medium" }],
    };
    mockReadArtifacts.mockResolvedValue({ features });

    setProjectStoreState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    const { InspectionPhase } = await import("../../components/inspection/InspectionPhase.js");
    render(<InspectionPhase />);

    await waitFor(() => {
      expect(mockReadArtifacts).toHaveBeenCalledWith("/tgt", "inspect");
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas").textContent).toBe("has-data");
    });
  });

  it("does not load artifacts on mount when inspect stage is incomplete", async () => {
    setProjectStoreState({
      stageStatuses: [{ stage: "inspect", complete: false, artifactPath: "/p" }] as never,
    });

    const { InspectionPhase } = await import("../../components/inspection/InspectionPhase.js");
    render(<InspectionPhase />);

    // Give effects a chance to run
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReadArtifacts).not.toHaveBeenCalled();
  });

  it("shows canvas with no data when artifacts are not available", async () => {
    setProjectStoreState({ stageStatuses: [] });
    mockReadArtifacts.mockResolvedValue(null);

    const { InspectionPhase } = await import("../../components/inspection/InspectionPhase.js");
    render(<InspectionPhase />);

    expect(screen.getByTestId("canvas").textContent).toBe("no-data");
  });

  it("handles readArtifacts failure gracefully", async () => {
    mockReadArtifacts.mockRejectedValue(new Error("file not found"));

    setProjectStoreState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    const { InspectionPhase } = await import("../../components/inspection/InspectionPhase.js");
    render(<InspectionPhase />);

    // Should not crash — canvas stays with no data
    await waitFor(() => {
      expect(screen.getByTestId("canvas").textContent).toBe("no-data");
    });
  });

  describe("handleRunInspection", () => {
    it("calls runStage and loads artifacts on success", async () => {
      const features = {
        source: { languages: ["TypeScript"], frameworks: ["React"] },
        features: [{ id: "f1", name: "Auth", description: "Auth", category: "core", sourceFiles: ["auth.ts"], complexity: "medium" }],
      };
      mockRunStage.mockResolvedValue({
        success: true,
        sessionId: "s1",
        cost: { estimatedCost: 0.5, duration: "1m 30s" },
      });
      // First call returns null (mount), second returns features (after run)
      mockReadArtifacts
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ features });

      setProjectStoreState({ stageStatuses: [] });

      const { InspectionPhase } = await import("../../components/inspection/InspectionPhase.js");
      render(<InspectionPhase />);

      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      await waitFor(() => {
        expect(mockRunStage).toHaveBeenCalledWith({
          projectName: "test-project",
          stage: "inspect",
          options: { excludeStyle: undefined },
        });
      });

      const session = useSessionStore.getState();
      expect(session.isRunning).toBe(false);
      expect(session.cost).toBe(0.5);
      expect(session.duration).toBe("1m 30s");

      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text.includes("Inspection complete"))).toBe(true);
    });

    it("handles runStage failure", async () => {
      mockRunStage.mockResolvedValue({
        success: false,
        sessionId: "",
        cost: { estimatedCost: 0, duration: "10s" },
      });

      setProjectStoreState({ stageStatuses: [] });

      const { InspectionPhase } = await import("../../components/inspection/InspectionPhase.js");
      render(<InspectionPhase />);

      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      await waitFor(() => {
        const messages = useChatStore.getState().messages;
        expect(messages.some((m) => m.text.includes("Inspection failed"))).toBe(true);
      });
    });

    it("handles runStage exception", async () => {
      mockRunStage.mockRejectedValue(new Error("network error"));

      setProjectStoreState({ stageStatuses: [] });

      const { InspectionPhase } = await import("../../components/inspection/InspectionPhase.js");
      render(<InspectionPhase />);

      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      await waitFor(() => {
        const session = useSessionStore.getState();
        expect(session.isRunning).toBe(false);
        expect(session.cost).toBe(0);
      });

      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text.includes("network error"))).toBe(true);
    });

    it("does nothing when no active project name", async () => {
      setProjectStoreState({ activeProjectName: null });

      const { InspectionPhase } = await import("../../components/inspection/InspectionPhase.js");
      render(<InspectionPhase />);

      await act(async () => {
        fireEvent.click(screen.getByTestId("run-btn"));
      });

      expect(mockRunStage).not.toHaveBeenCalled();
    });
  });
});
