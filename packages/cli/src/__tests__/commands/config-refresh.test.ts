import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GlobalConfig } from "../../config/types.js";
import type { AnthropicModel } from "../../utils/models-api.js";

vi.mock("../../config/global.js", () => ({
  readGlobalConfig: vi.fn(),
  writeGlobalConfig: vi.fn(),
  getDefaultGlobalConfig: vi.fn(),
}));

vi.mock("../../utils/api-key.js", () => ({
  resolveApiKey: vi.fn(),
}));

vi.mock("../../utils/models-api.js", () => ({
  fetchAvailableModels: vi.fn(),
  extractModelFamily: vi.fn(),
  isModelAlias: vi.fn(),
}));

// Dynamic import to apply mocks before module loads
const { readGlobalConfig, writeGlobalConfig, getDefaultGlobalConfig } =
  await import("../../config/global.js");
const { resolveApiKey } = await import("../../utils/api-key.js");
const { fetchAvailableModels, extractModelFamily, isModelAlias } =
  await import("../../utils/models-api.js");

const mockedReadGlobalConfig = vi.mocked(readGlobalConfig);
const mockedWriteGlobalConfig = vi.mocked(writeGlobalConfig);
const _mockedGetDefaultGlobalConfig = vi.mocked(getDefaultGlobalConfig);
const mockedResolveApiKey = vi.mocked(resolveApiKey);
const mockedFetchAvailableModels = vi.mocked(fetchAvailableModels);
const mockedExtractModelFamily = vi.mocked(extractModelFamily);
const mockedIsModelAlias = vi.mocked(isModelAlias);

function makeConfig(tiers?: GlobalConfig["tiers"]): GlobalConfig {
  return {
    forgeVersion: "1.0.0",
    providers: { anthropic: { type: "anthropic", apiKey: "sk-test" } },
    tiers: tiers ?? {
      fast: { provider: "anthropic", model: "claude-haiku-4-5" },
      standard: { provider: "anthropic", model: "claude-sonnet-4-6" },
      advanced: { provider: "anthropic", model: "claude-opus-4-6" },
    },
    phases: { inspect: "fast" },
  };
}

function makeApiModels(): AnthropicModel[] {
  return [
    {
      id: "claude-opus-5-0",
      displayName: "Claude Opus 5.0",
      createdAt: "2026-02-01T00:00:00Z",
    },
    {
      id: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
      createdAt: "2025-05-14T00:00:00Z",
    },
    {
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      createdAt: "2025-05-14T00:00:00Z",
    },
    {
      id: "claude-haiku-5-0",
      displayName: "Claude Haiku 5.0",
      createdAt: "2026-01-15T00:00:00Z",
    },
    {
      id: "claude-haiku-4-5",
      displayName: "Claude Haiku 4.5",
      createdAt: "2025-10-01T00:00:00Z",
    },
    // Dated models — should be filtered out
    {
      id: "claude-opus-4-6-20250514",
      displayName: "Claude Opus 4.6 (20250514)",
      createdAt: "2025-05-14T00:00:00Z",
    },
  ];
}

/**
 * Simulate the refresh-models logic directly, since Commander commands
 * are hard to invoke in tests. This mirrors the action in config.ts.
 */
async function runRefreshModels(): Promise<{
  updates: Array<{ tier: string; from: string; to: string }>;
  config: GlobalConfig;
}> {
  const config = (await readGlobalConfig()) ?? getDefaultGlobalConfig();

  const apiKey = await resolveApiKey();
  if (!apiKey) throw new Error("No API key");

  const models = await fetchAvailableModels(apiKey);
  const aliases = models.filter((m) => isModelAlias(m.id));

  const updates: Array<{ tier: string; from: string; to: string }> = [];

  for (const [tierName, tierConfig] of Object.entries(config.tiers)) {
    const currentFamily = extractModelFamily(tierConfig.model);
    if (!currentFamily) continue;

    const newest = aliases.find(
      (m) => extractModelFamily(m.id) === currentFamily
    );

    if (newest && newest.id !== tierConfig.model) {
      updates.push({ tier: tierName, from: tierConfig.model, to: newest.id });
      tierConfig.model = newest.id;
    }
  }

  if (updates.length > 0) {
    await writeGlobalConfig(config);
  }

  return { updates, config };
}

describe("config refresh-models", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedResolveApiKey.mockResolvedValue("sk-test");

    // Wire up real extraction logic
    mockedExtractModelFamily.mockImplementation((id: string) => {
      const match = id.match(/^claude-(\w+)-\d/);
      return match?.[1];
    });
    mockedIsModelAlias.mockImplementation((id: string) => {
      return /^claude-\w+-\d+-\d+$/.test(id);
    });
  });

  it("updates tier when newer family model exists", async () => {
    mockedReadGlobalConfig.mockResolvedValue(makeConfig());
    mockedFetchAvailableModels.mockResolvedValue(makeApiModels());

    const { updates, config } = await runRefreshModels();

    expect(updates).toHaveLength(2);
    expect(updates).toContainEqual({
      tier: "fast",
      from: "claude-haiku-4-5",
      to: "claude-haiku-5-0",
    });
    expect(updates).toContainEqual({
      tier: "advanced",
      from: "claude-opus-4-6",
      to: "claude-opus-5-0",
    });
    expect(config.tiers.fast.model).toBe("claude-haiku-5-0");
    expect(config.tiers.advanced.model).toBe("claude-opus-5-0");
    expect(mockedWriteGlobalConfig).toHaveBeenCalledOnce();
  });

  it("leaves tier unchanged when already current", async () => {
    mockedReadGlobalConfig.mockResolvedValue(makeConfig());
    // Only return current models — no newer versions
    mockedFetchAvailableModels.mockResolvedValue([
      {
        id: "claude-opus-4-6",
        displayName: "Claude Opus 4.6",
        createdAt: "2025-05-14T00:00:00Z",
      },
      {
        id: "claude-sonnet-4-6",
        displayName: "Claude Sonnet 4.6",
        createdAt: "2025-05-14T00:00:00Z",
      },
      {
        id: "claude-haiku-4-5",
        displayName: "Claude Haiku 4.5",
        createdAt: "2025-10-01T00:00:00Z",
      },
    ]);

    const { updates } = await runRefreshModels();

    expect(updates).toHaveLength(0);
    expect(mockedWriteGlobalConfig).not.toHaveBeenCalled();
  });

  it("handles unknown family gracefully", async () => {
    const config = makeConfig({
      fast: { provider: "anthropic", model: "claude-haiku-4-5" },
      standard: { provider: "anthropic", model: "claude-sonnet-4-6" },
      advanced: { provider: "anthropic", model: "claude-opus-4-6" },
      custom: { provider: "custom", model: "gpt-4o" },
    });
    mockedReadGlobalConfig.mockResolvedValue(config);
    mockedFetchAvailableModels.mockResolvedValue(makeApiModels());

    // Should not throw — custom tier is skipped
    const { updates } = await runRefreshModels();

    // Only haiku and opus get updated, sonnet stays, custom skipped
    expect(updates).toHaveLength(2);
    expect(config.tiers.custom.model).toBe("gpt-4o");
  });

  it("shows correct output for mixed update/no-update scenario", async () => {
    // Only opus has an upgrade, sonnet and haiku stay
    mockedReadGlobalConfig.mockResolvedValue(makeConfig());
    mockedFetchAvailableModels.mockResolvedValue([
      {
        id: "claude-opus-5-0",
        displayName: "Claude Opus 5.0",
        createdAt: "2026-02-01T00:00:00Z",
      },
      {
        id: "claude-sonnet-4-6",
        displayName: "Claude Sonnet 4.6",
        createdAt: "2025-05-14T00:00:00Z",
      },
      {
        id: "claude-haiku-4-5",
        displayName: "Claude Haiku 4.5",
        createdAt: "2025-10-01T00:00:00Z",
      },
    ]);

    const { updates, config } = await runRefreshModels();

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      tier: "advanced",
      from: "claude-opus-4-6",
      to: "claude-opus-5-0",
    });
    expect(config.tiers.fast.model).toBe("claude-haiku-4-5");
    expect(config.tiers.standard.model).toBe("claude-sonnet-4-6");
    expect(config.tiers.advanced.model).toBe("claude-opus-5-0");
  });
});
