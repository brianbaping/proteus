import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendLogEntry } from "../../utils/log.js";

describe("log", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-log-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates log file on first entry", async () => {
    await appendLogEntry(tempDir, {
      action: "inspect",
      status: "success",
    });

    const logPath = join(tempDir, ".proteus-forge", "log.jsonl");
    expect(existsSync(logPath)).toBe(true);
  });

  it("writes valid JSONL format", async () => {
    await appendLogEntry(tempDir, {
      action: "inspect",
      status: "success",
      duration: "2m 15s",
      cost: 0.38,
    });

    const logPath = join(tempDir, ".proteus-forge", "log.jsonl");
    const content = await readFile(logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.action).toBe("inspect");
    expect(entry.status).toBe("success");
    expect(entry.duration).toBe("2m 15s");
    expect(entry.cost).toBe(0.38);
    expect(entry.timestamp).toBeDefined();
  });

  it("appends multiple entries", async () => {
    await appendLogEntry(tempDir, { action: "inspect", status: "success" });
    await appendLogEntry(tempDir, { action: "design", status: "success" });
    await appendLogEntry(tempDir, { action: "plan", status: "failed", details: "timeout" });

    const logPath = join(tempDir, ".proteus-forge", "log.jsonl");
    const content = await readFile(logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3);

    const entries = lines.map((l) => JSON.parse(l));
    expect(entries[0].action).toBe("inspect");
    expect(entries[1].action).toBe("design");
    expect(entries[2].action).toBe("plan");
    expect(entries[2].details).toBe("timeout");
  });
});
