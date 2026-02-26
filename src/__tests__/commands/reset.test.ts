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

describe("reset command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-reset-test-"));
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(forgeDir, { recursive: true });

    vi.mocked(resolveProject).mockResolvedValue({
      name: "test-project",
      entry: {
        source: "/tmp/source",
        target: tempDir,
        createdAt: "2026-01-01T00:00:00Z",
        currentStage: "plan",
      },
    });
    vi.mocked(confirm).mockResolvedValue(true);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("removes the single stage directory", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "03-design"), { recursive: true });
    await writeFile(join(forgeDir, "03-design", "design.md"), "# Design");

    const { resetCommand } = await import("../../commands/reset.js");
    await resetCommand.parseAsync(["design", "test-project"], {
      from: "user",
    });

    expect(existsSync(join(forgeDir, "03-design"))).toBe(false);
  });

  it("does nothing when directory does not exist", async () => {
    const consoleSpy = vi.spyOn(console, "log");

    const { resetCommand } = await import("../../commands/reset.js");
    await resetCommand.parseAsync(["design", "test-project"], {
      from: "user",
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("has no artifacts")
    );
    consoleSpy.mockRestore();
  });

  it("warns about downstream stages with artifacts", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "01-inspect"), { recursive: true });
    await mkdir(join(forgeDir, "03-design"), { recursive: true });
    await mkdir(join(forgeDir, "04-plan"), { recursive: true });
    await writeFile(join(forgeDir, "01-inspect", "features.json"), "{}");
    await writeFile(join(forgeDir, "03-design", "design.md"), "#");
    await writeFile(join(forgeDir, "04-plan", "plan.json"), "{}");

    const consoleSpy = vi.spyOn(console, "log");

    const { resetCommand } = await import("../../commands/reset.js");
    await resetCommand.parseAsync(["inspect", "test-project"], {
      from: "user",
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Downstream stages with artifacts")
    );
    // The inspect directory should still be removed
    expect(existsSync(join(forgeDir, "01-inspect"))).toBe(false);
    consoleSpy.mockRestore();
  });

  it("cleans cost entry for the reset stage", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "03-design"), { recursive: true });
    await writeFile(join(forgeDir, "03-design", "design.md"), "#");

    await writeFile(
      join(forgeDir, "costs.json"),
      JSON.stringify({
        stages: {
          inspect: { estimatedCost: 0.5, timestamp: "", teammates: 1, tier: "fast", duration: "1m", inputTokens: 100, outputTokens: 50 },
          design: { estimatedCost: 1.0, timestamp: "", teammates: 1, tier: "fast", duration: "1m", inputTokens: 100, outputTokens: 50 },
        },
        totalCost: 1.5,
      })
    );

    const { resetCommand } = await import("../../commands/reset.js");
    await resetCommand.parseAsync(["design", "test-project"], {
      from: "user",
    });

    const costs = JSON.parse(await readFile(join(forgeDir, "costs.json"), "utf-8"));
    expect(costs.stages.inspect).toBeDefined();
    expect(costs.stages.design).toBeUndefined();
    expect(costs.totalCost).toBeCloseTo(0.5);
  });

  it("appends log entry", async () => {
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "04-plan"), { recursive: true });
    await writeFile(join(forgeDir, "04-plan", "plan.json"), "{}");

    const { resetCommand } = await import("../../commands/reset.js");
    await resetCommand.parseAsync(["plan", "test-project"], {
      from: "user",
    });

    const logContent = await readFile(join(forgeDir, "log.jsonl"), "utf-8");
    const logEntry = JSON.parse(logContent.trim());
    expect(logEntry.action).toBe("reset");
    expect(logEntry.status).toBe("success");
  });

  it("cancels when user declines confirmation", async () => {
    vi.mocked(confirm).mockResolvedValue(false);

    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(join(forgeDir, "03-design"), { recursive: true });
    await writeFile(join(forgeDir, "03-design", "design.md"), "#");

    const { resetCommand } = await import("../../commands/reset.js");
    await resetCommand.parseAsync(["design", "test-project"], {
      from: "user",
    });

    expect(existsSync(join(forgeDir, "03-design"))).toBe(true);
  });
});
