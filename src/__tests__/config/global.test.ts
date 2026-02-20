import { describe, it, expect } from "vitest";
import { getDefaultGlobalConfig } from "../../config/global.js";

// We test the pure functions and use a temp dir for file I/O tests
// Note: read/writeGlobalConfig use a hardcoded path (~/.proteus-forge/config.json)
// so we test the default config generation and structure instead

describe("global config", () => {
  describe("getDefaultGlobalConfig", () => {
    it("returns a config with forgeVersion", () => {
      const config = getDefaultGlobalConfig();
      expect(config.forgeVersion).toBe("1.0.0");
    });

    it("includes three default tiers", () => {
      const config = getDefaultGlobalConfig();
      expect(Object.keys(config.tiers)).toEqual(["fast", "standard", "advanced"]);
    });

    it("maps all tiers to anthropic provider", () => {
      const config = getDefaultGlobalConfig();
      for (const tier of Object.values(config.tiers)) {
        expect(tier.provider).toBe("anthropic");
      }
    });

    it("includes role mappings for all agent types", () => {
      const config = getDefaultGlobalConfig();
      const expectedRoles = [
        "scout",
        "build-team",
        "inspect-specialist",
        "synthesizer",
        "design-specialist",
        "plan-generator",
        "execute-agent",
        "qa-agent",
      ];
      for (const role of expectedRoles) {
        expect(config.roles[role]).toBeDefined();
      }
    });

    it("maps scout to fast tier", () => {
      const config = getDefaultGlobalConfig();
      expect(config.roles.scout).toBe("fast");
    });

    it("maps execute-agent to advanced tier", () => {
      const config = getDefaultGlobalConfig();
      expect(config.roles["execute-agent"]).toBe("advanced");
    });
  });
});
