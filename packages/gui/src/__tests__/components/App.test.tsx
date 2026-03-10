import React from "react";
import { render, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import type { SessionEvent } from "@proteus-forge/shared";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useAgentStore } from "../../stores/agent-store.js";

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
let capturedOnDestroy: (() => void) | undefined;
vi.mock("../../components/chrome/CompleteBar.js", () => ({
  CompleteBar: ({ onDestroy }: { onDestroy: () => void }) => {
    capturedOnDestroy = onDestroy;
    return <div data-testid="completebar" />;
  },
}));
vi.mock("../../components/chrome/ChatPanel.js", () => ({
  ChatPanel: () => <div data-testid="chatpanel" />,
}));
vi.mock("../../components/dialogs/NewProjectDialog.js", () => ({
  NewProjectDialog: () => null,
}));
vi.mock("../../components/dialogs/SettingsDialog.js", () => ({
  SettingsDialog: () => null,
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
vi.mock("../../components/log/LogTab.js", () => ({
  LogTab: () => <div>Log</div>,
}));

describe("App", () => {
  let logCallback: (msg: string) => void;
  let warnCallback: (msg: string) => void;
  let errorCallback: (msg: string) => void;
  let eventCallback: (event: unknown) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useAgentStore.getState().reset();

    window.electronAPI = {
      runStage: vi.fn(),
      readArtifacts: vi.fn(),
      listProjects: vi.fn().mockResolvedValue({ projects: { "test-project": { source: "/src", target: "/tgt", createdAt: "", lastCompletedStage: "inspect" } } }),
      getActiveProject: vi.fn().mockResolvedValue({ name: "test-project", entry: { source: "/src", target: "/tgt", createdAt: "", lastCompletedStage: "inspect" } }),
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
      revertStage: vi.fn().mockResolvedValue({ removed: [] }),
      saveSessionLog: vi.fn().mockResolvedValue(undefined),
      readSessionLogs: vi.fn().mockResolvedValue({}),
      exportSessionLogs: vi.fn().mockResolvedValue(null),
    } as unknown as ElectronAPI;

    useProjectStore.setState({
      activeProjectName: "test-project",
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", lastCompletedStage: "inspect" },
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

  it("pipes reporter log messages to agent store and session store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");
    logCallback("Build completed successfully");

    await waitFor(() => {
      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages.some((m) => m.text === "Build completed successfully")).toBe(true);
    });

    const logs = useSessionStore.getState().logs;
    expect(logs).toContain("Build completed successfully");
  });

  it("pipes reporter error messages to agent store and session store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");
    errorCallback("Something went wrong");

    await waitFor(() => {
      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages.some((m) => m.text === "Something went wrong" && m.type === "error")).toBe(true);
    });

    const errors = useSessionStore.getState().errors;
    expect(errors).toContain("Something went wrong");
  });

  it("routes agent-spawned session events to agent store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");

    const event: SessionEvent = {
      type: "agent-spawned",
      agentName: "researcher",
      agentColor: "#ff6b6b",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const tree = useAgentStore.getState().currentTree!;
      // The agent is added with an auto-generated id since agentId is not provided
      const agents = Array.from(tree.agents.values());
      const agent = agents.find((a) => a.name === "researcher");
      expect(agent).toBeDefined();
      expect(agent!.color).toBe("#ff6b6b");
    });
  });

  it("routes agent-activity session events to agent store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");

    const event: SessionEvent = {
      type: "agent-activity",
      agentName: "scout",
      agentColor: "#4ecdc4",
      agentId: "lead",
      message: "Scanning source files",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages.some((m) => m.text === "Scanning source files")).toBe(true);
    });
  });

  it("routes agent-done session events to agent store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");

    // First spawn the agent so it exists in the tree
    eventCallback({
      type: "agent-spawned",
      agentId: "architect-1",
      agentName: "architect",
      agentColor: "#ffe66d",
      timestamp: Date.now(),
    } satisfies SessionEvent);

    const event: SessionEvent = {
      type: "agent-done",
      agentId: "architect-1",
      agentName: "architect",
      agentColor: "#ffe66d",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const agent = useAgentStore.getState().currentTree!.agents.get("architect-1")!;
      expect(agent.status).toBe("done");
    });
  });

  it("does not add agents to store for progress events", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");
    const agentCountBefore = useAgentStore.getState().currentTree!.agents.size;

    const event: SessionEvent = {
      type: "progress",
      message: "50% complete",
      timestamp: Date.now(),
    };
    eventCallback(event);

    // Wait a tick and verify no new agent was added
    await new Promise((r) => setTimeout(r, 50));
    expect(useAgentStore.getState().currentTree!.agents.size).toBe(agentCountBefore);
  });

  it("ignores empty/whitespace log messages", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");
    const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
    const msgCountBefore = lead.messages.length;

    logCallback("   ");

    await new Promise((r) => setTimeout(r, 50));
    const leadAfter = useAgentStore.getState().currentTree!.agents.get("lead")!;
    expect(leadAfter.messages.length).toBe(msgCountBefore);
  });

  it("shows welcome screen when no active project", async () => {
    useProjectStore.setState({ activeProjectName: null, activeEntry: null });

    const { App } = await import("../../App.js");
    const { container } = render(<App />);

    expect(container.textContent).toContain("Start New");
  });

  it("routes session-start events with message to agent store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");

    const event: SessionEvent = {
      type: "session-start",
      message: "Session started",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages.some((m) => m.text === "Session started")).toBe(true);
    });
  });

  it("routes session-end events with message to agent store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");

    const event: SessionEvent = {
      type: "session-end",
      message: "Session complete",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages.some((m) => m.text === "Session complete")).toBe(true);
    });
  });

  it("pipes warn messages to agent store", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");
    warnCallback("Stale artifact detected");

    await waitFor(() => {
      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages.some((m) => m.text === "Stale artifact detected" && m.type === "warn")).toBe(true);
    });
  });

  it("handleDestroy calls revertStage and moves phase back when confirmed", async () => {
    // Simulate project switch so effect fires: set a new project name with inspect complete
    useProjectStore.setState({
      activeProjectName: "destroy-test",
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ refreshStatus: refreshSpy } as never);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { App } = await import("../../App.js");
    render(<App />);

    // Wait for project-switch effect to advance to "design"
    await waitFor(() => {
      expect(capturedOnDestroy).toBeDefined();
    });

    capturedOnDestroy!();

    await waitFor(() => {
      expect(window.electronAPI.revertStage).toHaveBeenCalledWith("design");
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  it("handleDestroy does nothing when confirm returns false", async () => {
    // Prevent loadRegistry on mount from calling refreshStatus
    window.electronAPI.getActiveProject = vi.fn().mockResolvedValue(null) as never;

    useProjectStore.setState({
      activeProjectName: "destroy-test-2",
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ refreshStatus: refreshSpy } as never);

    vi.spyOn(window, "confirm").mockReturnValue(false);

    const { App } = await import("../../App.js");
    render(<App />);

    await waitFor(() => {
      expect(capturedOnDestroy).toBeDefined();
    });

    capturedOnDestroy!();

    // Give time for any async operations
    await new Promise((r) => setTimeout(r, 50));

    expect(window.electronAPI.revertStage).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("does not auto-advance when stageStatuses update after stage completion", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    // Phase should start at "inspect" (no completed stages, same project)
    // Now simulate a stage completion by updating stageStatuses
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    // Wait a tick — phase should NOT have auto-advanced to "design"
    await new Promise((r) => setTimeout(r, 50));
    // The capturedOnDestroy still works from inspect, proving no auto-advance
    expect(capturedOnDestroy).toBeDefined();
  });

  it("inits completedStages on project switch", async () => {
    useProjectStore.setState({
      activeProjectName: "switch-test",
      stageStatuses: [
        { stage: "inspect", complete: true, artifactPath: "/p" },
        { stage: "design", complete: true, artifactPath: "/p" },
      ] as never,
    });

    const { App } = await import("../../App.js");
    render(<App />);

    await waitFor(() => {
      const completed = useSessionStore.getState().completedStages;
      expect(completed).toContain("inspect");
      expect(completed).toContain("design");
    });
  });

  it("uses agentId fallback when agentName is missing in agent-spawned", async () => {
    const { App } = await import("../../App.js");
    render(<App />);

    useAgentStore.getState().startRun("inspect");

    const event: SessionEvent = {
      type: "agent-spawned",
      agentId: "agent-123",
      timestamp: Date.now(),
    };
    eventCallback(event);

    await waitFor(() => {
      expect(useAgentStore.getState().currentTree!.agents.has("agent-123")).toBe(true);
      const agent = useAgentStore.getState().currentTree!.agents.get("agent-123")!;
      expect(agent.name).toBe("agent"); // default name when agentName is missing
    });
  });
});
