import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldClaudeCommands } from "../../utils/scaffold-commands.js";

describe("scaffoldClaudeCommands", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-scaffold-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates .claude/commands/ directory and all 4 files", async () => {
    const result = await scaffoldClaudeCommands(tempDir);

    expect(result.files).toHaveLength(4);
    const commandsDir = join(tempDir, ".claude", "commands");
    expect(existsSync(commandsDir)).toBe(true);

    const entries = await readdir(commandsDir);
    expect(entries.sort()).toEqual([
      "fix-all.md",
      "fix-build.md",
      "fix-lint.md",
      "fix-tests.md",
    ]);
  });

  it("command files have valid YAML frontmatter with description", async () => {
    await scaffoldClaudeCommands(tempDir);

    const commandsDir = join(tempDir, ".claude", "commands");
    const files = await readdir(commandsDir);

    for (const file of files) {
      const content = await readFile(join(commandsDir, file), "utf-8");
      expect(content).toMatch(/^---\n/);
      expect(content).toMatch(/description:/);
      expect(content).toMatch(/\n---\n/);
    }
  });

  it("uses detected package manager from bun lockfile", async () => {
    await writeFile(join(tempDir, "bun.lockb"), "");

    await scaffoldClaudeCommands(tempDir);

    const content = await readFile(
      join(tempDir, ".claude", "commands", "fix-build.md"),
      "utf-8"
    );
    expect(content).toContain("bun run build");
  });

  it("defaults to npm when no lockfile present", async () => {
    await scaffoldClaudeCommands(tempDir);

    const content = await readFile(
      join(tempDir, ".claude", "commands", "fix-build.md"),
      "utf-8"
    );
    expect(content).toContain("npm run build");
  });

  it("accepts explicit packageManager option override", async () => {
    await writeFile(join(tempDir, "bun.lockb"), "");

    await scaffoldClaudeCommands(tempDir, { packageManager: "pnpm" });

    const content = await readFile(
      join(tempDir, ".claude", "commands", "fix-tests.md"),
      "utf-8"
    );
    expect(content).toContain("pnpm run test");
  });

  it("commands reference .proteus-forge/ artifacts", async () => {
    await scaffoldClaudeCommands(tempDir);

    const commandsDir = join(tempDir, ".claude", "commands");
    const files = await readdir(commandsDir);

    for (const file of files) {
      const content = await readFile(join(commandsDir, file), "utf-8");
      expect(content).toContain(".proteus-forge/02-design/design.md");
      expect(content).toContain(".proteus-forge/03-plan/plan.md");
    }
  });

  it("appends Repair Commands section to existing CLAUDE.md", async () => {
    const existing = "# CLAUDE.md\n\nSome existing content.\n";
    await writeFile(join(tempDir, "CLAUDE.md"), existing);

    const result = await scaffoldClaudeCommands(tempDir);

    expect(result.claudeMdUpdated).toBe(true);
    const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("## Repair Commands");
    expect(content).toContain("/fix-build");
    expect(content).toContain("/fix-tests");
    expect(content).toContain("/fix-lint");
    expect(content).toContain("/fix-all");
    expect(content.startsWith(existing)).toBe(true);
  });

  it("skips CLAUDE.md append when file does not exist", async () => {
    const result = await scaffoldClaudeCommands(tempDir);

    expect(result.claudeMdUpdated).toBe(false);
    expect(existsSync(join(tempDir, "CLAUDE.md"))).toBe(false);
  });

  it("is idempotent — second call does not duplicate CLAUDE.md section", async () => {
    await writeFile(join(tempDir, "CLAUDE.md"), "# CLAUDE.md\n");

    await scaffoldClaudeCommands(tempDir);
    const result2 = await scaffoldClaudeCommands(tempDir);

    expect(result2.claudeMdUpdated).toBe(false);
    const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
    const occurrences = content.split("## Repair Commands").length - 1;
    expect(occurrences).toBe(1);
  });

  it("returns correct 4-file list with full paths", async () => {
    const result = await scaffoldClaudeCommands(tempDir);

    expect(result.files).toHaveLength(4);
    for (const filePath of result.files) {
      expect(filePath).toContain(join(".claude", "commands"));
      expect(existsSync(filePath)).toBe(true);
    }
  });

  it("commands include $ARGUMENTS for optional focus targets", async () => {
    await scaffoldClaudeCommands(tempDir);

    const commandsDir = join(tempDir, ".claude", "commands");
    const files = await readdir(commandsDir);

    for (const file of files) {
      const content = await readFile(join(commandsDir, file), "utf-8");
      expect(content).toContain("$ARGUMENTS");
    }
  });

  it("commands include constraint language", async () => {
    await scaffoldClaudeCommands(tempDir);

    const commandsDir = join(tempDir, ".claude", "commands");
    const files = await readdir(commandsDir);

    for (const file of files) {
      const content = await readFile(join(commandsDir, file), "utf-8");
      expect(content).toContain("## Constraints");
      expect(content).toContain("architecture");
    }
  });
});
