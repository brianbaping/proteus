import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readCosts, appendCostEntry, removeCostEntries } from "../../utils/costs.js";
import type { StageCost } from "../../config/types.js";

describe("costs", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-costs-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns empty tracking when no costs file exists", async () => {
    const costs = await readCosts(tempDir);
    expect(costs.stages).toEqual({});
    expect(costs.totalCost).toBe(0);
  });

  it("appends a cost entry and reads it back", async () => {
    const entry: StageCost = {
      timestamp: "2026-02-19T10:00:00Z",
      teammates: 4,
      tier: "standard",
      duration: "2m 15s",
      inputTokens: 125000,
      outputTokens: 45000,
      estimatedCost: 0.38,
    };

    await appendCostEntry(tempDir, "inspect", entry);

    const costs = await readCosts(tempDir);
    expect(costs.stages.inspect).toBeDefined();
    expect(costs.stages.inspect.estimatedCost).toBe(0.38);
    expect(costs.stages.inspect.teammates).toBe(4);
    expect(costs.totalCost).toBeCloseTo(0.38);
  });

  it("accumulates costs across stages", async () => {
    await appendCostEntry(tempDir, "inspect", {
      timestamp: "2026-02-19T10:00:00Z",
      teammates: 4,
      tier: "standard",
      duration: "2m",
      inputTokens: 100000,
      outputTokens: 40000,
      estimatedCost: 0.50,
    });

    await appendCostEntry(tempDir, "design", {
      timestamp: "2026-02-19T10:05:00Z",
      teammates: 3,
      tier: "advanced",
      duration: "3m",
      inputTokens: 200000,
      outputTokens: 80000,
      estimatedCost: 1.20,
    });

    const costs = await readCosts(tempDir);
    expect(Object.keys(costs.stages)).toHaveLength(2);
    expect(costs.totalCost).toBeCloseTo(1.70);
  });

  describe("removeCostEntries", () => {
    it("removes a single stage cost entry", async () => {
      await appendCostEntry(tempDir, "inspect", {
        timestamp: "2026-02-19T10:00:00Z",
        teammates: 4,
        tier: "standard",
        duration: "2m",
        inputTokens: 100000,
        outputTokens: 40000,
        estimatedCost: 0.50,
      });
      await appendCostEntry(tempDir, "design", {
        timestamp: "2026-02-19T10:05:00Z",
        teammates: 3,
        tier: "advanced",
        duration: "3m",
        inputTokens: 200000,
        outputTokens: 80000,
        estimatedCost: 1.20,
      });

      await removeCostEntries(tempDir, ["design"]);
      const costs = await readCosts(tempDir);
      expect(costs.stages.design).toBeUndefined();
      expect(costs.stages.inspect).toBeDefined();
      expect(costs.totalCost).toBeCloseTo(0.50);
    });

    it("removes multiple stage cost entries", async () => {
      await appendCostEntry(tempDir, "inspect", {
        timestamp: "2026-02-19T10:00:00Z",
        teammates: 4,
        tier: "standard",
        duration: "2m",
        inputTokens: 100000,
        outputTokens: 40000,
        estimatedCost: 0.50,
      });
      await appendCostEntry(tempDir, "design", {
        timestamp: "2026-02-19T10:05:00Z",
        teammates: 3,
        tier: "advanced",
        duration: "3m",
        inputTokens: 200000,
        outputTokens: 80000,
        estimatedCost: 1.20,
      });
      await appendCostEntry(tempDir, "plan", {
        timestamp: "2026-02-19T10:10:00Z",
        teammates: 1,
        tier: "standard",
        duration: "1m",
        inputTokens: 50000,
        outputTokens: 20000,
        estimatedCost: 0.30,
      });

      await removeCostEntries(tempDir, ["design", "plan"]);
      const costs = await readCosts(tempDir);
      expect(costs.stages.design).toBeUndefined();
      expect(costs.stages.plan).toBeUndefined();
      expect(costs.stages.inspect).toBeDefined();
      expect(costs.totalCost).toBeCloseTo(0.50);
    });

    it("recalculates totalCost to zero when all entries removed", async () => {
      await appendCostEntry(tempDir, "inspect", {
        timestamp: "2026-02-19T10:00:00Z",
        teammates: 4,
        tier: "standard",
        duration: "2m",
        inputTokens: 100000,
        outputTokens: 40000,
        estimatedCost: 0.50,
      });

      await removeCostEntries(tempDir, ["inspect"]);
      const costs = await readCosts(tempDir);
      expect(Object.keys(costs.stages)).toHaveLength(0);
      expect(costs.totalCost).toBe(0);
    });

    it("is a no-op for missing entries", async () => {
      await appendCostEntry(tempDir, "inspect", {
        timestamp: "2026-02-19T10:00:00Z",
        teammates: 4,
        tier: "standard",
        duration: "2m",
        inputTokens: 100000,
        outputTokens: 40000,
        estimatedCost: 0.50,
      });

      await removeCostEntries(tempDir, ["design"]);
      const costs = await readCosts(tempDir);
      expect(costs.stages.inspect).toBeDefined();
      expect(costs.totalCost).toBeCloseTo(0.50);
    });

    it("is a no-op when costs file does not exist", async () => {
      // Should not throw
      await removeCostEntries(tempDir, ["inspect"]);
    });
  });

  it("overwrites cost for the same stage on re-run", async () => {
    await appendCostEntry(tempDir, "inspect", {
      timestamp: "2026-02-19T10:00:00Z",
      teammates: 4,
      tier: "standard",
      duration: "2m",
      inputTokens: 100000,
      outputTokens: 40000,
      estimatedCost: 0.50,
    });

    await appendCostEntry(tempDir, "inspect", {
      timestamp: "2026-02-19T11:00:00Z",
      teammates: 5,
      tier: "standard",
      duration: "3m",
      inputTokens: 150000,
      outputTokens: 60000,
      estimatedCost: 0.75,
    });

    const costs = await readCosts(tempDir);
    expect(costs.stages.inspect.estimatedCost).toBe(0.75);
    expect(costs.stages.inspect.teammates).toBe(5);
    expect(costs.totalCost).toBeCloseTo(0.75);
  });
});
