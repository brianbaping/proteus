import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeInboxMessage,
  consumeInboxMessages,
  getInboxDir,
  isInboxActive,
} from "../../utils/inbox.js";

describe("inbox", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-inbox-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("getInboxDir", () => {
    it("returns correct inbox path", () => {
      expect(getInboxDir("/tmp/target")).toBe(
        "/tmp/target/.proteus-forge/05-execute/inbox"
      );
    });
  });

  describe("writeInboxMessage", () => {
    it("creates the inbox directory and writes a message file", async () => {
      await writeInboxMessage(tempDir, "backend-engineer", "Fix the auth bug");

      const inboxDir = getInboxDir(tempDir);
      expect(existsSync(inboxDir)).toBe(true);

      const files = await readdir(inboxDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      expect(jsonFiles).toHaveLength(1);
    });

    it("writes valid JSON with correct fields", async () => {
      await writeInboxMessage(tempDir, "frontend-engineer", "Add loading state");

      const inboxDir = getInboxDir(tempDir);
      const files = await readdir(inboxDir);
      const jsonFile = files.find((f) => f.endsWith(".json"))!;
      const content = JSON.parse(
        await readFile(join(inboxDir, jsonFile), "utf-8")
      );

      expect(content.targetAgent).toBe("frontend-engineer");
      expect(content.message).toBe("Add loading state");
      expect(content.timestamp).toBeDefined();
    });

    it("includes agent name in filename", async () => {
      await writeInboxMessage(tempDir, "qa-engineer", "Run tests");

      const inboxDir = getInboxDir(tempDir);
      const files = await readdir(inboxDir);
      const jsonFile = files.find((f) => f.endsWith(".json"))!;
      expect(jsonFile).toContain("qa-engineer");
    });
  });

  describe("consumeInboxMessages", () => {
    it("returns empty array when no messages", async () => {
      const messages = await consumeInboxMessages(tempDir);
      expect(messages).toEqual([]);
    });

    it("reads and deletes messages", async () => {
      await writeInboxMessage(tempDir, "backend-engineer", "Message 1");
      await writeInboxMessage(tempDir, "frontend-engineer", "Message 2");

      const messages = await consumeInboxMessages(tempDir);
      expect(messages).toHaveLength(2);
      expect(messages[0].targetAgent).toBe("backend-engineer");
      expect(messages[1].targetAgent).toBe("frontend-engineer");

      // Messages should be deleted after consumption
      const remaining = await consumeInboxMessages(tempDir);
      expect(remaining).toHaveLength(0);
    });

    it("returns messages in chronological order", async () => {
      await writeInboxMessage(tempDir, "agent-a", "First");
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      await writeInboxMessage(tempDir, "agent-b", "Second");

      const messages = await consumeInboxMessages(tempDir);
      expect(messages[0].message).toBe("First");
      expect(messages[1].message).toBe("Second");
    });
  });

  describe("isInboxActive", () => {
    it("returns false when no sentinel file exists", () => {
      expect(isInboxActive(tempDir)).toBe(false);
    });

    it("returns true when sentinel file exists", async () => {
      const inboxDir = getInboxDir(tempDir);
      await mkdir(inboxDir, { recursive: true });
      await writeFile(join(inboxDir, ".active"), "2026-02-19");

      expect(isInboxActive(tempDir)).toBe(true);
    });
  });
});
