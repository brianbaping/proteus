export interface AnthropicModel {
  id: string;
  displayName: string;
  createdAt: string;
}

interface ApiModel {
  id: string;
  display_name: string;
  created_at: string;
  type: string;
}

interface ApiListResponse {
  data: ApiModel[];
  has_more: boolean;
  last_id: string | null;
}

/**
 * Fetch all available models from the Anthropic API.
 * Paginates automatically. Returns models sorted newest first (API default).
 */
export async function fetchAvailableModels(
  apiKey: string
): Promise<AnthropicModel[]> {
  const models: AnthropicModel[] = [];
  let afterId: string | undefined;

  while (true) {
    const url = new URL("https://api.anthropic.com/v1/models");
    url.searchParams.set("limit", "1000");
    if (afterId) {
      url.searchParams.set("after_id", afterId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication failed: invalid API key");
      }
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText}`
      );
    }

    const body = (await response.json()) as ApiListResponse;

    for (const m of body.data) {
      models.push({
        id: m.id,
        displayName: m.display_name,
        createdAt: m.created_at,
      });
    }

    if (!body.has_more || !body.last_id) break;
    afterId = body.last_id;
  }

  return models;
}

/**
 * Extract the model family (e.g., "haiku", "sonnet", "opus") from a Claude model ID.
 * Returns undefined for unrecognized formats.
 */
export function extractModelFamily(modelId: string): string | undefined {
  const match = modelId.match(/^claude-(\w+)-\d/);
  return match?.[1];
}

/**
 * Check if a model ID is an alias (no date suffix like -YYYYMMDD).
 * Aliases follow the pattern: claude-{family}-{major}-{minor}
 */
export function isModelAlias(modelId: string): boolean {
  return /^claude-\w+-\d+-\d+$/.test(modelId);
}
