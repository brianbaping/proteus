import { Command } from "commander";
import {
  readClaudeSettings,
  isAgentTeamsEnabled,
  enableAgentTeams,
} from "../utils/claude-settings.js";
import {
  globalConfigExists,
  writeGlobalConfig,
  getDefaultGlobalConfig,
  ensureForgeDir,
} from "../config/global.js";
import { readRegistry, writeRegistry } from "../config/registry.js";

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

    // Check API keys
    if (process.env.ANTHROPIC_API_KEY) {
      console.log("    \u2713 Found ANTHROPIC_API_KEY in environment");
    } else if (process.env.OPENAI_API_KEY) {
      console.log("    \u2713 Found OPENAI_API_KEY in environment");
    } else {
      console.log("    \u26a0 No API key found in environment.");
      console.log("      Set ANTHROPIC_API_KEY or configure providers via `proteus-forge config`.");
    }

    // Write global config
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

    // Ensure registry exists
    const registry = await readRegistry();
    if (Object.keys(registry.projects).length === 0) {
      await writeRegistry(registry);
    }

    console.log("\nSetup complete. Run `proteus-forge new <name> --source <path>` to create a project.");
  });
