import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BOLD, DIM, RESET } from "./ansi.js";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export interface VerifyStep {
  name: string;
  command: string;
  args: string[];
  passed: boolean;
  skipped: boolean;
  durationMs: number;
  output?: string;
}

export interface VerifyResult {
  packageManager: PackageManager;
  steps: VerifyStep[];
  allPassed: boolean;
}

const LOCKFILE_PRIORITY: Array<{ file: string; pm: PackageManager }> = [
  { file: "bun.lockb", pm: "bun" },
  { file: "bun.lock", pm: "bun" },
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
];

const STEP_TIMEOUTS: Record<string, number> = {
  install: 5 * 60_000,
  build: 3 * 60_000,
  test: 5 * 60_000,
  lint: 3 * 60_000,
};

export function detectPackageManager(targetPath: string): PackageManager {
  for (const { file, pm } of LOCKFILE_PRIORITY) {
    if (existsSync(join(targetPath, file))) {
      return pm;
    }
  }
  return "npm";
}

export async function getAvailableScripts(
  targetPath: string
): Promise<Set<string>> {
  const pkgPath = join(targetPath, "package.json");
  try {
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
    return new Set(Object.keys(pkg.scripts ?? {}));
  } catch {
    return new Set();
  }
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = execFile(command, args, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const output = (stdout ?? "") + (stderr ?? "");
      if (error) {
        resolve({ success: false, output: output || (error as Error).message });
      } else {
        resolve({ success: true, output });
      }
    });
    proc.on("error", (err) => {
      resolve({ success: false, output: err.message });
    });
  });
}

export interface VerifyOptions {
  skipInstall?: boolean;
  verbose?: boolean;
}

export async function runVerification(
  targetPath: string,
  options?: VerifyOptions
): Promise<VerifyResult> {
  const pm = detectPackageManager(targetPath);
  const scripts = await getAvailableScripts(targetPath);
  const steps: VerifyStep[] = [];

  // install
  const installStep: VerifyStep = {
    name: "install",
    command: pm,
    args: ["install"],
    passed: false,
    skipped: options?.skipInstall ?? false,
    durationMs: 0,
  };

  if (!installStep.skipped) {
    const start = Date.now();
    const result = await runCommand(pm, ["install"], targetPath, STEP_TIMEOUTS.install);
    installStep.durationMs = Date.now() - start;
    installStep.passed = result.success;
    if (!result.success) installStep.output = result.output;
  }
  steps.push(installStep);

  // build, test, lint — skip if no matching script
  const scriptSteps = ["build", "test", "lint"];
  for (const stepName of scriptSteps) {
    const hasScript = scripts.has(stepName);
    const step: VerifyStep = {
      name: stepName,
      command: pm,
      args: ["run", stepName],
      passed: false,
      skipped: !hasScript,
      durationMs: 0,
    };

    if (hasScript) {
      const start = Date.now();
      const result = await runCommand(pm, ["run", stepName], targetPath, STEP_TIMEOUTS[stepName]);
      step.durationMs = Date.now() - start;
      step.passed = result.success;
      if (!result.success) step.output = result.output;
    }
    steps.push(step);
  }

  const allPassed = steps.every((s) => s.skipped || s.passed);
  return { packageManager: pm, steps, allPassed };
}

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";

export function printVerifyResult(result: VerifyResult, verbose?: boolean): void {
  console.log(`\n${BOLD}  Verification Results${RESET} (${result.packageManager})\n`);

  for (const step of result.steps) {
    if (step.skipped) {
      console.log(`  ${DIM}○ ${step.name.padEnd(10)}${RESET} ${DIM}skipped${RESET}`);
    } else if (step.passed) {
      console.log(`  ${GREEN}✓ ${step.name.padEnd(10)}${RESET} passed  ${DIM}(${formatMs(step.durationMs)})${RESET}`);
    } else {
      console.log(`  ${RED}✗ ${step.name.padEnd(10)}${RESET} failed  ${DIM}(${formatMs(step.durationMs)})${RESET}`);
    }
  }

  if (verbose) {
    const failed = result.steps.filter((s) => !s.skipped && !s.passed);
    for (const step of failed) {
      if (step.output) {
        console.log(`\n  ${RED}--- ${step.name} output ---${RESET}`);
        const lines = step.output.split("\n").slice(-30);
        for (const line of lines) {
          console.log(`  ${line}`);
        }
      }
    }
  }

  console.log(
    result.allPassed
      ? `\n  ${GREEN}All checks passed.${RESET}\n`
      : `\n  ${RED}Some checks failed.${RESET} Run \`proteus-forge verify --verbose\` for details.\n`
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
