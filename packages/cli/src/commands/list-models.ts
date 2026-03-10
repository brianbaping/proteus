import { Command } from "commander";
import { readGlobalConfig } from "../config/global.js";
import { BOLD, RESET, DIM } from "../utils/ansi.js";
import { resolveApiKey } from "../utils/api-key.js";
import { fetchAvailableModels } from "../utils/models-api.js";

export const listModelsCommand = new Command("list-models")
  .description("Show configured model tiers and phase assignments")
  .option("--available", "Fetch and display available models from the Anthropic API")
  .action(async (options: { available?: boolean }) => {
    const config = await readGlobalConfig();
    if (!config) {
      console.error("Global config not found. Run `proteus-forge setup` first.");
      process.exit(1);
    }

    console.log(`\n${BOLD}Tiers${RESET}\n`);
    for (const [name, tier] of Object.entries(config.tiers)) {
      console.log(
        `  ${name.padEnd(12)} ${tier.model} ${DIM}(${tier.provider})${RESET}`
      );
    }

    console.log(`\n${BOLD}Phase Assignments${RESET}\n`);
    for (const [phase, mapping] of Object.entries(config.phases)) {
      const display =
        typeof mapping === "string"
          ? `→ ${mapping} → ${config.tiers[mapping]?.model ?? "?"}`
          : `→ ${mapping.model} ${DIM}(direct)${RESET}`;
      console.log(`  ${phase.padEnd(22)} ${display}`);
    }
    console.log();

    if (options.available) {
      const apiKey = await resolveApiKey();
      if (!apiKey) {
        console.error("No API key configured. Set providers.anthropic.apiKey in config or ANTHROPIC_API_KEY env var.");
        process.exit(1);
      }

      try {
        const models = await fetchAvailableModels(apiKey);

        console.log(`${BOLD}Available Models (from API)${RESET}\n`);
        for (const m of models) {
          const date = m.createdAt.split("T")[0];
          console.log(
            `  ${m.id.padEnd(30)} ${m.displayName.padEnd(25)} ${DIM}${date}${RESET}`
          );
        }
        console.log(`\nTo update tiers: ${BOLD}proteus-forge config refresh-models${RESET}\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to fetch models: ${msg}`);
        process.exit(1);
      }
    }
  });
