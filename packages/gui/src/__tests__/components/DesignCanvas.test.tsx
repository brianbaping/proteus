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

describe("DesignCanvas", () => {
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
      activeEntry: { source: "/s", target: "/t", createdAt: "", currentStage: "design" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders empty state when no data and not running", async () => {
    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={null} />);

    expect(screen.getByText("Run design to generate architecture decisions")).toBeDefined();
  });

  it("renders running state when running with no data", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "design" });

    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={null} />);

    expect(screen.getByText("Designing production architecture...")).toBeDefined();
  });

  it("renders stats, stack, and services when data is provided", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "design", complete: true, artifactPath: "/p" }] as never,
    });

    const data = {
      architectureStyle: "modular-monolith",
      framework: "Express.js",
      servicesCount: 3,
      featuresMapped: 10,
      targetStack: { runtime: "Node.js 22", framework: "Express.js", database: "PostgreSQL" },
      services: [
        {
          id: "svc-auth",
          name: "Auth Service",
          description: "Handles authentication",
          discipline: "backend",
          implementsFeatures: ["f1", "f2"],
          exposedInterfaces: [{ type: "REST", path: "/auth" }],
          ownedEntities: ["User"],
        },
      ],
      artifacts: [{ name: "design-meta.json", size: "3 services", icon: "\u{1f4cb}" }],
    };

    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={data} />);

    expect(screen.getByText("Auth Service")).toBeDefined();
    expect(screen.getByText("Handles authentication")).toBeDefined();
    expect(screen.getByText("2 features")).toBeDefined();
    expect(screen.getByText("1 interfaces")).toBeDefined();
    expect(screen.getByText("1 entities")).toBeDefined();
    expect(screen.getByText("Node.js 22")).toBeDefined();
    expect(screen.getByText("design-meta.json")).toBeDefined();
  });

  it("renders export buttons when design is complete", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "design", complete: true, artifactPath: "/p" }] as never,
    });

    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={null} />);

    expect(screen.getByText("Export JSON")).toBeDefined();
    expect(screen.getByText("Export MD")).toBeDefined();
  });

  it("renders service without optional fields", async () => {
    const data = {
      architectureStyle: "microservices",
      framework: "—",
      servicesCount: 1,
      featuresMapped: 0,
      targetStack: {},
      services: [{ id: "svc-1", name: "Minimal" }],
      artifacts: [],
    };

    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={data} />);

    expect(screen.getByText("Minimal")).toBeDefined();
  });
});
