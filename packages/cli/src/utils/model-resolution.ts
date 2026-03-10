import type { GlobalConfig } from "../config/types.js";

export interface ModelOverrides {
  model?: string;
  tier?: string;
}

/**
 * Resolve the model string for a session.
 * Precedence: --model flag > --tier flag > global config phase mapping.
 */
export function resolveModel(
  globalConfig: GlobalConfig,
  phaseName: string,
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

  const phase = globalConfig.phases[phaseName];
  const tierName = typeof phase === "string" ? phase : undefined;
  const tierConfig = tierName
    ? globalConfig.tiers[tierName]
    : typeof phase === "object"
      ? phase
      : undefined;
  return tierConfig?.model;
}
