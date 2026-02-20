import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeProjectConfig,
  readProjectConfig,
  createProjectConfig,
  getProjectForgeDir,
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
      expect(config.forgeVersion).toBe("1.0.0");
    });
  });

  describe("path helpers", () => {
    it("returns correct .proteus-forge directory path", () => {
      expect(getProjectForgeDir("/tmp/target")).toBe("/tmp/target/.proteus-forge");
    });

    it("returns correct config path", () => {
      expect(getProjectConfigPath("/tmp/target")).toBe(
        "/tmp/target/.proteus-forge/config.json"
      );
    });
  });

  describe("write and read", () => {
    it("roundtrips project config through filesystem", async () => {
      const config = createProjectConfig("test-proj", "/tmp/source");

      await writeProjectConfig(tempDir, config);

      const forgeDir = getProjectForgeDir(tempDir);
      expect(existsSync(forgeDir)).toBe(true);

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
    it("creates .proteus-forge directory if it does not exist", async () => {
      const forgeDir = getProjectForgeDir(tempDir);
      expect(existsSync(forgeDir)).toBe(false);

      await ensureProjectDir(tempDir);
      expect(existsSync(forgeDir)).toBe(true);
    });

    it("is idempotent", async () => {
      await ensureProjectDir(tempDir);
      await ensureProjectDir(tempDir);
      expect(existsSync(getProjectForgeDir(tempDir))).toBe(true);
    });
  });
});
