import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

vi.mock("@proteus-forge/cli/api", () => ({
  runInspect: vi.fn(),
  runDesign: vi.fn(),
  runPlan: vi.fn(),
  runSplit: vi.fn(),
  runExecute: vi.fn(),
  readGlobalConfig: vi.fn(),
  writeGlobalConfig: vi.fn(),
  readCosts: vi.fn(),
  writeInboxMessage: vi.fn(),
  getInboxDir: vi.fn(),
  getActiveProject: vi.fn(),
  revertStage: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("#electron/gui-dashboard.js", () => {
  return {
    GuiDashboard: class {
      onMessage = vi.fn();
    },
  };
});

describe("pipeline IPC handlers", () => {
  let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
  let mockGetWindow: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Build a fake ipcMain that captures handlers
    handlers = new Map();
    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
        handlers.set(channel, handler);
      }),
    };

    mockGetWindow = vi.fn().mockReturnValue({
      webContents: { send: vi.fn() },
    });

    const { registerPipelineHandlers } = await import("#electron/ipc/pipeline.js");
    registerPipelineHandlers(mockIpcMain as never, mockGetWindow as never);
  });

  describe("formatDuration (tested via stage:run return value)", () => {
    it("formats sub-60-second durations as seconds", async () => {
      const { runInspect, getActiveProject } = await import("@proteus-forge/cli/api");
      vi.mocked(runInspect).mockImplementation(async () => {
        // Simulate near-instant return
        return true;
      });
      vi.mocked(getActiveProject).mockResolvedValue({
        name: "test",
        entry: { source: "/src", target: "/tgt", createdAt: "", lastCompletedStage: "inspect" },
      });
      const { readCosts } = await import("@proteus-forge/cli/api");
      vi.mocked(readCosts).mockResolvedValue({
        stages: { inspect: { estimatedCost: 0.5, timestamp: "", teammates: 1, tier: "fast", duration: "1s", inputTokens: 100, outputTokens: 50 } },
        totalEstimatedCost: 0.5,
      } as never);

      const handler = handlers.get("stage:run")!;
      const result = await handler({}, { projectName: "test", stage: "inspect" }) as {
        success: boolean;
        cost: { estimatedCost: number; duration: string };
      };

      expect(result.success).toBe(true);
      // Duration should end with 's' and not contain 'm'
      expect(result.cost.duration).toMatch(/^\d+s$/);
    });

    it("formats minutes and seconds for 60-3599 second durations", async () => {
      const { runDesign, getActiveProject } = await import("@proteus-forge/cli/api");

      // Mock a delay to get a minutes-range duration
      vi.useFakeTimers();
      vi.mocked(runDesign).mockImplementation(async () => {
        vi.advanceTimersByTime(125_000); // 2m 5s
        return false;
      });
      vi.mocked(getActiveProject).mockResolvedValue(null);

      const handler = handlers.get("stage:run")!;
      const result = await handler({}, { projectName: "test", stage: "design" }) as {
        success: boolean;
        cost: { estimatedCost: number; duration: string };
      };

      expect(result.cost.duration).toBe("2m 5s");
      expect(result.success).toBe(false);
      expect(result.cost.estimatedCost).toBe(0);

      vi.useRealTimers();
    });

    it("formats hours and minutes for 3600+ second durations", async () => {
      const { runExecute, getActiveProject } = await import("@proteus-forge/cli/api");

      vi.useFakeTimers();
      vi.mocked(runExecute).mockImplementation(async () => {
        vi.advanceTimersByTime(3_723_000); // 1h 2m 3s → displays as "1h 2m"
        return false;
      });
      vi.mocked(getActiveProject).mockResolvedValue(null);

      const handler = handlers.get("stage:run")!;
      const result = await handler({}, { projectName: "test", stage: "execute" }) as {
        cost: { duration: string };
      };

      expect(result.cost.duration).toBe("1h 2m");

      vi.useRealTimers();
    });
  });

  describe("stage:run", () => {
    it("calls the correct runner for each stage", async () => {
      const api = await import("@proteus-forge/cli/api");
      vi.mocked(api.getActiveProject).mockResolvedValue(null);

      const stages = ["inspect", "design", "plan", "split", "execute"] as const;
      const runners = [api.runInspect, api.runDesign, api.runPlan, api.runSplit, api.runExecute];

      const handler = handlers.get("stage:run")!;

      for (let i = 0; i < stages.length; i++) {
        vi.mocked(runners[i]).mockResolvedValue(false);
        await handler({}, { projectName: "p", stage: stages[i] });
        expect(runners[i]).toHaveBeenCalled();
      }
    });

    it("reads cost from costs.json on success", async () => {
      const { runPlan, getActiveProject, readCosts } = await import("@proteus-forge/cli/api");
      vi.mocked(runPlan).mockResolvedValue(true);
      vi.mocked(getActiveProject).mockResolvedValue({
        name: "proj",
        entry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "plan" },
      });
      vi.mocked(readCosts).mockResolvedValue({
        stages: { plan: { estimatedCost: 2.5, timestamp: "", teammates: 1, tier: "standard", duration: "3m", inputTokens: 5000, outputTokens: 2000 } },
        totalEstimatedCost: 2.5,
      } as never);

      const handler = handlers.get("stage:run")!;
      const result = await handler({}, { projectName: "proj", stage: "plan" }) as {
        success: boolean;
        cost: { estimatedCost: number };
      };

      expect(result.success).toBe(true);
      expect(result.cost.estimatedCost).toBe(2.5);
    });

    it("returns sessionId from costs.json on success", async () => {
      const { runInspect, getActiveProject, readCosts } = await import("@proteus-forge/cli/api");
      vi.mocked(runInspect).mockResolvedValue(true);
      vi.mocked(getActiveProject).mockResolvedValue({
        name: "proj",
        entry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "inspect" },
      });
      vi.mocked(readCosts).mockResolvedValue({
        stages: { inspect: { estimatedCost: 0.5, timestamp: "", teammates: 1, tier: "fast", duration: "1s", inputTokens: 100, outputTokens: 50, sessionId: "sess-abc-123" } },
        totalEstimatedCost: 0.5,
      } as never);

      const handler = handlers.get("stage:run")!;
      const result = await handler({}, { projectName: "proj", stage: "inspect" }) as {
        success: boolean;
        sessionId: string;
      };

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe("sess-abc-123");
    });

    it("returns empty sessionId when costs.json has no sessionId", async () => {
      const { runPlan, getActiveProject, readCosts } = await import("@proteus-forge/cli/api");
      vi.mocked(runPlan).mockResolvedValue(true);
      vi.mocked(getActiveProject).mockResolvedValue({
        name: "proj",
        entry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "plan" },
      });
      vi.mocked(readCosts).mockResolvedValue({
        stages: { plan: { estimatedCost: 1.0, timestamp: "", teammates: 1, tier: "standard", duration: "2m", inputTokens: 1000, outputTokens: 500 } },
        totalEstimatedCost: 1.0,
      } as never);

      const handler = handlers.get("stage:run")!;
      const result = await handler({}, { projectName: "proj", stage: "plan" }) as {
        sessionId: string;
      };

      expect(result.sessionId).toBe("");
    });

    it("returns zero cost on failure", async () => {
      const { runSplit, getActiveProject } = await import("@proteus-forge/cli/api");
      vi.mocked(runSplit).mockResolvedValue(false);
      vi.mocked(getActiveProject).mockResolvedValue(null);

      const handler = handlers.get("stage:run")!;
      const result = await handler({}, { projectName: "p", stage: "split" }) as {
        success: boolean;
        cost: { estimatedCost: number };
      };

      expect(result.success).toBe(false);
      expect(result.cost.estimatedCost).toBe(0);
    });

    it("passes stage options through to the runner", async () => {
      const { runInspect, getActiveProject } = await import("@proteus-forge/cli/api");
      vi.mocked(runInspect).mockResolvedValue(false);
      vi.mocked(getActiveProject).mockResolvedValue(null);

      const handler = handlers.get("stage:run")!;
      await handler({}, {
        projectName: "p",
        stage: "inspect",
        options: { excludeStyle: true },
      });

      expect(runInspect).toHaveBeenCalledWith(
        "p",
        { excludeStyle: true },
        expect.any(Object),
        expect.any(Function),
      );
    });
  });

  describe("stage:abort", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "pipeline-test-"));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("removes the sentinel file and writes abort message", async () => {
      const { getActiveProject, getInboxDir, writeInboxMessage } = await import("@proteus-forge/cli/api");
      const inboxDir = join(tempDir, ".proteus-forge", "inbox");
      await mkdir(inboxDir, { recursive: true });
      await writeFile(join(inboxDir, ".active"), "");

      vi.mocked(getActiveProject).mockResolvedValue({
        name: "proj",
        entry: { source: "/s", target: tempDir, createdAt: "", lastCompletedStage: "execute" },
      });
      vi.mocked(getInboxDir).mockReturnValue(inboxDir);

      const handler = handlers.get("stage:abort")!;
      await handler({});

      expect(existsSync(join(inboxDir, ".active"))).toBe(false);
      expect(writeInboxMessage).toHaveBeenCalledWith(
        tempDir,
        "lead",
        expect.stringContaining("ABORT"),
      );
    });

    it("throws when no active project", async () => {
      const { getActiveProject } = await import("@proteus-forge/cli/api");
      vi.mocked(getActiveProject).mockResolvedValue(null);

      const handler = handlers.get("stage:abort")!;
      await expect(handler({})).rejects.toThrow("No active project");
    });

    it("throws when no sentinel file exists", async () => {
      const { getActiveProject, getInboxDir } = await import("@proteus-forge/cli/api");
      const inboxDir = join(tempDir, ".proteus-forge", "inbox");
      await mkdir(inboxDir, { recursive: true });
      // No .active file

      vi.mocked(getActiveProject).mockResolvedValue({
        name: "proj",
        entry: { source: "/s", target: tempDir, createdAt: "", lastCompletedStage: "execute" },
      });
      vi.mocked(getInboxDir).mockReturnValue(inboxDir);

      const handler = handlers.get("stage:abort")!;
      await expect(handler({})).rejects.toThrow("No active execute session found");
    });
  });

  describe("session:send-message", () => {
    it("writes an inbox message to the active project", async () => {
      const { getActiveProject, writeInboxMessage } = await import("@proteus-forge/cli/api");
      vi.mocked(getActiveProject).mockResolvedValue({
        name: "proj",
        entry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "execute" },
      });

      const handler = handlers.get("session:send-message")!;
      await handler({}, "researcher", "please hurry");

      expect(writeInboxMessage).toHaveBeenCalledWith("/t", "researcher", "please hurry");
    });

    it("throws when no active project", async () => {
      const { getActiveProject } = await import("@proteus-forge/cli/api");
      vi.mocked(getActiveProject).mockResolvedValue(null);

      const handler = handlers.get("session:send-message")!;
      await expect(handler({}, "agent", "msg")).rejects.toThrow("No active project");
    });
  });

  describe("config:read-global", () => {
    it("returns global config", async () => {
      const { readGlobalConfig } = await import("@proteus-forge/cli/api");
      const mockConfig = { providers: {}, tiers: {}, phases: {} };
      vi.mocked(readGlobalConfig).mockResolvedValue(mockConfig as never);

      const handler = handlers.get("config:read-global")!;
      const result = await handler({});

      expect(result).toBe(mockConfig);
    });
  });

  describe("config:write-global", () => {
    it("calls writeGlobalConfig with the provided config", async () => {
      const { writeGlobalConfig } = await import("@proteus-forge/cli/api");
      vi.mocked(writeGlobalConfig).mockResolvedValue(undefined);

      const mockConfig = {
        forgeVersion: "1.0.0",
        providers: { anthropic: { type: "anthropic", apiKey: "$ANTHROPIC_API_KEY" } },
        tiers: { fast: { provider: "anthropic", model: "claude-haiku-4-5-20251001" } },
        phases: { inspect: "fast" },
      };

      const handler = handlers.get("config:write-global")!;
      await handler({}, mockConfig);

      expect(writeGlobalConfig).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe("costs:read", () => {
    it("reads costs for the given target path", async () => {
      const { readCosts } = await import("@proteus-forge/cli/api");
      const mockCosts = { stages: {}, totalEstimatedCost: 0 };
      vi.mocked(readCosts).mockResolvedValue(mockCosts as never);

      const handler = handlers.get("costs:read")!;
      const result = await handler({}, "/target/path");

      expect(readCosts).toHaveBeenCalledWith("/target/path");
      expect(result).toBe(mockCosts);
    });
  });

  describe("stage:revert", () => {
    it("reverts to previous stage when destroying a non-first stage", async () => {
      const { getActiveProject, revertStage, updateProject } = await import("@proteus-forge/cli/api");
      vi.mocked(getActiveProject).mockResolvedValue({
        name: "proj",
        entry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "plan" },
      });
      vi.mocked(revertStage).mockResolvedValue({ removed: ["design", "plan", "split", "execute"] });

      const handler = handlers.get("stage:revert")!;
      const result = await handler({}, "design");

      // Should revert to previous stage (inspect) to include current stage
      expect(revertStage).toHaveBeenCalledWith("/t", "inspect");
      expect(updateProject).toHaveBeenCalledWith("proj", { lastCompletedStage: "inspect" });
      expect(result).toEqual({ removed: ["design", "plan", "split", "execute"] });
    });

    it("removes inspect dir directly when destroying first stage", async () => {
      const { getActiveProject, revertStage, updateProject } = await import("@proteus-forge/cli/api");
      vi.mocked(getActiveProject).mockResolvedValue({
        name: "proj",
        entry: { source: "/s", target: "/t", createdAt: "", lastCompletedStage: "inspect" },
      });
      vi.mocked(revertStage).mockResolvedValue({ removed: [] });

      const handler = handlers.get("stage:revert")!;
      const result = await handler({}, "inspect");

      expect(revertStage).toHaveBeenCalledWith("/t", "inspect");
      expect(updateProject).toHaveBeenCalledWith("proj", { lastCompletedStage: "new" });
      expect(result).toEqual({ removed: ["inspect", "design", "plan", "split", "execute"] });
    });

    it("throws when no active project", async () => {
      const { getActiveProject } = await import("@proteus-forge/cli/api");
      vi.mocked(getActiveProject).mockResolvedValue(null);

      const handler = handlers.get("stage:revert")!;
      await expect(handler({}, "inspect")).rejects.toThrow("No active project");
    });
  });
});
