import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useAgentStore } from "../../stores/agent-store.js";
import { useProjectStore } from "../../stores/project-store.js";
import type { AgentTree } from "../../stores/agent-store.js";

vi.mock("../../components/shared/AgentActivityTree.js", () => ({
  AgentActivityTree: ({ stage }: { stage: string }) => <div data-testid={`tree-${stage}`} />,
}));

function makeTree(agentCount: number, startTime: number, endTime: number): AgentTree {
  const agents = new Map();
  agents.set("lead", {
    id: "lead", name: "Lead", color: "#00ff88",
    status: "done", parentId: null, messages: [], startTime, endTime,
  });
  for (let i = 1; i < agentCount; i++) {
    agents.set(`agent-${i}`, {
      id: `agent-${i}`, name: `agent-${i}`, color: "#888",
      status: "done", parentId: "lead", messages: [], startTime, endTime,
    });
  }
  return { agents, rootIds: Array.from(agents.keys()), startTime, endTime };
}

describe("LogTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentStore.getState().reset();

    window.electronAPI = {
      exportSessionLogs: vi.fn().mockResolvedValue("/exported.json"),
      saveSessionLog: vi.fn(),
      readSessionLogs: vi.fn(),
      sendMessage: vi.fn(),
      runStage: vi.fn(),
      readArtifacts: vi.fn(),
      listProjects: vi.fn(),
      getActiveProject: vi.fn(),
      setActiveProject: vi.fn(),
      createProject: vi.fn(),
      destroyProject: vi.fn(),
      getProjectStatus: vi.fn(),
      readGlobalConfig: vi.fn(),
      abortStage: vi.fn(),
      onSessionEvent: vi.fn().mockReturnValue(() => {}),
      onReporterLog: vi.fn().mockReturnValue(() => {}),
      onReporterWarn: vi.fn().mockReturnValue(() => {}),
      onReporterError: vi.fn().mockReturnValue(() => {}),
      readCosts: vi.fn(),
      openDirectory: vi.fn(),
      openFile: vi.fn(),
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
      updateProject: vi.fn(),
    } as unknown as ElectronAPI;

    useProjectStore.setState({
      activeEntry: { source: "/src", target: "/tgt", createdAt: "", lastCompletedStage: "" },
    });
  });

  it("renders empty state when no logs exist", async () => {
    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    expect(screen.getByTestId("log-tab")).toBeDefined();
    expect(screen.getByText("No session logs yet. Run a stage to generate logs.")).toBeDefined();
  });

  it("renders stage sections for available logs", async () => {
    useAgentStore.getState().loadPhaseHistory("inspect", makeTree(3, 1000, 136000));

    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    expect(screen.getByTestId("log-stage-inspect")).toBeDefined();
    expect(screen.getByText("Inspection")).toBeDefined();
    expect(screen.getByText(/3 agents/)).toBeDefined();
  });

  it("toggles stage expansion on click", async () => {
    useAgentStore.getState().loadPhaseHistory("inspect", makeTree(2, 1000, 61000));

    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    // Not expanded initially
    expect(screen.queryByTestId("tree-inspect")).toBeNull();

    // Click to expand
    fireEvent.click(screen.getByTestId("log-stage-inspect"));
    expect(screen.getByTestId("tree-inspect")).toBeDefined();

    // Click to collapse
    fireEvent.click(screen.getByTestId("log-stage-inspect"));
    expect(screen.queryByTestId("tree-inspect")).toBeNull();
  });

  it("shows stages without logs", async () => {
    useAgentStore.getState().loadPhaseHistory("inspect", makeTree(1, 1000, 2000));

    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    expect(screen.getByTestId("no-logs-message")).toBeDefined();
  });

  it("disables export when no logs", async () => {
    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    const btn = screen.getByTestId("export-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables export when logs exist", async () => {
    useAgentStore.getState().loadPhaseHistory("inspect", makeTree(1, 1000, 2000));

    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    const btn = screen.getByTestId("export-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls exportSessionLogs on export click", async () => {
    useAgentStore.getState().loadPhaseHistory("inspect", makeTree(1, 1000, 2000));

    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    fireEvent.click(screen.getByTestId("export-button"));
    expect(window.electronAPI.exportSessionLogs).toHaveBeenCalledWith("/tgt");
  });

  it("formats duration correctly", async () => {
    // 2m 15s = 135000ms
    useAgentStore.getState().loadPhaseHistory("inspect", makeTree(3, 1000, 136000));

    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    expect(screen.getByText(/2m 15s/)).toBeDefined();
  });

  it("renders multiple stages", async () => {
    useAgentStore.getState().loadPhaseHistory("inspect", makeTree(2, 1000, 5000));
    useAgentStore.getState().loadPhaseHistory("design", makeTree(4, 6000, 20000));

    const { LogTab } = await import("../../components/log/LogTab.js");
    render(<LogTab />);

    expect(screen.getByTestId("log-stage-inspect")).toBeDefined();
    expect(screen.getByTestId("log-stage-design")).toBeDefined();
  });
});
