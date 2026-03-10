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
    phases: {
      inspect: "fast",
      style: "standard",
      design: "advanced",
      plan: "standard",
      split: "standard",
      execute: "advanced",
    },
  };
}

export async function readGlobalConfig(): Promise<GlobalConfig | null> {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }
  const content = await readFile(CONFIG_PATH, "utf-8");
  const raw = JSON.parse(content) as GlobalConfig & { roles?: Record<string, unknown> };

  // Migrate legacy "roles" key → "phases"
  if (!raw.phases && raw.roles) {
    const ROLE_TO_PHASE: Record<string, string> = {
      scout: "inspect",
      "build-team": "inspect",
      "inspect-specialist": "inspect",
      synthesizer: "inspect",
      "style-lead": "style",
      "design-specialist": "design",
      "plan-generator": "plan",
      "execute-agent": "execute",
      "qa-agent": "execute",
      "verify-fix": "execute",
    };
    const phases: Record<string, unknown> = {};
    for (const [role, mapping] of Object.entries(raw.roles)) {
      const phase = ROLE_TO_PHASE[role];
      if (phase && !phases[phase]) {
        phases[phase] = mapping;
      }
    }
    // Ensure all 6 phases exist with defaults
    const defaults = getDefaultGlobalConfig().phases;
    for (const [phase, tier] of Object.entries(defaults)) {
      if (!phases[phase]) phases[phase] = tier;
    }
    raw.phases = phases as GlobalConfig["phases"];
    delete raw.roles;
  }

  return raw as GlobalConfig;
}

export async function writeGlobalConfig(config: GlobalConfig): Promise<void> {
  await ensureForgeDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export function globalConfigExists(): boolean {
  return existsSync(CONFIG_PATH);
}
