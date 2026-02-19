import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function gitInit(cwd: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd });
}

export async function gitAdd(cwd: string, paths: string[]): Promise<void> {
  await execFileAsync("git", ["add", ...paths], { cwd });
}

export async function gitCommit(
  cwd: string,
  message: string
): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["commit", "-m", message, "--allow-empty"],
    { cwd }
  );
  return stdout.trim();
}

export async function gitStageAndCommit(
  cwd: string,
  message: string
): Promise<string> {
  await gitAdd(cwd, ["."]);
  return gitCommit(cwd, message);
}

export async function getLastWaveCheckpoint(
  cwd: string
): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--oneline", "--all", "--grep=proteus: execute wave"],
      { cwd }
    );
    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return null;

    const match = lines[0].match(/proteus: execute wave (\d+) complete/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}
