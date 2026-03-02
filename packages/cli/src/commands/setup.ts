import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import {
  readClaudeSettings,
  isAgentTeamsEnabled,
  enableAgentTeams,
} from "../utils/claude-settings.js";
import {
  globalConfigExists,
  readGlobalConfig,
  writeGlobalConfig,
  getDefaultGlobalConfig,
  ensureForgeDir,
} from "../config/global.js";
import { readRegistry, writeRegistry } from "../config/registry.js";

async function promptForApiKey(): Promise<string | null> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("");
    console.log("      Proteus Forge needs an Anthropic API key to launch agent sessions.");
    console.log("      This is separate from Claude Code's internal auth.");
    console.log("      Get your key at: https://console.anthropic.com/settings/keys");
    console.log("");
    const key = await rl.question("      Enter your Anthropic API key (or press Enter to skip): ");
    return key.trim() || null;
  } finally {
    rl.close();
  }
}

export const setupCommand = new Command("setup")
  .description("One-time configuration: enable Agent Teams, configure providers, set tier defaults")
  .action(async () => {
    console.log("Setting up Proteus Forge...\n");

    // Check Claude Code
    console.log("  Checking prerequisites...");
    try {
      const settings = await readClaudeSettings();
      console.log("    \u2713 Claude Code detected");

      // Enable Agent Teams
      if (isAgentTeamsEnabled(settings)) {
        console.log("    \u2713 Agent Teams already enabled");
      } else {
        await enableAgentTeams();
        console.log("    \u2713 Agent Teams enabled (updated ~/.claude/settings.json)");
      }
    } catch {
      console.error("    \u2717 Could not read Claude Code settings.");
      console.error("      Ensure Claude Code is installed and ~/.claude/settings.json exists.");
      process.exit(1);
    }

    // Write global config (before API key check so we can store the key)
    await ensureForgeDir();
    if (globalConfigExists()) {
      console.log("\n  \u2713 Global config already exists (~/.proteus-forge/config.json)");
    } else {
      await writeGlobalConfig(getDefaultGlobalConfig());
      console.log("\n  \u2713 Created ~/.proteus-forge/config.json with default tiers:");
      console.log("      fast     \u2192 claude-haiku-4-5");
      console.log("      standard \u2192 claude-sonnet-4-6");
      console.log("      advanced \u2192 claude-opus-4-6");
    }

    // Check API key — stored in config or environment
    const config = (await readGlobalConfig())!;
    const storedKey = config.providers?.anthropic?.apiKey;
    const hasStoredKey = storedKey && !storedKey.startsWith("$");
    const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;

    if (hasStoredKey) {
      console.log("  \u2713 API key configured in ~/.proteus-forge/config.json");
    } else if (hasEnvKey) {
      console.log("  \u2713 Found ANTHROPIC_API_KEY in environment");
    } else {
      console.log("  \u26a0 No API key found.");
      const key = await promptForApiKey();
      if (key) {
        config.providers.anthropic.apiKey = key;
        await writeGlobalConfig(config);
        console.log("    \u2713 API key saved to ~/.proteus-forge/config.json");
      } else {
        console.log("    Skipped. You can add it later:");
        console.log('    proteus-forge config set providers.anthropic.apiKey "sk-ant-..."');
      }
    }

    // Ensure registry exists
    const registry = await readRegistry();
    if (Object.keys(registry.projects).length === 0) {
      await writeRegistry(registry);
    }

    console.log("\nSetup complete. Run `proteus-forge new <name> --source <path>` to create a project.");
  });
