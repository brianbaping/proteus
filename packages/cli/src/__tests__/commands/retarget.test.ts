import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../../utils/confirm.js", () => ({
  confirm: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../utils/resolve-project.js", () => ({
  resolveProject: vi.fn(),
}));

vi.mock("../../config/registry.js", () => ({
  readRegistry: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("../../utils/inbox.js", () => ({
  isInboxActive: vi.fn().mockReturnValue(false),
}));

vi.mock("../../utils/log.js", () => ({
  appendLogEntry: vi.fn(),
}));

import { confirm } from "../../utils/confirm.js";
import { resolveProject } from "../../utils/resolve-project.js";
import { readRegistry, updateProject } from "../../config/registry.js";
import { isInboxActive } from "../../utils/inbox.js";

describe("retarget command", () => {
  let tempDir: string;
  let oldTarget: string;
  let newTarget: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), "proteus-retarget-test-"));
    oldTarget = join(tempDir, "old-target");
    newTarget = join(tempDir, "new-target");

    await mkdir(oldTarget, { recursive: true });
    await mkdir(join(oldTarget, ".proteus-forge"), { recursive: true });

    vi.mocked(resolveProject).mockResolvedValue({
      name: "test-project",
      entry: {
        source: "/tmp/source",
        target: oldTarget,
        createdAt: "2026-01-01T00:00:00Z",
        lastCompletedStage: "design",
      },
    });
    vi.mocked(readRegistry).mockResolvedValue({
      activeProject: "test-project",
      projects: {
        "test-project": {
          source: "/tmp/source",
          target: oldTarget,
          createdAt: "2026-01-01T00:00:00Z",
          lastCompletedStage: "design",
        },
      },
    });
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(updateProject).mockResolvedValue();
    vi.mocked(isInboxActive).mockReturnValue(false);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("does nothing when path is the same", async () => {
    const consoleSpy = vi.spyOn(console, "log");

    const { retargetCommand } = await import("../../commands/retarget.js");
    await retargetCommand.parseAsync(
      [oldTarget, "test-project"],
      { from: "user" }
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("nothing to do")
    );
    expect(updateProject).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("updates registry without --move", async () => {
    const { retargetCommand } = await import("../../commands/retarget.js");
    await retargetCommand.parseAsync(
      [newTarget, "test-project"],
      { from: "user" }
    );

    expect(updateProject).toHaveBeenCalledWith("test-project", {
      target: newTarget,
    });
    // Old directory should still exist (no move)
    expect(existsSync(oldTarget)).toBe(true);
  });

  it("moves directory with --move", async () => {
    const { retargetCommand } = await import("../../commands/retarget.js");
    await retargetCommand.parseAsync(
      [newTarget, "test-project", "--move"],
      { from: "user" }
    );

    expect(updateProject).toHaveBeenCalledWith("test-project", {
      target: newTarget,
    });
    expect(existsSync(newTarget)).toBe(true);
    expect(existsSync(oldTarget)).toBe(false);
  });

  it("rejects conflicting target path", async () => {
    vi.mocked(readRegistry).mockResolvedValue({
      activeProject: "test-project",
      projects: {
        "test-project": {
          source: "/tmp/source",
          target: oldTarget,
          createdAt: "2026-01-01T00:00:00Z",
          lastCompletedStage: "design",
        },
        "other-project": {
          source: "/tmp/other",
          target: newTarget,
          createdAt: "2026-01-01T00:00:00Z",
          lastCompletedStage: "new",
        },
      },
    });

    const consoleSpy = vi.spyOn(console, "error");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    const { retargetCommand } = await import("../../commands/retarget.js");

    await expect(
      retargetCommand.parseAsync(
        [newTarget, "test-project"],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("already uses target path")
    );

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("rejects --move when destination already exists", async () => {
    await mkdir(newTarget, { recursive: true });

    const consoleSpy = vi.spyOn(console, "error");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    const { retargetCommand } = await import("../../commands/retarget.js");

    await expect(
      retargetCommand.parseAsync(
        [newTarget, "test-project", "--move"],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("New target already exists")
    );

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("rejects --move during active session", async () => {
    vi.mocked(isInboxActive).mockReturnValue(true);

    const consoleSpy = vi.spyOn(console, "error");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    const { retargetCommand } = await import("../../commands/retarget.js");

    await expect(
      retargetCommand.parseAsync(
        [newTarget, "test-project", "--move"],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("active")
    );

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("cancels when user declines confirmation", async () => {
    vi.mocked(confirm).mockResolvedValue(false);

    const { retargetCommand } = await import("../../commands/retarget.js");
    await retargetCommand.parseAsync(
      [newTarget, "test-project"],
      { from: "user" }
    );

    expect(updateProject).not.toHaveBeenCalled();
  });
});
