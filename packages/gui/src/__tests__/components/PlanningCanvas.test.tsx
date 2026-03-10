import React from "react";
import { render, screen } from "@testing-library/react";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import type { ElectronAPI } from "#electron/preload.js";

vi.mock("../../components/shared/ArtifactHeader.js", () => ({
  ArtifactHeader: ({ title, badge }: { title: string; badge: string }) => (
    <div data-testid="artifact-header">{title} - {badge}</div>
  ),
}));

vi.mock("../../components/shared/StatCard.js", () => ({
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid={`stat-${label}`}>{value}</div>
  ),
}));

vi.mock("../../components/shared/ArtifactList.js", () => ({
  ArtifactList: ({ title, files }: { title: string; files: Array<{ name: string }> }) => (
    <div data-testid="artifact-list">{title}: {files.map((f) => f.name).join(", ")}</div>
  ),
}));

vi.mock("../../components/shared/AgentActivityTree.js", () => ({
  AgentActivityTree: ({ stage, collapsed }: { stage: string; collapsed?: boolean }) => (
    <div data-testid={collapsed ? "session-log" : "activity-tree"}>{stage}</div>
  ),
}));

describe("PlanningCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();

    window.electronAPI = {
      saveFile: vi.fn(),
      readArtifacts: vi.fn(),
      runStage: vi.fn(),
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
      cloneRepo: vi.fn(),
      updateProject: vi.fn(),
    } as unknown as ElectronAPI;

    useProjectStore.setState({
      activeProjectName: "test",
      activeEntry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "plan" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders empty state when no data and not running", async () => {
    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={null} files={[]} />);

    expect(screen.getByText("Approve plan to generate task DAG with execution waves")).toBeDefined();
  });

  it("renders running state when running with no data", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "plan" });

    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={null} files={[]} />);

    expect(screen.getByTestId("activity-tree")).toBeDefined();
  });

  it("renders waves, tasks, and critical path when data is provided", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "plan", complete: true, artifactPath: "/p" }] as never,
    });

    const data = {
      totalTasks: 5,
      waveCount: 2,
      criticalPathLength: 3,
      disciplines: ["shared", "backend"],
      waves: [
        {
          wave: 1,
          tasks: ["task-001"],
          rationale: "Foundation tasks",
          taskDetails: [
            { id: "task-001", title: "Setup project", discipline: "shared", estimatedComplexity: "low", testingExpectation: "none" },
          ],
        },
        {
          wave: 2,
          tasks: ["task-002"],
          rationale: "Backend work",
          taskDetails: [
            { id: "task-002", title: "Implement auth", discipline: "backend", estimatedComplexity: "high", testingExpectation: "unit" },
          ],
        },
      ],
      criticalPath: ["task-001", "task-002", "task-003"],
    };

    const files = [{ name: "plan.json", size: 2048 }];

    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={data} files={files} />);

    expect(screen.getByText("Wave 1")).toBeDefined();
    expect(screen.getByText("Wave 2")).toBeDefined();
    expect(screen.getByText("Foundation tasks")).toBeDefined();
    expect(screen.getByText("Setup project")).toBeDefined();
    expect(screen.getByText("Implement auth")).toBeDefined();
    expect(screen.getAllByText("task-001").length).toBeGreaterThan(0);
    expect(screen.getByTestId("artifact-list")).toBeDefined();
  });

  it("renders artifact list when plan is complete", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "plan", complete: true, artifactPath: "/p" }] as never,
    });

    const files = [{ name: "plan.json", size: 1024 }, { name: "plan.md", size: 4096 }];

    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={null} files={files} />);

    expect(screen.getByText(/plan\.json/)).toBeDefined();
    expect(screen.getByText(/plan\.md/)).toBeDefined();
  });

  it("renders task with unknown complexity/testing gracefully", async () => {
    const data = {
      totalTasks: 1,
      waveCount: 1,
      criticalPathLength: 0,
      disciplines: ["backend"],
      waves: [
        {
          wave: 1,
          tasks: ["task-001"],
          taskDetails: [
            { id: "task-001", title: "Task", discipline: "backend", estimatedComplexity: "extreme", testingExpectation: "e2e" },
          ],
        },
      ],
      criticalPath: [],
    };

    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={data} files={[]} />);

    expect(screen.getByText("Task")).toBeDefined();
  });
});
