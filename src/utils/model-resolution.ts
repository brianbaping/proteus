import type { GlobalConfig } from "../config/types.js";

export interface ModelOverrides {
  model?: string;
  tier?: string;
}

/**
 * Resolve the model string for a session.
 * Precedence: --model flag > --tier flag > global config role mapping.
 */
export function resolveModel(
  globalConfig: GlobalConfig,
  roleName: string,
  overrides: ModelOverrides = {}
): string | undefined {
  if (overrides.model) return overrides.model;

  if (overrides.tier) {
    const tierConfig = globalConfig.tiers[overrides.tier];
    if (!tierConfig) {
      throw new Error(
        `Unknown tier "${overrides.tier}". Available: ${Object.keys(globalConfig.tiers).join(", ")}`
      );
    }
    return tierConfig.model;
  }

  const role = globalConfig.roles[roleName];
  const tierName = typeof role === "string" ? role : undefined;
  const tierConfig = tierName
    ? globalConfig.tiers[tierName]
    : typeof role === "object"
      ? role
      : undefined;
  return tierConfig?.model;
}
