import { Command } from "commander";
import { readGlobalConfig } from "../config/global.js";
import { BOLD, RESET, DIM } from "../utils/ansi.js";

export const listModelsCommand = new Command("list-models")
  .description("Show configured model tiers and role assignments")
  .action(async () => {
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

    console.log(`\n${BOLD}Role Assignments${RESET}\n`);
    for (const [role, mapping] of Object.entries(config.roles)) {
      const display =
        typeof mapping === "string"
          ? `→ ${mapping} → ${config.tiers[mapping]?.model ?? "?"}`
          : `→ ${mapping.model} ${DIM}(direct)${RESET}`;
      console.log(`  ${role.padEnd(22)} ${display}`);
    }
    console.log();
  });
