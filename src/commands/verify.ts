import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { runVerification, printVerifyResult } from "../utils/verify.js";
import { appendLogEntry } from "../utils/log.js";

export async function runVerify(
  name: string | undefined,
  options: { verbose?: boolean; skipInstall?: boolean }
): Promise<boolean> {
  let project;
  try {
    project = await resolveProject(name);
  } catch (err) {
    console.error((err as Error).message);
    return false;
  }

  const targetPath = project.entry.target;
  const pkgPath = join(targetPath, "package.json");

  if (!existsSync(pkgPath)) {
    console.error(
      `No package.json found in ${targetPath}. Verify requires a Node.js project with a package.json.`
    );
    return false;
  }

  console.log(`\n[${project.name}] Running verification...\n`);
  console.log(`  Target: ${targetPath}`);

  const result = await runVerification(targetPath, {
    skipInstall: options.skipInstall,
    verbose: options.verbose,
  });

  printVerifyResult(result, options.verbose);

  const stepSummary = result.steps
    .map((s) => `${s.name}:${s.skipped ? "skipped" : s.passed ? "passed" : "failed"}`)
    .join(", ");

  await appendLogEntry(targetPath, {
    action: "verify",
    status: result.allPassed ? "success" : "failed",
    details: stepSummary,
  });

  return result.allPassed;
}

export const verifyCommand = new Command("verify")
  .description("Run install/build/test/lint verification on the target repo")
  .argument("[name]", "Project name (uses active project if omitted)")
  .option("--verbose", "Show full output from failed steps")
  .option("--skip-install", "Skip the install step")
  .action(
    async (
      name: string | undefined,
      options: { verbose?: boolean; skipInstall?: boolean }
    ) => {
      const success = await runVerify(name, options);
      if (!success) process.exit(1);
    }
  );
