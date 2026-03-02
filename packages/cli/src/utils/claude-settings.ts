import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

interface ClaudeSettings {
  [key: string]: unknown;
  env?: Record<string, string>;
}

export async function readClaudeSettings(): Promise<ClaudeSettings> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return {};
  }
  const content = await readFile(CLAUDE_SETTINGS_PATH, "utf-8");
  return JSON.parse(content) as ClaudeSettings;
}

async function writeClaudeSettings(settings: ClaudeSettings): Promise<void> {
  await writeFile(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2) + "\n"
  );
}

export function isAgentTeamsEnabled(settings: ClaudeSettings): boolean {
  return settings.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === "1";
}

export async function enableAgentTeams(): Promise<void> {
  const settings = await readClaudeSettings();
  if (!settings.env) {
    settings.env = {};
  }
  settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";
  await writeClaudeSettings(settings);
}
