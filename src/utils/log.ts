import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureProjectDir } from "../config/project.js";

export interface LogEntry {
  action: string;
  status: string;
  duration?: string;
  cost?: number;
  teammates?: number;
  details?: string;
}

function getLogPath(targetPath: string): string {
  return join(targetPath, ".proteus", "log.jsonl");
}

export async function appendLogEntry(
  targetPath: string,
  entry: LogEntry
): Promise<void> {
  await ensureProjectDir(targetPath);
  const logLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  await appendFile(getLogPath(targetPath), logLine + "\n");
}
