import React from "react";
import { render, screen } from "@testing-library/react";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import type { ElectronAPI } from "#electron/preload.js";

vi.mock("../../components/shared/ArtifactHeader.js", () => ({
  ArtifactHeader: ({ title, badge, actions }: { title: string; badge: string; actions?: React.ReactNode }) => (
    <div data-testid="artifact-header">{title} - {badge}{actions}</div>
  ),
}));

vi.mock("../../components/shared/StatCard.js", () => ({
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid={`stat-${label}`}>{value}</div>
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
      activeEntry: { source: "/s", target: "/t", createdAt: "", currentStage: "plan" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders empty state when no data and not running", async () => {
    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={null} />);

    expect(screen.getByText("Approve plan to generate task DAG with execution waves")).toBeDefined();
  });

  it("renders running state when running with no data", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "plan" });

    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={null} />);

    expect(screen.getByText("Generating execution plan...")).toBeDefined();
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
      artifacts: [{ name: "plan.json", size: "5 tasks", icon: "\u{1f4cb}" }],
    };

    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={data} />);

    expect(screen.getByText("Wave 1")).toBeDefined();
    expect(screen.getByText("Wave 2")).toBeDefined();
    expect(screen.getByText("Foundation tasks")).toBeDefined();
    expect(screen.getByText("Setup project")).toBeDefined();
    expect(screen.getByText("Implement auth")).toBeDefined();
    expect(screen.getAllByText("task-001").length).toBeGreaterThan(0);
    expect(screen.getByText("plan.json")).toBeDefined();
  });

  it("renders export buttons when plan is complete", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "plan", complete: true, artifactPath: "/p" }] as never,
    });

    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={null} />);

    expect(screen.getByText("Export JSON")).toBeDefined();
    expect(screen.getByText("Export MD")).toBeDefined();
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
      artifacts: [],
    };

    const { PlanningCanvas } = await import("../../components/planning/PlanningCanvas.js");
    render(<PlanningCanvas data={data} />);

    expect(screen.getByText("Task")).toBeDefined();
  });
});
