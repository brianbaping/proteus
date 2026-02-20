import { Command } from "commander";
import {
  readGlobalConfig,
  writeGlobalConfig,
  getDefaultGlobalConfig,
} from "../config/global.js";

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

export const configCommand = new Command("config")
  .description("Get or set Proteus Forge configuration values")
  .addCommand(getSubcommand)
  .addCommand(setSubcommand);
