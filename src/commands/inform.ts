import { Command } from "commander";
import { resolveProject } from "../utils/resolve-project.js";
import { writeInboxMessage, isInboxActive } from "../utils/inbox.js";

export const informCommand = new Command("inform")
  .description("Send a message to a running agent during execute")
  .argument("<agent>", "Agent name (e.g., backend-engineer, frontend-engineer)")
  .argument("<message>", "Message to relay to the agent")
  .option("--project <name>", "Project name (uses active project if omitted)")
  .action(
    async (
      agent: string,
      message: string,
      options: { project?: string }
    ) => {
      let project;
      try {
        project = await resolveProject(options.project);
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }

      const targetPath = project.entry.target;

      // Check if an execute session is active
      if (!isInboxActive(targetPath)) {
        console.error(
          "No active execute session found. `proteus-forge inform` only works while `proteus-forge execute` is running."
        );
        process.exit(1);
      }

      await writeInboxMessage(targetPath, agent, message);

      console.log(`\n[${project.name}] Message queued for "${agent}"\n`);
      console.log(`  To: ${agent}`);
      console.log(`  Message: ${message}`);
      console.log(`\n  The Lead will relay this to the teammate on its next turn.\n`);
    }
  );
