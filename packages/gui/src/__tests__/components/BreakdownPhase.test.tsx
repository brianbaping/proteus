import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

vi.mock("../../components/shared/ArtifactHeader.js", () => ({
  ArtifactHeader: ({ title, badge }: { title: string; badge: string }) => (
    <div data-testid="artifact-header">{title} - {badge}</div>
  ),
}));

vi.mock("../../components/shared/FileDropZone.js", () => ({
  FileDropZone: () => <div data-testid="file-drop-zone">DropZone</div>,
}));

describe("BreakdownPhase", () => {
  let mockRunStage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useChatStore.getState().clearMessages();

    mockRunStage = vi.fn().mockResolvedValue({
      success: true,
      sessionId: "",
      cost: { estimatedCost: 0.8, duration: "2m 5s" },
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
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", currentStage: "split" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders the textarea for breakdown notes", async () => {
    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    const textarea = screen.getByPlaceholderText("Add breakdown notes...");
    expect(textarea).toBeDefined();
  });

  it("textarea is controlled via local state", async () => {
    const { BreakdownPhase } = await import("../../components/breakdown/BreakdownPhase.js");
    render(<BreakdownPhase />);

    const textarea = screen.getByPlaceholderText("Add breakdown notes...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Split by domain" } });
    expect(textarea.value).toBe("Split by domain");
  });

  it("forwards notes as brief option in runStage call", async () => {
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

  it("handles runStage exception with error message", async () => {
    mockRunStage.mockRejectedValue(new Error("breakdown failed"));

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
});
