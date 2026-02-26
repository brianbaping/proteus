import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchAvailableModels,
  extractModelFamily,
  isModelAlias,
} from "../../utils/models-api.js";

describe("fetchAvailableModels", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses model list from a single page", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: "claude-opus-4-6",
            display_name: "Claude Opus 4.6",
            created_at: "2025-05-14T00:00:00Z",
            type: "model",
          },
          {
            id: "claude-sonnet-4-6",
            display_name: "Claude Sonnet 4.6",
            created_at: "2025-05-14T00:00:00Z",
            type: "model",
          },
        ],
        has_more: false,
        last_id: null,
      }),
    });

    const models = await fetchAvailableModels("sk-test");
    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({
      id: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
      createdAt: "2025-05-14T00:00:00Z",
    });
    expect(models[1]).toEqual({
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      createdAt: "2025-05-14T00:00:00Z",
    });
  });

  it("handles pagination across multiple pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "claude-opus-4-6",
              display_name: "Claude Opus 4.6",
              created_at: "2025-05-14T00:00:00Z",
              type: "model",
            },
          ],
          has_more: true,
          last_id: "claude-opus-4-6",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "claude-haiku-4-5",
              display_name: "Claude Haiku 4.5",
              created_at: "2025-10-01T00:00:00Z",
              type: "model",
            },
          ],
          has_more: false,
          last_id: null,
        }),
      });
    globalThis.fetch = fetchMock;

    const models = await fetchAvailableModels("sk-test");
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("claude-opus-4-6");
    expect(models[1].id).toBe("claude-haiku-4-5");

    // Verify second call included after_id
    const secondCallUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondCallUrl).toContain("after_id=claude-opus-4-6");
  });

  it("throws on 401 auth error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    await expect(fetchAvailableModels("sk-bad")).rejects.toThrow(
      "Authentication failed: invalid API key"
    );
  });

  it("throws on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(fetchAvailableModels("sk-test")).rejects.toThrow(
      "Network error"
    );
  });

  it("throws on non-401 HTTP error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(fetchAvailableModels("sk-test")).rejects.toThrow(
      "Anthropic API error: 500 Internal Server Error"
    );
  });
});

describe("extractModelFamily", () => {
  it("extracts family from standard model IDs", () => {
    expect(extractModelFamily("claude-haiku-4-5")).toBe("haiku");
    expect(extractModelFamily("claude-sonnet-4-6")).toBe("sonnet");
    expect(extractModelFamily("claude-opus-4-6")).toBe("opus");
  });

  it("extracts family from dated model IDs", () => {
    expect(extractModelFamily("claude-haiku-4-5-20251001")).toBe("haiku");
  });

  it("returns undefined for unrecognized formats", () => {
    expect(extractModelFamily("gpt-4")).toBeUndefined();
    expect(extractModelFamily("not-a-claude-model")).toBeUndefined();
  });
});

describe("isModelAlias", () => {
  it("returns true for alias-style IDs", () => {
    expect(isModelAlias("claude-haiku-4-5")).toBe(true);
    expect(isModelAlias("claude-sonnet-4-6")).toBe(true);
    expect(isModelAlias("claude-opus-4-6")).toBe(true);
  });

  it("returns false for dated model IDs", () => {
    expect(isModelAlias("claude-haiku-4-5-20251001")).toBe(false);
    expect(isModelAlias("claude-sonnet-4-6-20250514")).toBe(false);
  });

  it("returns false for non-Claude models", () => {
    expect(isModelAlias("gpt-4")).toBe(false);
  });
});
