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
      activeEntry: { source: "/s", target: "/t", createdAt: "", currentStage: "split" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders empty state when no data and not running", async () => {
    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={null} />);

    expect(screen.getByText("Approve breakdown to partition plan into discipline-specific tracks")).toBeDefined();
  });

  it("renders running state when running with no data", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "split" });

    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={null} />);

    expect(screen.getByText("Splitting into tracks...")).toBeDefined();
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
      artifacts: [{ name: "manifest.json", size: "3 tracks", icon: "\u{1f4cb}" }],
    };

    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={data} />);

    expect(screen.getByText("2 tasks")).toBeDefined();
    expect(screen.getByText("5 tasks")).toBeDefined();
    expect(screen.getByText("4 tasks")).toBeDefined();
    expect(screen.getByText("depends on: t1")).toBeDefined();
    expect(screen.getByText("depends on: t1, t2")).toBeDefined();
    expect(screen.getByText("required by: t2, t3")).toBeDefined();
    expect(screen.getByText("manifest.json")).toBeDefined();
  });

  it("renders export button when split is complete", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "split", complete: true, artifactPath: "/p" }] as never,
    });

    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={null} />);

    expect(screen.getByText("Export JSON")).toBeDefined();
  });

  it("renders track with unknown discipline color gracefully", async () => {
    const data = {
      totalTracks: 1,
      totalTasks: 3,
      disciplines: ["ml-ops"],
      tracks: [
        { id: "t1", discipline: "ml-ops", taskCount: 3, dependsOnTracks: [], requiredByTracks: [] },
      ],
      artifacts: [],
    };

    const { BreakdownCanvas } = await import("../../components/breakdown/BreakdownCanvas.js");
    render(<BreakdownCanvas data={data} />);

    expect(screen.getByText("3 tasks")).toBeDefined();
  });
});
