import { Command } from "commander";
import {
  readGlobalConfig,
  writeGlobalConfig,
  getDefaultGlobalConfig,
} from "../config/global.js";
import { BOLD, RESET, DIM } from "../utils/ansi.js";
import { resolveApiKey } from "../utils/api-key.js";
import {
  fetchAvailableModels,
  extractModelFamily,
  isModelAlias,
} from "../utils/models-api.js";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

const getSubcommand = new Command("get")
  .description("Get a config value")
  .argument("<key>", "Dot-notation config key (e.g., tiers.fast.model)")
  .action(async (key: string) => {
    const config = (await readGlobalConfig()) ?? getDefaultGlobalConfig();
    const value = getNestedValue(config as unknown as Record<string, unknown>, key);
    if (value === undefined) {
      console.error(`Key "${key}" not found.`);
      process.exit(1);
    }
    if (typeof value === "object") {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(String(value));
    }
  });

const setSubcommand = new Command("set")
  .description("Set a config value")
  .argument("<key>", "Dot-notation config key")
  .argument("<value>", "Value to set")
  .action(async (key: string, value: string) => {
    const config = (await readGlobalConfig()) ?? getDefaultGlobalConfig();
    const configObj = config as unknown as Record<string, unknown>;

    // Try to parse as JSON, fall back to string
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }

    setNestedValue(configObj, key, parsed);
    await writeGlobalConfig(config);
    console.log(`Set ${key} = ${typeof parsed === "object" ? JSON.stringify(parsed) : parsed}`);
  });

const refreshModelsSubcommand = new Command("refresh-models")
  .description("Fetch latest models from Anthropic API and update tier assignments")
  .action(async () => {
    const config = (await readGlobalConfig()) ?? getDefaultGlobalConfig();

    const apiKey = await resolveApiKey();
    if (!apiKey) {
      console.error(
        "No API key configured. Set providers.anthropic.apiKey in config or ANTHROPIC_API_KEY env var."
      );
      process.exit(1);
    }

    console.log("\nFetching models from Anthropic API...\n");

    let models;
    try {
      models = await fetchAvailableModels(apiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to fetch models: ${msg}`);
      process.exit(1);
    }

    // Filter to alias-style models only (no date suffixes)
    const aliases = models.filter((m) => isModelAlias(m.id));

    let anyUpdated = false;

    for (const [tierName, tierConfig] of Object.entries(config.tiers)) {
      const currentFamily = extractModelFamily(tierConfig.model);
      if (!currentFamily) {
        console.log(
          `  ${tierName.padEnd(12)} ${tierConfig.model} ${DIM}(unknown family, skipped)${RESET}`
        );
        continue;
      }

      // Find the newest alias in the same family (first match — API returns newest first)
      const newest = aliases.find(
        (m) => extractModelFamily(m.id) === currentFamily
      );

      if (!newest || newest.id === tierConfig.model) {
        console.log(
          `  ${tierName.padEnd(12)} ${tierConfig.model} ${DIM}(current)${RESET}`
        );
        continue;
      }

      console.log(
        `  ${tierName.padEnd(12)} ${tierConfig.model} → ${BOLD}${newest.id}${RESET} ${DIM}(updated)${RESET}`
      );
      tierConfig.model = newest.id;
      anyUpdated = true;
    }

    if (anyUpdated) {
      await writeGlobalConfig(config);
      console.log(`\n${BOLD}Config updated.${RESET}\n`);
    } else {
      console.log("\nAll tiers are up to date.\n");
    }
  });

export const configCommand = new Command("config")
  .description("Get or set Proteus Forge configuration values")
  .addCommand(getSubcommand)
  .addCommand(setSubcommand)
  .addCommand(refreshModelsSubcommand);
