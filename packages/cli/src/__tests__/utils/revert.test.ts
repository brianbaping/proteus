import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../../utils/git.js", () => ({
  gitStageAndCommit: vi.fn().mockResolvedValue(""),
}));

import { gitStageAndCommit } from "../../utils/git.js";

describe("revertStage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-revert-util-test-"));
    await mkdir(join(tempDir, ".proteus-forge"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("removes downstream stage directories that exist", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "02-design"), { recursive: true });
    await writeFile(join(forgeDir, "02-design", "design.md"), "# Design");
    await mkdir(join(forgeDir, "03-plan"), { recursive: true });
    await writeFile(join(forgeDir, "03-plan", "plan.json"), "{}");
    await mkdir(join(forgeDir, "04-tracks"), { recursive: true });
    await writeFile(join(forgeDir, "04-tracks", "manifest.json"), "{}");

    const { revertStage } = await import("../../utils/revert.js");
    const result = await revertStage(tempDir, "inspect");

    expect(existsSync(join(forgeDir, "02-design"))).toBe(false);
    expect(existsSync(join(forgeDir, "03-plan"))).toBe(false);
    expect(existsSync(join(forgeDir, "04-tracks"))).toBe(false);
    expect(result.removed).toEqual(
      expect.arrayContaining(["design", "plan", "split"])
    );
  });

  it("skips directories that do not exist", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    // Only create plan, not design or tracks
    await mkdir(join(forgeDir, "03-plan"), { recursive: true });
    await writeFile(join(forgeDir, "03-plan", "plan.json"), "{}");

    const { revertStage } = await import("../../utils/revert.js");
    const result = await revertStage(tempDir, "inspect");

    expect(existsSync(join(forgeDir, "03-plan"))).toBe(false);
    expect(result.removed).toEqual(["plan"]);
  });

  it("returns empty removed array when no downstream stages exist", async () => {
    const { revertStage } = await import("../../utils/revert.js");
    const result = await revertStage(tempDir, "inspect");

    expect(result.removed).toEqual([]);
  });

  it("returns empty removed array for the last stage", async () => {
    const { revertStage } = await import("../../utils/revert.js");
    const result = await revertStage(tempDir, "execute");

    expect(result.removed).toEqual([]);
  });

  it("removes cost entries for downstream stages", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "03-plan"), { recursive: true });
    await writeFile(join(forgeDir, "03-plan", "plan.json"), "{}");

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

    const { revertStage } = await import("../../utils/revert.js");
    await revertStage(tempDir, "inspect");

    const costs = JSON.parse(await readFile(join(forgeDir, "costs.json"), "utf-8"));
    expect(costs.stages.inspect).toBeDefined();
    expect(costs.stages.design).toBeUndefined();
    expect(costs.stages.plan).toBeUndefined();
    expect(costs.totalCost).toBeCloseTo(0.5);
  });

  it("appends a log entry", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "02-design"), { recursive: true });
    await writeFile(join(forgeDir, "02-design", "design.md"), "#");

    const { revertStage } = await import("../../utils/revert.js");
    await revertStage(tempDir, "inspect");

    const logContent = await readFile(join(forgeDir, "log.jsonl"), "utf-8");
    const logEntry = JSON.parse(logContent.trim());
    expect(logEntry.action).toBe("revert");
    expect(logEntry.status).toBe("success");
    expect(logEntry.details).toContain("design");
  });

  it("handles git commit failure gracefully", async () => {
    vi.mocked(gitStageAndCommit).mockRejectedValueOnce(new Error("git failed"));

    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "02-design"), { recursive: true });
    await writeFile(join(forgeDir, "02-design", "design.md"), "#");

    const { revertStage } = await import("../../utils/revert.js");
    const result = await revertStage(tempDir, "inspect");

    // Should succeed despite git failure
    expect(result.removed).toContain("design");
    expect(existsSync(join(forgeDir, "02-design"))).toBe(false);
  });
});
