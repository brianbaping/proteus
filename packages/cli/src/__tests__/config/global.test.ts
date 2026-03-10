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

    it("includes phase mappings for all pipeline stages", () => {
      const config = getDefaultGlobalConfig();
      const expectedPhases = [
        "inspect",
        "style",
        "design",
        "plan",
        "split",
        "execute",
      ];
      for (const phase of expectedPhases) {
        expect(config.phases[phase]).toBeDefined();
      }
    });

    it("maps inspect to fast tier", () => {
      const config = getDefaultGlobalConfig();
      expect(config.phases.inspect).toBe("fast");
    });

    it("maps execute to advanced tier", () => {
      const config = getDefaultGlobalConfig();
      expect(config.phases.execute).toBe("advanced");
    });
  });
});
