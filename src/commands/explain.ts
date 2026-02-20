import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { readGlobalConfig } from "../config/global.js";
import { launchSession } from "../session/launcher.js";

export const explainCommand = new Command("explain")
  .description("Explain a design or plan decision by reading artifacts")
  .argument("<question>", "Question to answer (e.g., 'why is auth in wave 1?')")
  .argument("[name]", "Project name (uses active project if omitted)")
  .action(async (question: string, name?: string) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const targetPath = project.entry.target;
    const forgeDir = join(targetPath, ".proteus-forge");

    // Gather available artifacts for context
    const contextFiles: string[] = [];
    const artifactPaths = [
      "01-inspect/features.json",
      "02-design/design.md",
      "02-design/design-meta.json",
      "03-plan/plan.md",
      "03-plan/plan.json",
      "04-tracks/manifest.json",
    ];

    for (const p of artifactPaths) {
      if (existsSync(join(forgeDir, p))) {
        contextFiles.push(p);
      }
    }

    if (contextFiles.length === 0) {
      console.error("No pipeline artifacts found. Run at least `proteus-forge inspect` first.");
      process.exit(1);
    }

    const globalConfig = await readGlobalConfig();
    const planRole = globalConfig?.roles["plan-generator"];
    const planTier = typeof planRole === "string" ? planRole : undefined;
    const tierConfig = planTier ? globalConfig?.tiers[planTier] : undefined;
    const model = tierConfig?.model;

    const prompt = `You are answering a question about a Proteus Forge project's architecture and plan.

Read the following artifact files in ${targetPath}/.proteus-forge/ to understand the project:
${contextFiles.map((f) => `- ${targetPath}/.proteus-forge/${f}`).join("\n")}

Then answer this question concisely and specifically, referencing the artifacts:

${question}

Be direct. Reference specific feature IDs, task IDs, service names, or wave numbers where relevant.`;

    console.log(`\n[${project.name}] Explaining: "${question}"\n`);

    const result = await launchSession({
      prompt,
      cwd: targetPath,
      model,
      permissionMode: "plan",
      onMessage: (message) => {
        if (message.type === "assistant" && "message" in message) {
          const content = message.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if ("text" in block && typeof block.text === "string") {
                process.stdout.write(block.text);
              }
            }
          }
        }
      },
    });

    if (!result.success && result.errors?.length) {
      console.error(`\nError: ${result.errors.join("; ")}`);
    }

    console.log("");
  });
