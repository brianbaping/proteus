import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getStageOrder,
  getStageStatuses,
  getCurrentStage,
  checkStaleness,
  getStageDir,
  getStagesAfter,
  isValidStage,
} from "../../utils/stages.js";

describe("stages", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-stages-test-"));
    await mkdir(join(tempDir, ".proteus-forge"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("getStageOrder", () => {
    it("returns stages in correct order", () => {
      const order = getStageOrder();
      expect(order).toEqual(["inspect", "style", "design", "plan", "split", "execute"]);
    });
  });

  describe("getStageStatuses", () => {
    it("marks all stages as incomplete when no artifacts exist", () => {
      const statuses = getStageStatuses(tempDir);
      expect(statuses).toHaveLength(6);
      for (const status of statuses) {
        expect(status.complete).toBe(false);
      }
    });

    it("marks inspect as complete when features.json exists", async () => {
      await mkdir(join(tempDir, ".proteus-forge", "01-inspect"), { recursive: true });
      await writeFile(
        join(tempDir, ".proteus-forge", "01-inspect", "features.json"),
        "{}"
      );

      const statuses = getStageStatuses(tempDir);
      const inspect = statuses.find((s) => s.stage === "inspect");
      expect(inspect?.complete).toBe(true);
      expect(inspect?.modifiedAt).toBeInstanceOf(Date);
    });

    it("marks design as complete when design.md exists", async () => {
      await mkdir(join(tempDir, ".proteus-forge", "03-design"), { recursive: true });
      await writeFile(
        join(tempDir, ".proteus-forge", "03-design", "design.md"),
        "# Design"
      );

      const statuses = getStageStatuses(tempDir);
      const design = statuses.find((s) => s.stage === "design");
      expect(design?.complete).toBe(true);
    });
  });

  describe("getCurrentStage", () => {
    it("returns 'new' when no stages are complete", () => {
      expect(getCurrentStage(tempDir)).toBe("new");
    });

    it("returns 'style' when inspect is complete", async () => {
      await mkdir(join(tempDir, ".proteus-forge", "01-inspect"), { recursive: true });
      await writeFile(
        join(tempDir, ".proteus-forge", "01-inspect", "features.json"),
        "{}"
      );

      expect(getCurrentStage(tempDir)).toBe("style");
    });

    it("returns 'done' when all stages are complete", async () => {
      await mkdir(join(tempDir, ".proteus-forge", "01-inspect"), { recursive: true });
      await mkdir(join(tempDir, ".proteus-forge", "02-style"), { recursive: true });
      await mkdir(join(tempDir, ".proteus-forge", "03-design"), { recursive: true });
      await mkdir(join(tempDir, ".proteus-forge", "04-plan"), { recursive: true });
      await mkdir(join(tempDir, ".proteus-forge", "05-tracks"), { recursive: true });
      await mkdir(join(tempDir, ".proteus-forge", "06-execute"), { recursive: true });

      await writeFile(join(tempDir, ".proteus-forge", "01-inspect", "features.json"), "{}");
      await writeFile(join(tempDir, ".proteus-forge", "02-style", "style-guide.json"), "{}");
      await writeFile(join(tempDir, ".proteus-forge", "03-design", "design.md"), "#");
      await writeFile(join(tempDir, ".proteus-forge", "04-plan", "plan.json"), "{}");
      await writeFile(join(tempDir, ".proteus-forge", "05-tracks", "manifest.json"), "{}");
      await writeFile(join(tempDir, ".proteus-forge", "06-execute", "session.json"), "{}");

      expect(getCurrentStage(tempDir)).toBe("done");
    });
  });

  describe("getStageDir", () => {
    it("returns the directory name for each stage", () => {
      expect(getStageDir("inspect")).toBe("01-inspect");
      expect(getStageDir("style")).toBe("02-style");
      expect(getStageDir("design")).toBe("03-design");
      expect(getStageDir("plan")).toBe("04-plan");
      expect(getStageDir("split")).toBe("05-tracks");
      expect(getStageDir("execute")).toBe("06-execute");
    });
  });

  describe("getStagesAfter", () => {
    it("returns all stages after inspect", () => {
      expect(getStagesAfter("inspect")).toEqual([
        "style",
        "design",
        "plan",
        "split",
        "execute",
      ]);
    });

    it("returns stages after plan", () => {
      expect(getStagesAfter("plan")).toEqual(["split", "execute"]);
    });

    it("returns empty array for execute (last stage)", () => {
      expect(getStagesAfter("execute")).toEqual([]);
    });

    it("returns only execute after split", () => {
      expect(getStagesAfter("split")).toEqual(["execute"]);
    });
  });

  describe("isValidStage", () => {
    it("returns true for valid stage names", () => {
      expect(isValidStage("inspect")).toBe(true);
      expect(isValidStage("style")).toBe(true);
      expect(isValidStage("design")).toBe(true);
      expect(isValidStage("plan")).toBe(true);
      expect(isValidStage("split")).toBe(true);
      expect(isValidStage("execute")).toBe(true);
    });

    it("returns false for invalid stage names", () => {
      expect(isValidStage("invalid")).toBe(false);
      expect(isValidStage("")).toBe(false);
      expect(isValidStage("build")).toBe(false);
    });
  });

  describe("checkStaleness", () => {
    it("returns no warnings when no stages are complete", () => {
      const warnings = checkStaleness(tempDir);
      expect(warnings).toHaveLength(0);
    });

    it("detects when upstream was modified after downstream", async () => {
      await mkdir(join(tempDir, ".proteus-forge", "01-inspect"), { recursive: true });
      await mkdir(join(tempDir, ".proteus-forge", "02-style"), { recursive: true });

      // Create style first (older)
      await writeFile(join(tempDir, ".proteus-forge", "02-style", "style-guide.json"), "{}");

      // Wait a bit so timestamps differ
      await new Promise((r) => setTimeout(r, 50));

      // Then modify inspect (newer) — simulates editing features after style was done
      await writeFile(join(tempDir, ".proteus-forge", "01-inspect", "features.json"), "{}");

      const warnings = checkStaleness(tempDir);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      expect(warnings[0].stage).toBe("style");
    });
  });
});
