import { readGlobalConfig } from "../config/global.js";

/**
 * Resolve the Anthropic API key from config or environment.
 * Config values starting with "$" are treated as env var references.
 */
export async function resolveApiKey(): Promise<string | undefined> {
  const config = await readGlobalConfig();
  const apiKey = config?.providers?.anthropic?.apiKey;
  if (!apiKey) return process.env.ANTHROPIC_API_KEY;
  if (apiKey.startsWith("$")) return process.env[apiKey.slice(1)];
  return apiKey;
}
