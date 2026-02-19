import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readCosts, appendCostEntry } from "../../utils/costs.js";
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
