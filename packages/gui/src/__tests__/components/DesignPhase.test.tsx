import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

vi.mock("../../components/shared/FileDropZone.js", () => ({
  FileDropZone: ({ onFilePath }: { onFilePath: (p: string) => void }) => (
    <button data-testid="file-drop-zone" onClick={() => onFilePath("/tmp/brief.md")}>
      DropZone
    </button>
  ),
}));

vi.mock("../../components/design/DesignCanvas.js", () => ({
  DesignCanvas: ({ data }: { data: unknown }) => (
    <div data-testid="canvas">{data ? "has-data" : "no-data"}</div>
  ),
}));

describe("DesignPhase", () => {
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
      cost: { estimatedCost: 1.5, duration: "4m 20s" },
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
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", lastCompletedStage: "design" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
      ...overrides,
    });
  }

  it("loads artifacts on mount when design stage is complete", async () => {
    const designMeta = {
      architectureStyle: "modular-monolith",
      targetStack: { runtime: "Node.js 22", framework: "Express" },
      services: [{ id: "svc-auth", name: "Auth", discipline: "backend" }],
      featureToServiceMap: { "feat-001": "svc-auth" },
    };
    mockReadArtifacts.mockResolvedValue({ designMeta, designMd: "# Design" });

    setProjectStoreState({
      stageStatuses: [{ stage: "design", complete: true, artifactPath: "/p" }] as never,
    });

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    await waitFor(() => {
      expect(mockReadArtifacts).toHaveBeenCalledWith("/tgt", "design");
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas").textContent).toBe("has-data");
    });
  });

  it("does not load artifacts on mount when design stage is incomplete", async () => {
    setProjectStoreState({
      stageStatuses: [{ stage: "design", complete: false, artifactPath: "/p" }] as never,
    });

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockReadArtifacts).not.toHaveBeenCalled();
  });

  it("shows canvas with no data when artifacts are not available", async () => {
    setProjectStoreState({ stageStatuses: [] });
    mockReadArtifacts.mockResolvedValue(null);

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    expect(screen.getByTestId("canvas").textContent).toBe("no-data");
  });

  it("handles readArtifacts failure gracefully", async () => {
    mockReadArtifacts.mockRejectedValue(new Error("file not found"));

    setProjectStoreState({
      stageStatuses: [{ stage: "design", complete: true, artifactPath: "/p" }] as never,
    });

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    await waitFor(() => {
      expect(screen.getByTestId("canvas").textContent).toBe("no-data");
    });
  });

  it("renders the textarea for design brief", async () => {
    setProjectStoreState({});

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    const textarea = screen.getByPlaceholderText("Describe your architectural requirements...");
    expect(textarea).toBeDefined();
  });

  it("textarea is controlled via local state", async () => {
    setProjectStoreState({});

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    const textarea = screen.getByPlaceholderText("Describe your architectural requirements...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Microservice architecture" } });
    expect(textarea.value).toBe("Microservice architecture");
  });

  it("forwards brief as option in runStage call", async () => {
    setProjectStoreState({});

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    const textarea = screen.getByPlaceholderText("Describe your architectural requirements...");
    fireEvent.change(textarea, { target: { value: "Microservice architecture" } });

    const button = screen.getByRole("button", { name: /RUN DESIGN/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(mockRunStage).toHaveBeenCalledWith({
        projectName: "test-project",
        stage: "design",
        options: { brief: "Microservice architecture", briefFile: undefined, excludeStyle: undefined },
      });
    });
  });

  it("loads artifacts after successful run", async () => {
    const designMeta = {
      architectureStyle: "microservices",
      targetStack: { runtime: "Node.js" },
      services: [],
    };
    mockRunStage.mockResolvedValue({
      success: true,
      sessionId: "s1",
      cost: { estimatedCost: 1.5, duration: "4m" },
    });
    mockReadArtifacts
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ designMeta, designMd: "# Design" });

    setProjectStoreState({ stageStatuses: [] });

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /RUN DESIGN/i }));
    });

    await waitFor(() => {
      expect(mockReadArtifacts).toHaveBeenCalledWith("/tgt", "design");
    });

    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("Design complete"))).toBe(true);
  });

  it("calls abortStage when stop button is clicked during run", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "design" });
    setProjectStoreState({});

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /STOP/i }));
    });

    expect(window.electronAPI.abortStage).toHaveBeenCalled();
    expect(useSessionStore.getState().isRunning).toBe(false);
    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("aborted"))).toBe(true);
  });

  it("handles runStage exception with error message", async () => {
    mockRunStage.mockRejectedValue(new Error("design generation failed"));

    setProjectStoreState({});

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /RUN DESIGN/i }));
    });

    await waitFor(() => {
      const session = useSessionStore.getState();
      expect(session.isRunning).toBe(false);
      expect(session.cost).toBe(0);
    });

    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.text.includes("design generation failed"))).toBe(true);
  });

  it("disables Run button when phase is already completed", async () => {
    useSessionStore.setState({ completedStages: ["design"] });

    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    const button = screen.getByRole("button", { name: /RUN DESIGN/i });
    expect(button.disabled).toBe(true);
    expect(button.className).toContain("opacity-50");
  });
});
