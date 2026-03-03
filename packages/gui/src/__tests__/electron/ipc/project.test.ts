import { mkdtemp, rm, mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
vi.mock("@proteus-forge/cli/api", () => ({
  readRegistry: vi.fn(),
  getActiveProject: vi.fn(),
  setActiveProject: vi.fn(),
  registerProject: vi.fn(),
  unregisterProject: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
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

    it("returns parsed design-meta.json and design.md for design stage", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "02-design");
      await mkdir(stageDir, { recursive: true });
      const designMeta = {
        architectureStyle: "modular-monolith",
        targetStack: { runtime: "Node.js 22", language: "TypeScript" },
        services: [{ id: "svc-auth", name: "Auth Service", discipline: "backend" }],
      };
      await writeFile(join(stageDir, "design-meta.json"), JSON.stringify(designMeta));
      await writeFile(join(stageDir, "design.md"), "# Architecture Design");

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "design") as Record<string, unknown>;

      expect(result).not.toBeNull();
      expect(result.designMeta).toEqual(designMeta);
      expect(result.designMd).toBe("# Architecture Design");
    });

    it("returns null for design stage when no artifact files exist", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "02-design");
      await mkdir(stageDir, { recursive: true });

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "design");

      expect(result).toBeNull();
    });

    it("returns parsed plan.json and plan.md for plan stage", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "03-plan");
      await mkdir(stageDir, { recursive: true });
      const plan = {
        tasks: [{ id: "task-001", title: "Setup", discipline: "shared" }],
        executionWaves: [{ wave: 1, tasks: ["task-001"], rationale: "Foundation" }],
        criticalPath: ["task-001"],
      };
      await writeFile(join(stageDir, "plan.json"), JSON.stringify(plan));
      await writeFile(join(stageDir, "plan.md"), "# Execution Plan");

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "plan") as Record<string, unknown>;

      expect(result).not.toBeNull();
      expect(result.plan).toEqual(plan);
      expect(result.planMd).toBe("# Execution Plan");
    });

    it("returns null for plan stage when no artifact files exist", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "03-plan");
      await mkdir(stageDir, { recursive: true });

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "plan");

      expect(result).toBeNull();
    });

    it("returns parsed session.json for execute stage", async () => {
      const stageDir = join(tempDir, ".proteus-forge", "05-execute");
      await mkdir(stageDir, { recursive: true });
      const session = {
        status: "completed",
        sessionId: "sess-123",
        startedAt: "2026-02-19T15:36:00Z",
        completedAt: "2026-02-19T15:57:00Z",
        progress: { totalTasks: 14, completed: 14, failed: 0 },
      };
      await writeFile(join(stageDir, "session.json"), JSON.stringify(session));

      const handler = handlers.get("project:read-artifacts")!;
      const result = await handler({}, tempDir, "execute") as Record<string, unknown>;

      expect(result).not.toBeNull();
      expect(result.session).toEqual(session);
    });

    it("returns null for execute stage when no artifact files exist", async () => {
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

  describe("project:update", () => {
    it("calls updateProject with name and updates", async () => {
      const { updateProject } = await import("@proteus-forge/cli/api");

      const handler = handlers.get("project:update")!;
      await handler({}, "my-project", { source: "/new-source" });

      expect(updateProject).toHaveBeenCalledWith("my-project", { source: "/new-source" });
    });

    it("passes both source and target updates", async () => {
      const { updateProject } = await import("@proteus-forge/cli/api");

      const handler = handlers.get("project:update")!;
      await handler({}, "my-project", { source: "/s", target: "/t" });

      expect(updateProject).toHaveBeenCalledWith("my-project", { source: "/s", target: "/t" });
    });

    it("propagates errors from updateProject", async () => {
      const { updateProject } = await import("@proteus-forge/cli/api");
      vi.mocked(updateProject).mockRejectedValue(new Error('Project "bad" not found'));

      const handler = handlers.get("project:update")!;
      await expect(handler({}, "bad", { source: "/x" })).rejects.toThrow('Project "bad" not found');
    });
  });

  describe("project:extract-archive", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "extract-test-"));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("extracts a .tar.gz archive and returns the path", async () => {
      // Create a directory with a file, then tar it
      const sourceDir = join(tempDir, "myproject");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "index.ts"), "console.log('hello');");

      const archivePath = join(tempDir, "archive.tar.gz");
      await execFileAsync("tar", ["czf", archivePath, "-C", tempDir, "myproject"]);

      const handler = handlers.get("project:extract-archive")!;
      const result = (await handler({}, archivePath)) as string;

      // Should unwrap single top-level directory
      const entries = await readdir(result);
      expect(entries).toContain("index.ts");
    });

    it("extracts a .tgz archive and returns the path", async () => {
      const sourceDir = join(tempDir, "proj");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "app.js"), "module.exports = {};");

      const archivePath = join(tempDir, "archive.tgz");
      await execFileAsync("tar", ["czf", archivePath, "-C", tempDir, "proj"]);

      const handler = handlers.get("project:extract-archive")!;
      const result = (await handler({}, archivePath)) as string;

      const entries = await readdir(result);
      expect(entries).toContain("app.js");
    });

    it("extracts a .zip archive and returns the path", async () => {
      const sourceDir = join(tempDir, "zipped");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "main.py"), "print('hello')");

      const archivePath = join(tempDir, "archive.zip");
      await execFileAsync("zip", ["-rq", archivePath, "zipped"], { cwd: tempDir });

      const handler = handlers.get("project:extract-archive")!;
      const result = (await handler({}, archivePath)) as string;

      // Should unwrap single top-level directory
      const entries = await readdir(result);
      expect(entries).toContain("main.py");
    });

    it("unwraps single top-level directory", async () => {
      const sourceDir = join(tempDir, "repo-main");
      const nestedDir = join(sourceDir, "src");
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(sourceDir, "README.md"), "# Readme");
      await writeFile(join(nestedDir, "index.ts"), "export {}");

      const archivePath = join(tempDir, "single-dir.tar.gz");
      await execFileAsync("tar", ["czf", archivePath, "-C", tempDir, "repo-main"]);

      const handler = handlers.get("project:extract-archive")!;
      const result = (await handler({}, archivePath)) as string;

      // Result should point to the unwrapped "repo-main" directory
      expect(result).toContain("repo-main");
      const entries = await readdir(result);
      expect(entries).toContain("README.md");
      expect(entries).toContain("src");
    });

    it("does not unwrap when archive has multiple top-level entries", async () => {
      const dir1 = join(tempDir, "content", "dir1");
      const dir2 = join(tempDir, "content", "dir2");
      await mkdir(dir1, { recursive: true });
      await mkdir(dir2, { recursive: true });
      await writeFile(join(dir1, "a.txt"), "a");
      await writeFile(join(dir2, "b.txt"), "b");

      const archivePath = join(tempDir, "multi.tar.gz");
      await execFileAsync("tar", ["czf", archivePath, "-C", join(tempDir, "content"), "dir1", "dir2"]);

      const handler = handlers.get("project:extract-archive")!;
      const result = (await handler({}, archivePath)) as string;

      // Should NOT unwrap — has two top-level dirs
      const entries = await readdir(result);
      expect(entries).toContain("dir1");
      expect(entries).toContain("dir2");
    });

    it("throws on unsupported archive format", async () => {
      const fakePath = join(tempDir, "archive.rar");
      await writeFile(fakePath, "not a real archive");

      const handler = handlers.get("project:extract-archive")!;
      await expect(handler({}, fakePath)).rejects.toThrow("Unsupported archive format");
    });

    it("throws on tar extraction failure", async () => {
      const fakePath = join(tempDir, "bad.tar.gz");
      await writeFile(fakePath, "not a real tarball");

      const handler = handlers.get("project:extract-archive")!;
      await expect(handler({}, fakePath)).rejects.toThrow("tar extraction failed");
    });
  });
});
