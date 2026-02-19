import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeProjectConfig,
  readProjectConfig,
  createProjectConfig,
  getProjectProteusDir,
  getProjectConfigPath,
  ensureProjectDir,
} from "../../config/project.js";

describe("project config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-proj-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("createProjectConfig", () => {
    it("generates config with correct name and source", () => {
      const config = createProjectConfig("my-project", "/home/user/poc");
      expect(config.projectName).toBe("my-project");
      expect(config.source.path).toBe("/home/user/poc");
      expect(config.source.readonly).toBe(true);
      expect(config.proteusVersion).toBe("1.0.0");
    });
  });

  describe("path helpers", () => {
    it("returns correct .proteus directory path", () => {
      expect(getProjectProteusDir("/tmp/target")).toBe("/tmp/target/.proteus");
    });

    it("returns correct config path", () => {
      expect(getProjectConfigPath("/tmp/target")).toBe(
        "/tmp/target/.proteus/config.json"
      );
    });
  });

  describe("write and read", () => {
    it("roundtrips project config through filesystem", async () => {
      const config = createProjectConfig("test-proj", "/tmp/source");

      await writeProjectConfig(tempDir, config);

      const proteusDir = getProjectProteusDir(tempDir);
      expect(existsSync(proteusDir)).toBe(true);

      const read = await readProjectConfig(tempDir);
      expect(read).not.toBeNull();
      expect(read!.projectName).toBe("test-proj");
      expect(read!.source.path).toBe("/tmp/source");
    });

    it("returns null when config does not exist", async () => {
      const read = await readProjectConfig(tempDir);
      expect(read).toBeNull();
    });
  });

  describe("ensureProjectDir", () => {
    it("creates .proteus directory if it does not exist", async () => {
      const proteusDir = getProjectProteusDir(tempDir);
      expect(existsSync(proteusDir)).toBe(false);

      await ensureProjectDir(tempDir);
      expect(existsSync(proteusDir)).toBe(true);
    });

    it("is idempotent", async () => {
      await ensureProjectDir(tempDir);
      await ensureProjectDir(tempDir);
      expect(existsSync(getProjectProteusDir(tempDir))).toBe(true);
    });
  });
});
