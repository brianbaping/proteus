import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../../utils/confirm.js", () => ({
  confirm: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../utils/resolve-project.js", () => ({
  resolveProject: vi.fn(),
}));

vi.mock("../../utils/git.js", () => ({
  gitStageAndCommit: vi.fn().mockResolvedValue(""),
}));

import { confirm } from "../../utils/confirm.js";
import { resolveProject } from "../../utils/resolve-project.js";

describe("revert command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-revert-test-"));
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(forgeDir, { recursive: true });

    vi.mocked(resolveProject).mockResolvedValue({
      name: "test-project",
      entry: {
        source: "/tmp/source",
        target: tempDir,
        createdAt: "2026-01-01T00:00:00Z",
        currentStage: "execute",
      },
    });
    vi.mocked(confirm).mockResolvedValue(true);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("removes directories after the specified stage", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "02-design"), { recursive: true });
    await mkdir(join(forgeDir, "03-plan"), { recursive: true });
    await mkdir(join(forgeDir, "04-tracks"), { recursive: true });

    await writeFile(join(forgeDir, "02-design", "design.md"), "# Design");
    await writeFile(join(forgeDir, "03-plan", "plan.json"), "{}");
    await writeFile(join(forgeDir, "04-tracks", "manifest.json"), "{}");

    // Dynamically import to apply mocks
    const { revertCommand } = await import("../../commands/revert.js");
    await revertCommand.parseAsync(["inspect", "test-project"], {
      from: "user",
    });

    expect(existsSync(join(forgeDir, "02-design"))).toBe(false);
    expect(existsSync(join(forgeDir, "03-plan"))).toBe(false);
    expect(existsSync(join(forgeDir, "04-tracks"))).toBe(false);
  });

  it("skips directories that do not exist", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    // Only create plan, not design or tracks
    await mkdir(join(forgeDir, "03-plan"), { recursive: true });
    await writeFile(join(forgeDir, "03-plan", "plan.json"), "{}");

    const { revertCommand } = await import("../../commands/revert.js");
    await revertCommand.parseAsync(["inspect", "test-project"], {
      from: "user",
    });

    // plan should be removed, others were already gone
    expect(existsSync(join(forgeDir, "03-plan"))).toBe(false);
  });

  it("cleans cost entries for removed stages", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "03-plan"), { recursive: true });
    await writeFile(join(forgeDir, "03-plan", "plan.json"), "{}");

    // Create costs file with entries for multiple stages
    await writeFile(
      join(forgeDir, "costs.json"),
      JSON.stringify({
        stages: {
          inspect: { estimatedCost: 0.5, timestamp: "", teammates: 1, tier: "fast", duration: "1m", inputTokens: 100, outputTokens: 50 },
          design: { estimatedCost: 1.0, timestamp: "", teammates: 1, tier: "fast", duration: "1m", inputTokens: 100, outputTokens: 50 },
          plan: { estimatedCost: 0.75, timestamp: "", teammates: 1, tier: "fast", duration: "1m", inputTokens: 100, outputTokens: 50 },
        },
        totalCost: 2.25,
      })
    );

    const { revertCommand } = await import("../../commands/revert.js");
    await revertCommand.parseAsync(["inspect", "test-project"], {
      from: "user",
    });

    const costs = JSON.parse(await readFile(join(forgeDir, "costs.json"), "utf-8"));
    expect(costs.stages.inspect).toBeDefined();
    expect(costs.stages.design).toBeUndefined();
    expect(costs.stages.plan).toBeUndefined();
    expect(costs.totalCost).toBeCloseTo(0.5);
  });

  it("appends log entry", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "02-design"), { recursive: true });
    await writeFile(join(forgeDir, "02-design", "design.md"), "#");

    const { revertCommand } = await import("../../commands/revert.js");
    await revertCommand.parseAsync(["inspect", "test-project"], {
      from: "user",
    });

    const logContent = await readFile(join(forgeDir, "log.jsonl"), "utf-8");
    const logEntry = JSON.parse(logContent.trim());
    expect(logEntry.action).toBe("revert");
    expect(logEntry.status).toBe("success");
  });

  it("does nothing when reverting at the last stage", async () => {
    const consoleSpy = vi.spyOn(console, "log");

    const { revertCommand } = await import("../../commands/revert.js");
    await revertCommand.parseAsync(["execute", "test-project"], {
      from: "user",
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("nothing to revert")
    );
    consoleSpy.mockRestore();
  });

  it("does nothing when no downstream artifacts exist", async () => {
    const consoleSpy = vi.spyOn(console, "log");

    const { revertCommand } = await import("../../commands/revert.js");
    await revertCommand.parseAsync(["inspect", "test-project"], {
      from: "user",
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("nothing to remove")
    );
    consoleSpy.mockRestore();
  });

  it("cancels when user declines confirmation", async () => {
    vi.mocked(confirm).mockResolvedValue(false);

    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "02-design"), { recursive: true });
    await writeFile(join(forgeDir, "02-design", "design.md"), "#");

    const { revertCommand } = await import("../../commands/revert.js");
    await revertCommand.parseAsync(["inspect", "test-project"], {
      from: "user",
    });

    // Directory should still exist
    expect(existsSync(join(forgeDir, "02-design"))).toBe(true);
  });
});
