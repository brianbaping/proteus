import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

vi.mock("../../components/shared/FileDropZone.js", () => ({
  FileDropZone: () => <div data-testid="file-drop-zone">DropZone</div>,
}));

vi.mock("../../components/planning/PlanningCanvas.js", () => ({
  PlanningCanvas: ({ data }: { data: unknown }) => (
    <div data-testid="canvas">{data ? "has-data" : "no-data"}</div>
  ),
}));

describe("PlanningPhase", () => {
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
      cost: { estimatedCost: 1.0, duration: "3m 10s" },
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
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", currentStage: "plan" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
      ...overrides,
    });
  }

  it("loads artifacts on mount when plan stage is complete", async () => {
    const plan = {
      tasks: [
        { id: "task-001", title: "Setup", discipline: "shared", estimatedComplexity: "low" },
        { id: "task-002", title: "Auth", discipline: "backend", estimatedComplexity: "high" },
      ],
      executionWaves: [{ wave: 1, tasks: ["task-001"], rationale: "Foundation" }],
      criticalPath: ["task-001", "task-002"],
    };
    mockReadArtifacts.mockResolvedValue({ plan, planMd: "# Plan" });

    setProjectStoreState({
      stageStatuses: [{ stage: "plan", complete: true, artifactPath: "/p" }] as never,
    });

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    await waitFor(() => {
      expect(mockReadArtifacts).toHaveBeenCalledWith("/tgt", "plan");
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas").textContent).toBe("has-data");
    });
  });

  it("does not load artifacts on mount when plan stage is incomplete", async () => {
    setProjectStoreState({
      stageStatuses: [{ stage: "plan", complete: false, artifactPath: "/p" }] as never,
    });

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockReadArtifacts).not.toHaveBeenCalled();
  });

  it("shows canvas with no data when artifacts are not available", async () => {
    setProjectStoreState({ stageStatuses: [] });

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    expect(screen.getByTestId("canvas").textContent).toBe("no-data");
  });

  it("handles readArtifacts failure gracefully", async () => {
    mockReadArtifacts.mockRejectedValue(new Error("file not found"));

    setProjectStoreState({
      stageStatuses: [{ stage: "plan", complete: true, artifactPath: "/p" }] as never,
    });

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas").textContent).toBe("no-data");
    });
  });

  it("renders the textarea for planning notes", async () => {
    setProjectStoreState({});

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    const textarea = screen.getByPlaceholderText("Add planning notes or constraints...");
    expect(textarea).toBeDefined();
  });

  it("textarea is controlled via local state", async () => {
    setProjectStoreState({});

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    const textarea = screen.getByPlaceholderText("Add planning notes or constraints...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Focus on API endpoints" } });
    expect(textarea.value).toBe("Focus on API endpoints");
  });

  it("forwards notes as brief option in runStage call", async () => {
    setProjectStoreState({});

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    const textarea = screen.getByPlaceholderText("Add planning notes or constraints...");
    fireEvent.change(textarea, { target: { value: "Focus on API endpoints" } });

    const button = screen.getByRole("button", { name: /APPROVE PLAN/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(mockRunStage).toHaveBeenCalledWith({
        projectName: "test-project",
        stage: "plan",
        options: { brief: "Focus on API endpoints", briefFile: undefined },
      });
    });
  });

  it("does not set options.brief when notes are empty", async () => {
    setProjectStoreState({});

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    const button = screen.getByRole("button", { name: /APPROVE PLAN/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(mockRunStage).toHaveBeenCalledWith({
        projectName: "test-project",
        stage: "plan",
        options: undefined,
      });
    });
  });

  it("loads artifacts after successful run", async () => {
    const plan = {
      tasks: [{ id: "task-001", title: "Setup", discipline: "shared" }],
      executionWaves: [{ wave: 1, tasks: ["task-001"], rationale: "Foundation" }],
      criticalPath: ["task-001"],
    };
    mockRunStage.mockResolvedValue({
      success: true,
      sessionId: "s1",
      cost: { estimatedCost: 1.0, duration: "3m" },
    });
    mockReadArtifacts
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ plan, planMd: "# Plan" });

    setProjectStoreState({ stageStatuses: [] });

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /APPROVE PLAN/i }));
    });

    await waitFor(() => {
      expect(mockReadArtifacts).toHaveBeenCalledWith("/tgt", "plan");
    });

    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("Plan generated"))).toBe(true);
  });

  it("calls abortStage when stop button is clicked during run", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "plan" });
    setProjectStoreState({});

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /STOP/i }));
    });

    expect(window.electronAPI.abortStage).toHaveBeenCalled();
    expect(useSessionStore.getState().isRunning).toBe(false);
    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("aborted"))).toBe(true);
  });

  it("handles runStage exception with error message", async () => {
    mockRunStage.mockRejectedValue(new Error("plan generation failed"));

    setProjectStoreState({});

    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /APPROVE PLAN/i }));
    });

    await waitFor(() => {
      const session = useSessionStore.getState();
      expect(session.isRunning).toBe(false);
      expect(session.cost).toBe(0);
    });

    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("plan generation failed"))).toBe(true);
  });
});
