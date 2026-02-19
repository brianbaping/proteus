import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getStageOrder,
  getStageStatuses,
  getCurrentStage,
  checkStaleness,
} from "../../utils/stages.js";

describe("stages", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-stages-test-"));
    await mkdir(join(tempDir, ".proteus"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("getStageOrder", () => {
    it("returns stages in correct order", () => {
      const order = getStageOrder();
      expect(order).toEqual(["inspect", "design", "plan", "split", "execute"]);
    });
  });

  describe("getStageStatuses", () => {
    it("marks all stages as incomplete when no artifacts exist", () => {
      const statuses = getStageStatuses(tempDir);
      expect(statuses).toHaveLength(5);
      for (const status of statuses) {
        expect(status.complete).toBe(false);
      }
    });

    it("marks inspect as complete when features.json exists", async () => {
      await mkdir(join(tempDir, ".proteus", "01-inspect"), { recursive: true });
      await writeFile(
        join(tempDir, ".proteus", "01-inspect", "features.json"),
        "{}"
      );

      const statuses = getStageStatuses(tempDir);
      const inspect = statuses.find((s) => s.stage === "inspect");
      expect(inspect?.complete).toBe(true);
      expect(inspect?.modifiedAt).toBeInstanceOf(Date);
    });

    it("marks design as complete when design.md exists", async () => {
      await mkdir(join(tempDir, ".proteus", "02-design"), { recursive: true });
      await writeFile(
        join(tempDir, ".proteus", "02-design", "design.md"),
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

    it("returns 'design' when inspect is complete", async () => {
      await mkdir(join(tempDir, ".proteus", "01-inspect"), { recursive: true });
      await writeFile(
        join(tempDir, ".proteus", "01-inspect", "features.json"),
        "{}"
      );

      expect(getCurrentStage(tempDir)).toBe("design");
    });

    it("returns 'done' when all stages are complete", async () => {
      await mkdir(join(tempDir, ".proteus", "01-inspect"), { recursive: true });
      await mkdir(join(tempDir, ".proteus", "02-design"), { recursive: true });
      await mkdir(join(tempDir, ".proteus", "03-plan"), { recursive: true });
      await mkdir(join(tempDir, ".proteus", "04-tracks"), { recursive: true });
      await mkdir(join(tempDir, ".proteus", "05-execute"), { recursive: true });

      await writeFile(join(tempDir, ".proteus", "01-inspect", "features.json"), "{}");
      await writeFile(join(tempDir, ".proteus", "02-design", "design.md"), "#");
      await writeFile(join(tempDir, ".proteus", "03-plan", "plan.json"), "{}");
      await writeFile(join(tempDir, ".proteus", "04-tracks", "manifest.json"), "{}");
      await writeFile(join(tempDir, ".proteus", "05-execute", "session.json"), "{}");

      expect(getCurrentStage(tempDir)).toBe("done");
    });
  });

  describe("checkStaleness", () => {
    it("returns no warnings when no stages are complete", () => {
      const warnings = checkStaleness(tempDir);
      expect(warnings).toHaveLength(0);
    });

    it("detects when upstream was modified after downstream", async () => {
      await mkdir(join(tempDir, ".proteus", "01-inspect"), { recursive: true });
      await mkdir(join(tempDir, ".proteus", "02-design"), { recursive: true });

      // Create design first (older)
      await writeFile(join(tempDir, ".proteus", "02-design", "design.md"), "#");

      // Wait a bit so timestamps differ
      await new Promise((r) => setTimeout(r, 50));

      // Then modify inspect (newer) — simulates editing features after design was done
      await writeFile(join(tempDir, ".proteus", "01-inspect", "features.json"), "{}");

      const warnings = checkStaleness(tempDir);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      expect(warnings[0].stage).toBe("design");
    });
  });
});
