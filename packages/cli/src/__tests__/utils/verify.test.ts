import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import {
  detectPackageManager,
  getAvailableScripts,
  runVerification,
} from "../../utils/verify.js";

function mockExecFile(results: Array<{ error?: Error; stdout?: string; stderr?: string }>) {
  let callIndex = 0;
  vi.mocked(execFile).mockImplementation(
    (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
      const result = results[callIndex++] ?? { stdout: "", stderr: "" };
      const cb = callback as (error: Error | null, stdout: string, stderr: string) => void;
      if (result.error) {
        cb(result.error, result.stdout ?? "", result.stderr ?? "");
      } else {
        cb(null, result.stdout ?? "", result.stderr ?? "");
      }
      return { on: vi.fn() } as unknown as ReturnType<typeof execFile>;
    }
  );
}

describe("detectPackageManager", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-verify-pm-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns npm when no lockfile exists", () => {
    expect(detectPackageManager(tempDir)).toBe("npm");
  });

  it("detects bun from bun.lockb", async () => {
    await writeFile(join(tempDir, "bun.lockb"), "");
    expect(detectPackageManager(tempDir)).toBe("bun");
  });

  it("detects bun from bun.lock", async () => {
    await writeFile(join(tempDir, "bun.lock"), "");
    expect(detectPackageManager(tempDir)).toBe("bun");
  });

  it("detects pnpm from pnpm-lock.yaml", async () => {
    await writeFile(join(tempDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tempDir)).toBe("pnpm");
  });

  it("detects yarn from yarn.lock", async () => {
    await writeFile(join(tempDir, "yarn.lock"), "");
    expect(detectPackageManager(tempDir)).toBe("yarn");
  });

  it("detects npm from package-lock.json", async () => {
    await writeFile(join(tempDir, "package-lock.json"), "{}");
    expect(detectPackageManager(tempDir)).toBe("npm");
  });

  it("prioritizes bun over pnpm when both lockfiles exist", async () => {
    await writeFile(join(tempDir, "bun.lockb"), "");
    await writeFile(join(tempDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tempDir)).toBe("bun");
  });

  it("prioritizes pnpm over yarn when both lockfiles exist", async () => {
    await writeFile(join(tempDir, "pnpm-lock.yaml"), "");
    await writeFile(join(tempDir, "yarn.lock"), "");
    expect(detectPackageManager(tempDir)).toBe("pnpm");
  });
});

describe("getAvailableScripts", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-verify-scripts-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns script names from package.json", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        scripts: { build: "tsc", test: "vitest", lint: "eslint ." },
      })
    );
    const scripts = await getAvailableScripts(tempDir);
    expect(scripts.has("build")).toBe(true);
    expect(scripts.has("test")).toBe(true);
    expect(scripts.has("lint")).toBe(true);
  });

  it("returns empty set when package.json is missing", async () => {
    const scripts = await getAvailableScripts(tempDir);
    expect(scripts.size).toBe(0);
  });

  it("returns empty set when package.json has no scripts", async () => {
    await writeFile(join(tempDir, "package.json"), JSON.stringify({ name: "test" }));
    const scripts = await getAvailableScripts(tempDir);
    expect(scripts.size).toBe(0);
  });

  it("handles malformed package.json gracefully", async () => {
    await writeFile(join(tempDir, "package.json"), "not json");
    const scripts = await getAvailableScripts(tempDir);
    expect(scripts.size).toBe(0);
  });
});

describe("runVerification", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-verify-run-"));
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        scripts: { build: "tsc", test: "vitest", lint: "eslint ." },
      })
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("runs all steps when scripts are present", async () => {
    mockExecFile([
      { stdout: "installed" },
      { stdout: "built" },
      { stdout: "tested" },
      { stdout: "linted" },
    ]);

    const result = await runVerification(tempDir);

    expect(result.steps).toHaveLength(4);
    expect(result.steps[0].name).toBe("install");
    expect(result.steps[0].passed).toBe(true);
    expect(result.steps[0].skipped).toBe(false);
    expect(result.steps[1].name).toBe("build");
    expect(result.steps[1].passed).toBe(true);
    expect(result.steps[2].name).toBe("test");
    expect(result.steps[2].passed).toBe(true);
    expect(result.steps[3].name).toBe("lint");
    expect(result.steps[3].passed).toBe(true);
    expect(result.allPassed).toBe(true);
  });

  it("skips steps when scripts are absent", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({ scripts: { build: "tsc" } })
    );

    mockExecFile([
      { stdout: "installed" },
      { stdout: "built" },
    ]);

    const result = await runVerification(tempDir);

    expect(result.steps[0].name).toBe("install");
    expect(result.steps[0].skipped).toBe(false);
    expect(result.steps[1].name).toBe("build");
    expect(result.steps[1].skipped).toBe(false);
    expect(result.steps[2].name).toBe("test");
    expect(result.steps[2].skipped).toBe(true);
    expect(result.steps[3].name).toBe("lint");
    expect(result.steps[3].skipped).toBe(true);
    expect(result.allPassed).toBe(true);
  });

  it("captures failure output", async () => {
    mockExecFile([
      { stdout: "installed" },
      { error: new Error("exit code 1"), stdout: "", stderr: "Type error in foo.ts" },
      { stdout: "tested" },
      { stdout: "linted" },
    ]);

    const result = await runVerification(tempDir);

    expect(result.steps[1].passed).toBe(false);
    expect(result.steps[1].output).toContain("Type error");
    expect(result.allPassed).toBe(false);
  });

  it("skips install when skipInstall is true", async () => {
    mockExecFile([
      { stdout: "built" },
      { stdout: "tested" },
      { stdout: "linted" },
    ]);

    const result = await runVerification(tempDir, { skipInstall: true });

    expect(result.steps[0].name).toBe("install");
    expect(result.steps[0].skipped).toBe(true);
    expect(result.steps[1].name).toBe("build");
    expect(result.steps[1].passed).toBe(true);
    expect(result.allPassed).toBe(true);
  });

  it("detects package manager from lockfile", async () => {
    await writeFile(join(tempDir, "pnpm-lock.yaml"), "");

    mockExecFile([
      { stdout: "installed" },
      { stdout: "built" },
      { stdout: "tested" },
      { stdout: "linted" },
    ]);

    const result = await runVerification(tempDir);
    expect(result.packageManager).toBe("pnpm");
  });

  it("reports allPassed false when any step fails", async () => {
    mockExecFile([
      { stdout: "installed" },
      { stdout: "built" },
      { stdout: "tested" },
      { error: new Error("exit code 1"), stdout: "", stderr: "lint errors" },
    ]);

    const result = await runVerification(tempDir);
    expect(result.allPassed).toBe(false);
    expect(result.steps[3].passed).toBe(false);
  });
});
