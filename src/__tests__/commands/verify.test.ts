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

import { resolveProject } from "../../utils/resolve-project.js";
import { runVerification, printVerifyResult } from "../../utils/verify.js";
import type { VerifyResult } from "../../utils/verify.js";

describe("verify command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-verify-cmd-"));
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
});
