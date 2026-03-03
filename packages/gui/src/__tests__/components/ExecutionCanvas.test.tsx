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

describe("ExecutionCanvas", () => {
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
      activeEntry: { source: "/s", target: "/t", createdAt: "", currentStage: "execute" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders empty state when no data and not running", async () => {
    const { ExecutionCanvas } = await import("../../components/execution/ExecutionCanvas.js");
    render(<ExecutionCanvas data={null} />);

    expect(screen.getByText('Click "Build Candidate" to start production code generation')).toBeDefined();
  });

  it("renders running state when running with no data", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "execute" });

    const { ExecutionCanvas } = await import("../../components/execution/ExecutionCanvas.js");
    render(<ExecutionCanvas data={null} />);

    expect(screen.getByText("Agent Team executing production build...")).toBeDefined();
  });

  it("renders stats, session details, and progress when data is provided", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "execute", complete: true, artifactPath: "/p" }] as never,
    });

    const data = {
      totalTasks: 14,
      completed: 14,
      failed: 0,
      successRate: "100%",
      status: "completed",
      sessionId: "sess-abc",
      startedAt: "2026-02-19T15:36:00Z",
      completedAt: "2026-02-19T15:57:00Z",
      duration: "21m 0s",
      artifacts: [{ name: "session.json", size: "14 tasks", icon: "\u{1f4cb}" }],
    };

    const { ExecutionCanvas } = await import("../../components/execution/ExecutionCanvas.js");
    render(<ExecutionCanvas data={data} />);

    expect(screen.getByText("sess-abc")).toBeDefined();
    expect(screen.getByText("21m 0s")).toBeDefined();
    expect(screen.getByText("14 completed")).toBeDefined();
    expect(screen.getByText("14 total")).toBeDefined();
    expect(screen.getByText("session.json")).toBeDefined();
  });

  it("renders failed task count in progress bar", async () => {
    const data = {
      totalTasks: 10,
      completed: 8,
      failed: 2,
      successRate: "80%",
      status: "partial",
      sessionId: "sess-xyz",
      startedAt: "2026-02-19T15:36:00Z",
      completedAt: "2026-02-19T15:57:00Z",
      duration: "21m 0s",
      artifacts: [],
    };

    const { ExecutionCanvas } = await import("../../components/execution/ExecutionCanvas.js");
    render(<ExecutionCanvas data={data} />);

    expect(screen.getByText("2 failed")).toBeDefined();
    expect(screen.getByText("8 completed")).toBeDefined();
  });

  it("renders export button when execute is complete", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "execute", complete: true, artifactPath: "/p" }] as never,
    });

    const { ExecutionCanvas } = await import("../../components/execution/ExecutionCanvas.js");
    render(<ExecutionCanvas data={null} />);

    expect(screen.getByText("Export JSON")).toBeDefined();
  });

  it("renders with unknown status style gracefully", async () => {
    const data = {
      totalTasks: 0,
      completed: 0,
      failed: 0,
      successRate: "—",
      status: "unknown",
      sessionId: "",
      startedAt: "",
      completedAt: "",
      duration: "—",
      artifacts: [],
    };

    const { ExecutionCanvas } = await import("../../components/execution/ExecutionCanvas.js");
    render(<ExecutionCanvas data={data} />);

    // Should render session details without crashing
    expect(screen.getByText("unknown")).toBeDefined();
  });
});
