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
      activeEntry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "design" },
      stageStatuses: [],
      staleness: [],
      loading: false,
      registry: null,
    });
  });

  it("renders empty state when no data and not running", async () => {
    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={null} files={[]} />);

    expect(screen.getByText("Run design to generate architecture decisions")).toBeDefined();
  });

  it("renders running state when running with no data", async () => {
    useSessionStore.setState({ isRunning: true, currentStage: "design" });

    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={null} files={[]} />);

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
    };

    const files = [{ name: "design-meta.json", size: 1024 }];

    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={data} files={files} />);

    expect(screen.getByText("Auth Service")).toBeDefined();
    expect(screen.getByText("Handles authentication")).toBeDefined();
    expect(screen.getByText("2 features")).toBeDefined();
    expect(screen.getByText("1 interfaces")).toBeDefined();
    expect(screen.getByText("1 entities")).toBeDefined();
    expect(screen.getByText("Node.js 22")).toBeDefined();
    expect(screen.getByTestId("artifact-list")).toBeDefined();
  });

  it("renders artifact list when design is complete", async () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "design", complete: true, artifactPath: "/p" }] as never,
    });

    const files = [{ name: "design-meta.json", size: 512 }, { name: "design.md", size: 2048 }];

    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={null} files={files} />);

    expect(screen.getByText(/design-meta\.json/)).toBeDefined();
    expect(screen.getByText(/design\.md/)).toBeDefined();
  });

  it("renders service without optional fields", async () => {
    const data = {
      architectureStyle: "microservices",
      framework: "—",
      servicesCount: 1,
      featuresMapped: 0,
      targetStack: {},
      services: [{ id: "svc-1", name: "Minimal" }],
    };

    const { DesignCanvas } = await import("../../components/design/DesignCanvas.js");
    render(<DesignCanvas data={data} files={[]} />);

    expect(screen.getByText("Minimal")).toBeDefined();
  });
});
