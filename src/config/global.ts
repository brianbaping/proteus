import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { GlobalConfig } from "./types.js";

const FORGE_DIR = join(homedir(), ".proteus-forge");
const CONFIG_PATH = join(FORGE_DIR, "config.json");

export function getForgeDir(): string {
  return FORGE_DIR;
}

export function getGlobalConfigPath(): string {
  return CONFIG_PATH;
}

export async function ensureForgeDir(): Promise<void> {
  if (!existsSync(FORGE_DIR)) {
    await mkdir(FORGE_DIR, { recursive: true });
  }
}

export function getDefaultGlobalConfig(): GlobalConfig {
  return {
    forgeVersion: "1.0.0",
    providers: {
      anthropic: {
        type: "anthropic",
        apiKey: "$ANTHROPIC_API_KEY",
      },
    },
    tiers: {
      fast: { provider: "anthropic", model: "claude-haiku-4-5" },
      standard: { provider: "anthropic", model: "claude-sonnet-4-6" },
      advanced: { provider: "anthropic", model: "claude-opus-4-6" },
    },
    roles: {
      scout: "fast",
      "build-team": "fast",
      "inspect-specialist": "standard",
      synthesizer: "standard",
      "design-specialist": "advanced",
      "plan-generator": "standard",
      "execute-agent": "advanced",
      "qa-agent": "standard",
    },
  };
}

export async function readGlobalConfig(): Promise<GlobalConfig | null> {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }
  const content = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(content) as GlobalConfig;
}

export async function writeGlobalConfig(config: GlobalConfig): Promise<void> {
  await ensureForgeDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export function globalConfigExists(): boolean {
  return existsSync(CONFIG_PATH);
}
