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

describe("BreakdownCanvas", () => {
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
      activeEntry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "split" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders empty state when no data and not running", async () => {
    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={null} files={[]} />);

    expect(screen.getByText("Approve breakdown to partition plan into discipline-specific tracks")).toBeDefined();
  });

  it("renders running state when running with no data", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "split" });

    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={null} files={[]} />);

    expect(screen.getByTestId("activity-tree")).toBeDefined();
  });

  it("renders tracks with dependencies when data is provided", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const data = {
      totalTracks: 3,
      totalTasks: 11,
      disciplines: ["shared", "backend", "frontend"],
      tracks: [
        { id: "t1", discipline: "shared", taskCount: 2, dependsOnTracks: [], requiredByTracks: ["t2", "t3"] },
        { id: "t2", discipline: "backend", taskCount: 5, dependsOnTracks: ["t1"], requiredByTracks: ["t3"] },
        { id: "t3", discipline: "frontend", taskCount: 4, dependsOnTracks: ["t1", "t2"], requiredByTracks: [] },
      ],
    };

    const files = [{ name: "manifest.json", size: 512 }];

    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={data} files={files} />);

    expect(screen.getByText("2 tasks")).toBeDefined();
    expect(screen.getByText("5 tasks")).toBeDefined();
    expect(screen.getByText("4 tasks")).toBeDefined();
    expect(screen.getByText("depends on: t1")).toBeDefined();
    expect(screen.getByText("depends on: t1, t2")).toBeDefined();
    expect(screen.getByText("required by: t2, t3")).toBeDefined();
    expect(screen.getByTestId("artifact-list")).toBeDefined();
  });

  it("renders artifact list when split is complete", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const files = [{ name: "manifest.json", size: 1024 }];

    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={null} files={files} />);

    expect(screen.getByText(/manifest\.json/)).toBeDefined();
  });

  it("renders track with unknown discipline color gracefully", async () => {
    const data = {
      totalTracks: 1,
      totalTasks: 3,
      disciplines: ["ml-ops"],
      tracks: [
        { id: "t1", discipline: "ml-ops", taskCount: 3, dependsOnTracks: [], requiredByTracks: [] },
      ],
    };

    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={data} files={[]} />);

    expect(screen.getByText("3 tasks")).toBeDefined();
  });
});
