import React from "react";
import { render, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import type { SessionEvent } from "@proteus-forge/shared";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";

// Mock all phase components to simplify rendering
vi.mock("../../components/chrome/TopBar.js", () => ({
  TopBar: () => <div data-testid="topbar" />,
}));
vi.mock("../../components/chrome/ProgressBar.js", () => ({
  ProgressBar: () => <div data-testid="progressbar" />,
}));
vi.mock("../../components/chrome/PhaseTabStrip.js", () => ({
  PhaseTabStrip: () => <div data-testid="tabstrip" />,
}));
let capturedOnComplete: (() => void) | undefined;
let capturedOnDestroy: (() => void) | undefined;
vi.mock("../../components/chrome/CompleteBar.js", () => ({
  CompleteBar: ({ onComplete, onDestroy }: { onComplete: () => void; onDestroy: () => void }) => {
    capturedOnComplete = onComplete;
    capturedOnDestroy = onDestroy;
    return <div data-testid="completebar" />;
  },
}));
vi.mock("../../components/chrome/AIChatPanel.js", () => ({
  AIChatPanel: () => <div data-testid="chatpanel" />,
}));
vi.mock("../../components/dialogs/NewProjectDialog.js", () => ({
  NewProjectDialog: () => null,
}));
vi.mock("../../components/inspection/InspectionPhase.js", () => ({
  InspectionPhase: () => <div>Inspect</div>,
}));
vi.mock("../../components/design/DesignPhase.js", () => ({
  DesignPhase: () => <div>Design</div>,
}));
vi.mock("../../components/planning/PlanningPhase.js", () => ({
  PlanningPhase: () => <div>Plan</div>,
}));
vi.mock("../../components/breakdown/BreakdownPhase.js", () => ({
  BreakdownPhase: () => <div>Breakdown</div>,
}));
vi.mock("../../components/execution/ExecutionPhase.js", () => ({
  ExecutionPhase: () => <div>Execute</div>,
}));

describe("App", () => {
  let logCallback: (msg: string) => void;
  let warnCallback: (msg: string) => void;
  let errorCallback: (msg: string) => void;
  let eventCallback: (event: unknown) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useChatStore.getState().clearMessages();

    window.electronAPI = {
      runStage: vi.fn(),
      readArtifacts: vi.fn(),
      listProjects: vi.fn().mockResolvedValue({ projects: {} }),
      getActiveProject: vi.fn(),
      setActiveProject: vi.fn(),
      createProject: vi.fn(),
      destroyProject: vi.fn(),
      getProjectStatus: vi.fn().mockResolvedValue({ statuses: [], staleness: [] }),
      readGlobalConfig: vi.fn(),
      abortStage: vi.fn(),
      onSessionEvent: vi.fn((cb: (event: unknown) => void) => {
        eventCallback = cb;
        return () => {};
      }),
      onReporterLog: vi.fn((cb: (msg: string) => void) => {
        logCallback = cb;
        return () => {};
      }),
      onReporterWarn: vi.fn((cb: (msg: string) => void) => {
        warnCallback = cb;
        return () => {};
      }),
      onReporterError: vi.fn((cb: (msg: string) => void) => {
        errorCallback = cb;
        return () => {};
      }),
      sendMessage: vi.fn(),
      readCosts: vi.fn(),
      openDirectory: vi.fn(),
      openFile: vi.fn(),
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
      updateProject: vi.fn(),
    } as unknown as ElectronAPI;

    useProjectStore.setState({
      activeProjectName: "test-project",
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", currentStage: "inspect" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("subscribes to all IPC event channels on mount", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    expect(window.electronAPI.onReporterLog).toHaveBeenCalled();
    expect(window.electronAPI.onReporterWarn).toHaveBeenCalled();
    expect(window.electronAPI.onReporterError).toHaveBeenCalled();
    expect(window.electronAPI.onSessionEvent).toHaveBeenCalled();
  });

  it("pipes reporter log messages to chat store and session store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    logCallback("Build completed successfully");

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text === "Build completed successfully")).toBe(true);
    });

    const logs = useSessionStore.getState().logs;
    expect(logs).toContain("Build completed successfully");
  });

  it("pipes reporter error messages to chat store and session store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    errorCallback("Something went wrong");

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text === "[error] Something went wrong")).toBe(true);
    });

    const errors = useSessionStore.getState().errors;
    expect(errors).toContain("Something went wrong");
  });

  it("routes agent-spawned session events to chat", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    const event: SessionEvent = {
      type: "agent-spawned",
      agentName: "researcher",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text.includes("Spawning teammate: researcher"))).toBe(true);
    });
  });

  it("routes agent-activity session events to chat", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    const event: SessionEvent = {
      type: "agent-activity",
      agentName: "scout",
      message: "Scanning source files",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text.includes("[scout] Scanning source files"))).toBe(true);
    });
  });

  it("routes agent-done session events to chat", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    const event: SessionEvent = {
      type: "agent-done",
      agentName: "architect",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text.includes("architect done"))).toBe(true);
    });
  });

  it("does not add chat messages for progress events", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    const msgCountBefore = useChatStore.getState().messages.length;

    const event: SessionEvent = {
      type: "progress",
      message: "50% complete",
      timestamp: Date.now(),
    };
    eventCallback(event);

    // Wait a tick and verify no new message was added
    await new Promise((r) => setTimeout(r, 50));
    expect(useChatStore.getState().messages.length).toBe(msgCountBefore);
  });

  it("ignores empty/whitespace log messages", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    const msgCountBefore = useChatStore.getState().messages.length;
    logCallback("   ");

    await new Promise((r) => setTimeout(r, 50));
    expect(useChatStore.getState().messages.length).toBe(msgCountBefore);
  });

  it("shows welcome screen when no active project", async () => {
    useProjectStore.setState({ activeProjectName: null, activeEntry: null });

    const { App } = await import("../../App.js");
    const { container } = render(<App />);

    expect(container.textContent).toContain("Start New");
  });

  it("routes session-start events with message to chat", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    const event: SessionEvent = {
      type: "session-start",
      message: "Session started",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text === "Session started")).toBe(true);
    });
  });

  it("routes session-end events with message to chat", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    const event: SessionEvent = {
      type: "session-end",
      message: "Session complete",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text === "Session complete")).toBe(true);
    });
  });

  it("pipes warn messages to chat", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    warnCallback("Stale artifact detected");

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text === "[warn] Stale artifact detected")).toBe(true);
    });
  });

  it("handleComplete advances phase and refreshes status", async () => {
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ refreshStatus: refreshSpy } as never);

    const { App } = await import("../../App.js");
    render(<App />);

    // Default phase is "inspect", completing should advance to "design"
    expect(capturedOnComplete).toBeDefined();
    capturedOnComplete!();

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  it("handleDestroy moves phase back and refreshes status", async () => {
    // Start on "design" phase (set via stageStatuses)
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ refreshStatus: refreshSpy } as never);

    const { App } = await import("../../App.js");
    render(<App />);

    // Wait for initial phase to be set from stageStatuses
    await waitFor(() => {
      expect(capturedOnDestroy).toBeDefined();
    });

    capturedOnDestroy!();

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  it("uses agentId fallback when agentName is missing in agent-spawned", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    const event: SessionEvent = {
      type: "agent-spawned",
      agentId: "agent-123",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const messages = useChatStore.getState().messages;
      expect(messages.some((m) => m.text.includes("Spawning teammate: agent-123"))).toBe(true);
    });
  });
});
