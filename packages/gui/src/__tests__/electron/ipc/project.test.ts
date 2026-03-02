import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
vi.mock("@proteus-forge/cli/api", () => ({
  readRegistry: vi.fn(),
  getActiveProject: vi.fn(),
  setActiveProject: vi.fn(),
  registerProject: vi.fn(),
  unregisterProject: vi.fn(),
  getProject: vi.fn(),
  getStageStatuses: vi.fn(),
  checkStaleness: vi.fn(),
  createProjectConfig: vi.fn(),
  writeProjectConfig: vi.fn(),
}));

describe("project IPC handlers", () => {
  let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    handlers = new Map();
    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        handlers.set(channel, handler);
      }),
    };

    const { registerProjectHandlers } = await import("#electron/ipc/project.js");
    registerProjectHandlers(mockIpcMain as never);
  });

  describe("project:read-artifacts", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "project-test-"));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("returns null when stage directory does not exist", async () => {
      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "inspect");
      expect(result).toBeNull();
    });

    it("returns parsed features.json for inspect stage", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "01-inspect");
      await mkdir(stageDir, { recursive: true });
      const features = {
        source: { primaryLanguage: "TypeScript" },
        features: [
          { id: "f1", name: "Auth", description: "Auth flow", category: "core", sourceFiles: ["auth.ts"], complexity: "medium" },
        ],
      };
      await writeFile(join(stageDir, "features.json"), JSON.stringify(features));

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "inspect") as Record<string, unknown>;

      expect(result).not.toBeNull();
      expect(result.features).toEqual(features);
    });

    it("returns parsed manifest.json for split stage", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "04-tracks");
      await mkdir(stageDir, { recursive: true });
      const manifest = {
        tracks: [
          { id: "t1", discipline: "backend", taskCount: 5, file: "track-backend.md", dependsOnTracks: [] },
        ],
      };
      await writeFile(join(stageDir, "manifest.json"), JSON.stringify(manifest));

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "split") as Record<string, unknown>;

      expect(result).not.toBeNull();
      expect(result.manifest).toEqual(manifest);
    });

    it("returns null for stages with no artifact files (design)", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "02-design");
      await mkdir(stageDir, { recursive: true });

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "design");

      expect(result).toBeNull();
    });

    it("returns null for stages with no artifact files (plan)", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "03-plan");
      await mkdir(stageDir, { recursive: true });

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "plan");

      expect(result).toBeNull();
    });

    it("returns null for stages with no artifact files (execute)", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "05-execute");
      await mkdir(stageDir, { recursive: true });

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "execute");

      expect(result).toBeNull();
    });

    it("returns null when features.json is missing even if stage dir exists", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "01-inspect");
      await mkdir(stageDir, { recursive: true });
      // No features.json written

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "inspect");

      expect(result).toBeNull();
    });
  });

  describe("project:list", () => {
    it("returns the project registry", async () => {
      const { readRegistry } = await import("@proteus-forge/cli/api");
      const mockRegistry = { activeProject: null, projects: {} };
      vi.mocked(readRegistry).mockResolvedValue(mockRegistry as never);

      const handler = handlers.get("project:list")!;
      const result = await handler({});

      expect(result).toBe(mockRegistry);
    });
  });

  describe("project:status", () => {
    it("returns statuses and staleness for target path", async () => {
      const { getStageStatuses, checkStaleness } = await import("@proteus-forge/cli/api");
      const mockStatuses = [{ stage: "inspect", complete: true, artifactPath: "/p" }];
      const mockStaleness = [{ stage: "design", staleReason: "inspect changed" }];
      vi.mocked(getStageStatuses).mockReturnValue(mockStatuses as never);
      vi.mocked(checkStaleness).mockReturnValue(mockStaleness as never);

      const handler = handlers.get("project:status")!;
      const result = await handler({}, "/target") as { statuses: unknown; staleness: unknown };

      expect(getStageStatuses).toHaveBeenCalledWith("/target");
      expect(result.statuses).toBe(mockStatuses);
      expect(result.staleness).toBe(mockStaleness);
    });
  });

  describe("project:destroy", () => {
    it("unregisters an existing project", async () => {
      const { getProject, unregisterProject } = await import("@proteus-forge/cli/api");
      vi.mocked(getProject).mockResolvedValue({ source: "/s", target: "/t", createdAt: "", currentStage: "new" } as never);

      const handler = handlers.get("project:destroy")!;
      await handler({}, "my-project");

      expect(unregisterProject).toHaveBeenCalledWith("my-project");
    });

    it("throws when project does not exist", async () => {
      const { getProject } = await import("@proteus-forge/cli/api");
      vi.mocked(getProject).mockResolvedValue(null as never);

      const handler = handlers.get("project:destroy")!;
      await expect(handler({}, "nonexistent")).rejects.toThrow('Project "nonexistent" not found');
    });
  });

  describe("project:get-active", () => {
    it("returns the active project", async () => {
      const { getActiveProject } = await import("@proteus-forge/cli/api");
      const active = { name: "proj", entry: { source: "/s", target: "/t", createdAt: "", currentStage: "new" } };
      vi.mocked(getActiveProject).mockResolvedValue(active as never);

      const handler = handlers.get("project:get-active")!;
      const result = await handler({});

      expect(result).toBe(active);
    });
  });

  describe("project:set-active", () => {
    it("calls setActiveProject with the given name", async () => {
      const { setActiveProject } = await import("@proteus-forge/cli/api");

      const handler = handlers.get("project:set-active")!;
      await handler({}, "my-project");

      expect(setActiveProject).toHaveBeenCalledWith("my-project");
    });
  });

  describe("project:create", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "project-create-test-"));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("creates project with explicit target path", async () => {
      const { createProjectConfig, writeProjectConfig, registerProject } = await import("@proteus-forge/cli/api");
      const mockConfig = { name: "test-proj", source: "/source" };
      vi.mocked(createProjectConfig).mockReturnValue(mockConfig as never);

      const targetPath = join(tempDir, "target");
      const handler = handlers.get("project:create")!;
      await handler({}, "test-proj", "/source", targetPath);

      expect(createProjectConfig).toHaveBeenCalledWith("test-proj", "/source");
      expect(writeProjectConfig).toHaveBeenCalledWith(targetPath, mockConfig);
      expect(registerProject).toHaveBeenCalledWith("test-proj", expect.objectContaining({
        source: "/source",
        target: targetPath,
        currentStage: "new",
      }));
    });

    it("derives target path from source when not provided", async () => {
      const { registerProject, createProjectConfig, writeProjectConfig } = await import("@proteus-forge/cli/api");
      vi.mocked(createProjectConfig).mockReturnValue({} as never);

      const handler = handlers.get("project:create")!;
      await handler({}, "my-proj", join(tempDir, "source"));

      // Target should be sibling: {source}/../my-proj-prod
      expect(registerProject).toHaveBeenCalledWith("my-proj", expect.objectContaining({
        target: join(tempDir, "my-proj-prod"),
      }));
    });
  });

});
