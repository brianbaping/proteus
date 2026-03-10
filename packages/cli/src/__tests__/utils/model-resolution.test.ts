import { describe, it, expect } from "vitest";
import { resolveModel } from "../../utils/model-resolution.js";
import type { GlobalConfig } from "../../config/types.js";

const makeConfig = (overrides?: Partial<GlobalConfig>): GlobalConfig => ({
  forgeVersion: "1.0.0",
  providers: {
    anthropic: { type: "anthropic", apiKey: "test" },
  },
  tiers: {
    fast: { provider: "anthropic", model: "claude-haiku-4-5" },
    standard: { provider: "anthropic", model: "claude-sonnet-4-6" },
    advanced: { provider: "anthropic", model: "claude-opus-4-6" },
  },
  phases: {
    inspect: "fast",
    design: "advanced",
    plan: "standard",
  },
  ...overrides,
});

describe("resolveModel", () => {
  it("returns model from phase → tier → model chain", () => {
    const config = makeConfig();
    expect(resolveModel(config, "inspect")).toBe("claude-haiku-4-5");
    expect(resolveModel(config, "design")).toBe("claude-opus-4-6");
    expect(resolveModel(config, "plan")).toBe("claude-sonnet-4-6");
  });

  it("overrides with --tier flag", () => {
    const config = makeConfig();
    const model = resolveModel(config, "inspect", { tier: "advanced" });
    expect(model).toBe("claude-opus-4-6");
  });

  it("overrides with --model flag", () => {
    const config = makeConfig();
    const model = resolveModel(config, "inspect", { model: "custom-model-1" });
    expect(model).toBe("custom-model-1");
  });

  it("--model takes precedence over --tier", () => {
    const config = makeConfig();
    const model = resolveModel(config, "inspect", {
      tier: "advanced",
      model: "custom-model-1",
    });
    expect(model).toBe("custom-model-1");
  });

  it("throws on unknown tier name", () => {
    const config = makeConfig();
    expect(() => resolveModel(config, "inspect", { tier: "turbo" })).toThrow(
      'Unknown tier "turbo". Available: fast, standard, advanced'
    );
  });

  it("returns undefined for unknown phase", () => {
    const config = makeConfig();
    expect(resolveModel(config, "nonexistent-phase")).toBeUndefined();
  });

  it("resolves direct TierConfig phase mapping", () => {
    const config = makeConfig({
      phases: {
        ...makeConfig().phases,
        "custom-phase": { provider: "anthropic", model: "direct-model" },
      },
    });
    expect(resolveModel(config, "custom-phase")).toBe("direct-model");
  });
});
