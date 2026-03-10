import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../../utils/resolve-project.js", () => ({
  resolveProject: vi.fn(),
}));

vi.mock("../../utils/verify.js", () => ({
  runVerification: vi.fn(),
  printVerifyResult: vi.fn(),
}));

vi.mock("../../config/global.js", () => ({
  readGlobalConfig: vi.fn(),
}));

vi.mock("../../utils/model-resolution.js", () => ({
  resolveModel: vi.fn(),
}));

vi.mock("../../session/launcher.js", () => ({
  launchSession: vi.fn(),
}));

vi.mock("../../utils/progress.js", () => ({
  createDashboard: vi.fn(() => ({
    onMessage: vi.fn(),
    cleanup: vi.fn(),
  })),
}));

vi.mock("../../utils/costs.js", () => ({
  appendCostEntry: vi.fn(),
}));

import { resolveProject } from "../../utils/resolve-project.js";
import { runVerification, printVerifyResult } from "../../utils/verify.js";
import { readGlobalConfig } from "../../config/global.js";
import { resolveModel } from "../../utils/model-resolution.js";
import { launchSession } from "../../session/launcher.js";
import type { VerifyResult } from "../../utils/verify.js";

describe("verify command", () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), "proteus-verify-cmd-"));
    const forgeDir = join(tempDir, ".proteus-forge");
    await mkdir(forgeDir, { recursive: true });

    vi.mocked(resolveProject).mockResolvedValue({
      name: "test-project",
      entry: {
        source: "/tmp/source",
        target: tempDir,
        createdAt: "2026-01-01T00:00:00Z",
        lastCompletedStage: "execute",
      },
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("returns true when all steps pass", async () => {
    await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));

    const mockResult: VerifyResult = {
      packageManager: "npm",
      steps: [
        { name: "install", command: "npm", args: ["install"], passed: true, skipped: false, durationMs: 100 },
        { name: "build", command: "npm", args: ["run", "build"], passed: true, skipped: false, durationMs: 200 },
        { name: "test", command: "npm", args: ["run", "test"], passed: false, skipped: true, durationMs: 0 },
        { name: "lint", command: "npm", args: ["run", "lint"], passed: false, skipped: true, durationMs: 0 },
      ],
      allPassed: true,
    };
    vi.mocked(runVerification).mockResolvedValue(mockResult);

    const { runVerify } = await import("../../commands/verify.js");
    const success = await runVerify("test-project", {});

    expect(success).toBe(true);
    expect(runVerification).toHaveBeenCalledWith(tempDir, { skipInstall: undefined, verbose: undefined });
    expect(printVerifyResult).toHaveBeenCalledWith(mockResult, undefined);
  });

  it("returns false when a step fails", async () => {
    await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));

    const mockResult: VerifyResult = {
      packageManager: "npm",
      steps: [
        { name: "install", command: "npm", args: ["install"], passed: true, skipped: false, durationMs: 100 },
        { name: "build", command: "npm", args: ["run", "build"], passed: false, skipped: false, durationMs: 200, output: "error" },
        { name: "test", command: "npm", args: ["run", "test"], passed: false, skipped: true, durationMs: 0 },
        { name: "lint", command: "npm", args: ["run", "lint"], passed: false, skipped: true, durationMs: 0 },
      ],
      allPassed: false,
    };
    vi.mocked(runVerification).mockResolvedValue(mockResult);

    const { runVerify } = await import("../../commands/verify.js");
    const success = await runVerify("test-project", {});

    expect(success).toBe(false);
  });

  it("returns false when no package.json exists", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { runVerify } = await import("../../commands/verify.js");
    const success = await runVerify("test-project", {});

    expect(success).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No package.json"));
    consoleSpy.mockRestore();
  });

  it("logs result to log.jsonl", async () => {
    await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));

    const mockResult: VerifyResult = {
      packageManager: "npm",
      steps: [
        { name: "install", command: "npm", args: ["install"], passed: true, skipped: false, durationMs: 100 },
        { name: "build", command: "npm", args: ["run", "build"], passed: true, skipped: false, durationMs: 200 },
        { name: "test", command: "npm", args: ["run", "test"], passed: false, skipped: true, durationMs: 0 },
        { name: "lint", command: "npm", args: ["run", "lint"], passed: false, skipped: true, durationMs: 0 },
      ],
      allPassed: true,
    };
    vi.mocked(runVerification).mockResolvedValue(mockResult);

    const { runVerify } = await import("../../commands/verify.js");
    await runVerify("test-project", {});

    const logContent = await readFile(join(tempDir, ".proteus-forge", "log.jsonl"), "utf-8");
    const logEntry = JSON.parse(logContent.trim());
    expect(logEntry.action).toBe("verify");
    expect(logEntry.status).toBe("success");
    expect(logEntry.details).toContain("install:passed");
    expect(logEntry.details).toContain("build:passed");
    expect(logEntry.details).toContain("test:skipped");
  });

  describe("--fix flag", () => {
    const failedResult: VerifyResult = {
      packageManager: "npm",
      steps: [
        { name: "install", command: "npm", args: ["install"], passed: true, skipped: false, durationMs: 100 },
        { name: "build", command: "npm", args: ["run", "build"], passed: false, skipped: false, durationMs: 200, output: "error TS2345" },
        { name: "test", command: "npm", args: ["run", "test"], passed: false, skipped: true, durationMs: 0 },
        { name: "lint", command: "npm", args: ["run", "lint"], passed: false, skipped: true, durationMs: 0 },
      ],
      allPassed: false,
    };

    const passingResult: VerifyResult = {
      packageManager: "npm",
      steps: [
        { name: "install", command: "npm", args: ["install"], passed: true, skipped: false, durationMs: 100 },
        { name: "build", command: "npm", args: ["run", "build"], passed: true, skipped: false, durationMs: 200 },
        { name: "test", command: "npm", args: ["run", "test"], passed: false, skipped: true, durationMs: 0 },
        { name: "lint", command: "npm", args: ["run", "lint"], passed: false, skipped: true, durationMs: 0 },
      ],
      allPassed: true,
    };

    const mockGlobalConfig = {
      forgeVersion: "1.0.0",
      providers: { anthropic: { type: "anthropic" as const, apiKey: "$ANTHROPIC_API_KEY" } },
      tiers: { standard: { provider: "anthropic", model: "claude-sonnet-4-6" } },
      phases: { execute: "standard" },
    };

    const mockSessionResult = {
      success: true,
      sessionId: "sess-123",
      cost: {
        timestamp: "2026-01-01T00:00:00Z",
        teammates: 0,
        tier: "claude-sonnet-4-6",
        duration: "30s",
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.05,
      },
    };

    it("does not launch fix session without --fix flag", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
      vi.mocked(runVerification).mockResolvedValue(failedResult);

      const { runVerify } = await import("../../commands/verify.js");
      await runVerify("test-project", {});

      expect(launchSession).not.toHaveBeenCalled();
    });

    it("does not launch fix session when all steps pass", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
      vi.mocked(runVerification).mockResolvedValue(passingResult);
      vi.mocked(readGlobalConfig).mockResolvedValue(mockGlobalConfig);

      const { runVerify } = await import("../../commands/verify.js");
      const success = await runVerify("test-project", { fix: true });

      expect(success).toBe(true);
      expect(launchSession).not.toHaveBeenCalled();
    });

    it("launches fix session on failure with --fix", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
      vi.mocked(runVerification)
        .mockResolvedValueOnce(failedResult)
        .mockResolvedValueOnce(passingResult);
      vi.mocked(readGlobalConfig).mockResolvedValue(mockGlobalConfig);
      vi.mocked(resolveModel).mockReturnValue("claude-sonnet-4-6");
      vi.mocked(launchSession).mockResolvedValue(mockSessionResult);

      const { runVerify } = await import("../../commands/verify.js");
      const success = await runVerify("test-project", { fix: true });

      expect(launchSession).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: tempDir,
          model: "claude-sonnet-4-6",
          permissionMode: "acceptEdits",
        })
      );
      expect(success).toBe(true);
    });

    it("re-verifies after fix session and returns result", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
      vi.mocked(runVerification)
        .mockResolvedValueOnce(failedResult)
        .mockResolvedValueOnce(failedResult);
      vi.mocked(readGlobalConfig).mockResolvedValue(mockGlobalConfig);
      vi.mocked(resolveModel).mockReturnValue("claude-sonnet-4-6");
      vi.mocked(launchSession).mockResolvedValue(mockSessionResult);

      const { runVerify } = await import("../../commands/verify.js");
      const success = await runVerify("test-project", { fix: true });

      expect(runVerification).toHaveBeenCalledTimes(2);
      expect(success).toBe(false);
    });

    it("returns false when fix session itself fails", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
      vi.mocked(runVerification).mockResolvedValue(failedResult);
      vi.mocked(readGlobalConfig).mockResolvedValue(mockGlobalConfig);
      vi.mocked(resolveModel).mockReturnValue("claude-sonnet-4-6");
      vi.mocked(launchSession).mockResolvedValue({
        ...mockSessionResult,
        success: false,
        errors: ["Session timed out"],
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { runVerify } = await import("../../commands/verify.js");
      const success = await runVerify("test-project", { fix: true });

      expect(success).toBe(false);
      expect(runVerification).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it("returns false when global config is missing", async () => {
      await writeFile(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));
      vi.mocked(runVerification).mockResolvedValue(failedResult);
      vi.mocked(readGlobalConfig).mockResolvedValue(null);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { runVerify } = await import("../../commands/verify.js");
      const success = await runVerify("test-project", { fix: true });

      expect(success).toBe(false);
      expect(launchSession).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
