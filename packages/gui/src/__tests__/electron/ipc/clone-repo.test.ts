const mockExecFile = vi.fn(
  (_cmd: string, _args: string[], _opts: unknown, callback: (error: Error | null) => void) => {
    callback(null);
  },
);

vi.mock("node:child_process", () => ({
  __esModule: true,
  default: { execFile: mockExecFile },
  execFile: mockExecFile,
}));

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

describe("project:clone-repo IPC handler", () => {
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

  it("clones a repo to a temp directory when no target provided", async () => {
    const handler = handlers.get("project:clone-repo")!;
    const result = await handler({}, "https://github.com/owner/repo") as string;

    expect(result).toContain("proteus-clone-");
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["clone", "--depth", "1", "https://github.com/owner/repo", expect.stringContaining("proteus-clone-")],
      expect.objectContaining({ shell: true }),
      expect.any(Function),
    );
  });

  it("clones into provided target directory", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const targetDir = await mkdtemp(join(tmpdir(), "proteus-clone-test-"));

    const handler = handlers.get("project:clone-repo")!;
    const result = await handler({}, "https://github.com/owner/repo", targetDir) as string;

    expect(result).toBe(targetDir);
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["clone", "--depth", "1", "https://github.com/owner/repo", targetDir],
      expect.objectContaining({ shell: true }),
      expect.any(Function),
    );
  });

  it("rejects when git clone fails", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, callback: (error: Error | null) => void) => {
        callback(new Error("Authentication failed"));
      },
    );

    const handler = handlers.get("project:clone-repo")!;
    await expect(handler({}, "https://github.com/private/repo")).rejects.toThrow(
      "git clone failed",
    );
  });
});
