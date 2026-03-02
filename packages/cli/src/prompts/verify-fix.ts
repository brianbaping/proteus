import type { VerifyStep } from "../utils/verify.js";

interface FailedStep {
  name: string;
  command: string;
  args: string[];
  output?: string;
}

const MAX_OUTPUT_LINES = 200;

function truncateOutput(output: string | undefined): string {
  if (!output) return "(no output captured)";
  const lines = output.split("\n");
  if (lines.length <= MAX_OUTPUT_LINES) return output;
  return `... (${lines.length - MAX_OUTPUT_LINES} lines truncated)\n${lines.slice(-MAX_OUTPUT_LINES).join("\n")}`;
}

function extractFailedSteps(steps: VerifyStep[]): FailedStep[] {
  return steps
    .filter((s) => !s.skipped && !s.passed)
    .map((s) => ({
      name: s.name,
      command: s.command,
      args: s.args,
      output: s.output,
    }));
}

/**
 * Generates a prompt for the verify-fix agent session.
 * Lists each failed step with its error output and instructs the agent
 * to make minimal targeted fixes, then self-verify.
 */
export function generateVerifyFixPrompt(
  targetPath: string,
  steps: VerifyStep[],
  packageManager: string
): string {
  const failedSteps = extractFailedSteps(steps);

  const failureDetails = failedSteps
    .map(
      (step) =>
        `### ${step.name}

Command: \`${step.command} ${step.args.join(" ")}\`

\`\`\`
${truncateOutput(step.output)}
\`\`\``
    )
    .join("\n\n");

  return `You are a focused fix agent for a Proteus Forge project. Your job is to diagnose and fix verification failures with minimal, targeted changes.

## Context

You are working in: ${targetPath}
Package manager: ${packageManager}

## Failed Steps

The following verification steps failed:

${failureDetails}

## Instructions

1. Read the error output for each failed step carefully
2. Diagnose the root cause of each failure
3. Make the minimal code changes needed to fix each failure
4. After making fixes, re-run each failing command yourself to verify:
${failedSteps.map((s) => `   - \`${s.command} ${s.args.join(" ")}\``).join("\n")}

## Constraints

- Make minimal, targeted fixes only — do not refactor unrelated code
- Do NOT remove or skip tests to make them pass
- Do NOT weaken or disable lint rules
- Do NOT cast to \`any\` or add type assertions to suppress errors
- Do NOT change the project architecture or directory structure
- Fix the actual underlying issues, not the symptoms
- If a fix requires installing a missing dependency, use \`${packageManager}\` to install it
`;
}
