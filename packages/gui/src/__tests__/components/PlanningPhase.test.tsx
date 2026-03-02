import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

// Mock ArtifactHeader to simplify rendering
vi.mock("../../components/shared/ArtifactHeader.js", () => ({
  ArtifactHeader: ({ title, badge }: { title: string; badge: string }) => (
    <div data-testid="artifact-header">{title} - {badge}</div>
  ),
}));

vi.mock("../../components/shared/FileDropZone.js", () => ({
  FileDropZone: () => <div data-testid="file-drop-zone">DropZone</div>,
}));

describe("PlanningPhase", () => {
  let mockRunStage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useChatStore.getState().clearMessages();

    mockRunStage = vi.fn().mockResolvedValue({
      success: true,
      sessionId: "",
      cost: { estimatedCost: 1.0, duration: "3m 10s" },
    });

    window.electronAPI = {
      runStage: mockRunStage,
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
      openDirectory: vi.fn(),
      openFile: vi.fn(),
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
    } as unknown as ElectronAPI;

    useProjectStore.setState({
      activeProjectName: "test-project",
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", currentStage: "plan" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders the textarea for planning notes", async () => {
    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    const textarea = screen.getByPlaceholderText("Add planning notes or constraints...");
    expect(textarea).toBeDefined();
  });

  it("textarea is controlled via local state", async () => {
    const { PlanningPhase } = await import("../../components/planning/PlanningPhase.js");
    render(<PlanningPhase />);

    const textarea = screen.getByPlaceholderText("Add planning notes or constraints...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Focus on API endpoints" } });
    expect(textarea.value).toBe("Focus on API endpoints");
  });

  it("forwards notes as brief option in runStage call", async () => {
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

  it("handles runStage exception with error message", async () => {
    mockRunStage.mockRejectedValue(new Error("plan generation failed"));

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
