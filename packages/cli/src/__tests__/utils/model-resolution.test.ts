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
  roles: {
    scout: "fast",
    "design-specialist": "advanced",
    "plan-generator": "standard",
  },
  ...overrides,
});

describe("resolveModel", () => {
  it("returns model from role → tier → model chain", () => {
    const config = makeConfig();
    expect(resolveModel(config, "scout")).toBe("claude-haiku-4-5");
    expect(resolveModel(config, "design-specialist")).toBe("claude-opus-4-6");
    expect(resolveModel(config, "plan-generator")).toBe("claude-sonnet-4-6");
  });

  it("overrides with --tier flag", () => {
    const config = makeConfig();
    const model = resolveModel(config, "scout", { tier: "advanced" });
    expect(model).toBe("claude-opus-4-6");
  });

  it("overrides with --model flag", () => {
    const config = makeConfig();
    const model = resolveModel(config, "scout", { model: "custom-model-1" });
    expect(model).toBe("custom-model-1");
  });

  it("--model takes precedence over --tier", () => {
    const config = makeConfig();
    const model = resolveModel(config, "scout", {
      tier: "advanced",
      model: "custom-model-1",
    });
    expect(model).toBe("custom-model-1");
  });

  it("throws on unknown tier name", () => {
    const config = makeConfig();
    expect(() => resolveModel(config, "scout", { tier: "turbo" })).toThrow(
      'Unknown tier "turbo". Available: fast, standard, advanced'
    );
  });

  it("returns undefined for unknown role", () => {
    const config = makeConfig();
    expect(resolveModel(config, "nonexistent-role")).toBeUndefined();
  });

  it("resolves direct TierConfig role mapping", () => {
    const config = makeConfig({
      roles: {
        ...makeConfig().roles,
        "direct-role": { provider: "anthropic", model: "direct-model" },
      },
    });
    expect(resolveModel(config, "direct-role")).toBe("direct-model");
  });
});
