import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config/global.js", () => ({
  readGlobalConfig: vi.fn(),
}));

import { resolveApiKey } from "../../utils/api-key.js";
import { readGlobalConfig } from "../../config/global.js";

const mockedReadGlobalConfig = vi.mocked(readGlobalConfig);

describe("resolveApiKey", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves $ENV_VAR syntax from config", async () => {
    process.env.MY_CUSTOM_KEY = "sk-custom-123";
    mockedReadGlobalConfig.mockResolvedValue({
      forgeVersion: "1.0.0",
      providers: { anthropic: { type: "anthropic", apiKey: "$MY_CUSTOM_KEY" } },
      tiers: {},
      phases: {},
    });

    const key = await resolveApiKey();
    expect(key).toBe("sk-custom-123");
  });

  it("returns direct API key string from config", async () => {
    mockedReadGlobalConfig.mockResolvedValue({
      forgeVersion: "1.0.0",
      providers: {
        anthropic: { type: "anthropic", apiKey: "sk-direct-key" },
      },
      tiers: {},
      phases: {},
    });

    const key = await resolveApiKey();
    expect(key).toBe("sk-direct-key");
  });

  it("falls back to ANTHROPIC_API_KEY env var when no config key", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-env-fallback";
    mockedReadGlobalConfig.mockResolvedValue({
      forgeVersion: "1.0.0",
      providers: { anthropic: { type: "anthropic", apiKey: "" } },
      tiers: {},
      phases: {},
    });

    const key = await resolveApiKey();
    expect(key).toBe("sk-env-fallback");
  });

  it("returns undefined when no key available", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockedReadGlobalConfig.mockResolvedValue(null);

    const key = await resolveApiKey();
    expect(key).toBeUndefined();
  });
});
