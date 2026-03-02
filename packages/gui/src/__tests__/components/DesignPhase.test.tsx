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
  FileDropZone: ({ onFilePath }: { onFilePath: (p: string) => void }) => (
    <button data-testid="file-drop-zone" onClick={() => onFilePath("/tmp/brief.md")}>
      DropZone
    </button>
  ),
}));

describe("DesignPhase", () => {
  let mockRunStage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useChatStore.getState().clearMessages();

    mockRunStage = vi.fn().mockResolvedValue({
      success: true,
      sessionId: "",
      cost: { estimatedCost: 1.5, duration: "4m 20s" },
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
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", currentStage: "design" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders the textarea for design brief", async () => {
    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    const textarea = screen.getByPlaceholderText("Describe your architectural requirements...");
    expect(textarea).toBeDefined();
  });

  it("textarea is controlled via local state", async () => {
    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    const textarea = screen.getByPlaceholderText("Describe your architectural requirements...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Microservice architecture" } });
    expect(textarea.value).toBe("Microservice architecture");
  });

  it("forwards brief as option in runStage call", async () => {
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

  it("does not set options.brief when brief is empty", async () => {
    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    const button = screen.getByRole("button", { name: /RUN DESIGN/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(mockRunStage).toHaveBeenCalledWith({
        projectName: "test-project",
        stage: "design",
        options: { brief: undefined, briefFile: undefined, excludeStyle: undefined },
      });
    });
  });

  it("passes excludeStyle when toggled on", async () => {
    const { DesignPhase } = await import("../../components/design/DesignPhase.js");
    render(<DesignPhase />);

    // Toggle the excludeStyle switch
    const toggle = screen.getByText("Exclude UI").closest("div")!.querySelector("button")!;
    fireEvent.click(toggle);

    const button = screen.getByRole("button", { name: /RUN DESIGN/i });
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(mockRunStage).toHaveBeenCalledWith({
        projectName: "test-project",
        stage: "design",
        options: { brief: undefined, briefFile: undefined, excludeStyle: true },
      });
    });
  });

  it("handles runStage exception with error message", async () => {
    mockRunStage.mockRejectedValue(new Error("design generation failed"));

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
});
