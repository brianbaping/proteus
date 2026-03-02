import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { detectPackageManager, type PackageManager } from "./verify.js";

export interface ScaffoldResult {
  files: string[];
  claudeMdUpdated: boolean;
}

interface CommandTemplate {
  filename: string;
  description: string;
  body: (pm: PackageManager) => string;
}

const CLAUDE_MD_SENTINEL = "## Repair Commands";

function fixBuildTemplate(pm: PackageManager): string {
  return `---
description: Fix build and typecheck errors
---

Fix build/typecheck errors in this project.

## Context

Read these project artifacts for architecture context:
- \`.proteus-forge/02-design/design.md\` — system design
- \`.proteus-forge/03-plan/plan.md\` — implementation plan

## Steps

1. Run \`${pm} run build\` and capture the full error output
2. Read each file referenced in the errors
3. Fix the root cause of each error — do not suppress or work around type errors
4. Re-run \`${pm} run build\` to confirm the fix
5. Repeat until the build passes cleanly

## Focus

$ARGUMENTS

## Constraints

- Do not add \`any\` type casts or \`@ts-ignore\` comments
- Do not change the project's tsconfig or build configuration
- Do not alter the architecture or public API surface
- Keep fixes minimal — change only what is needed to resolve the error
`;
}

function fixTestsTemplate(pm: PackageManager): string {
  return `---
description: Fix failing tests
---

Fix failing tests in this project.

## Context

Read these project artifacts for architecture context:
- \`.proteus-forge/02-design/design.md\` — system design
- \`.proteus-forge/03-plan/plan.md\` — implementation plan

## Steps

1. Run \`${pm} run test\` and capture the full error output
2. For each failing test, determine whether the bug is in the source code or the test
3. If the source code is wrong, fix the source code
4. If the test has an incorrect expectation due to a valid implementation change, update the test
5. Re-run \`${pm} run test\` to confirm all tests pass
6. Repeat until all tests pass

## Focus

$ARGUMENTS

## Constraints

- Do not delete or skip failing tests
- Do not weaken assertions (e.g., replacing exact matches with loose matchers)
- Do not change the architecture or public API surface
- Prefer fixing source code over modifying tests
- Keep fixes minimal — change only what is needed to make tests pass
`;
}

function fixLintTemplate(pm: PackageManager): string {
  return `---
description: Fix lint errors
---

Fix lint errors in this project.

## Context

Read these project artifacts for architecture context:
- \`.proteus-forge/02-design/design.md\` — system design
- \`.proteus-forge/03-plan/plan.md\` — implementation plan

## Steps

1. Run \`${pm} run lint\` and capture the full error output
2. Read each file referenced in the errors
3. Fix the code to satisfy the lint rule — do not disable the rule
4. Re-run \`${pm} run lint\` to confirm the fix
5. Repeat until lint passes cleanly

## Focus

$ARGUMENTS

## Constraints

- Do not add eslint-disable comments or inline suppressions
- Do not modify eslint configuration or rules
- Do not add \`any\` type casts to satisfy lint rules
- Do not change the architecture or public API surface
- Keep fixes minimal — change only what is needed to resolve the lint error
`;
}

function fixAllTemplate(pm: PackageManager): string {
  return `---
description: Full verify and fix cycle (build, test, lint)
---

Run full verification and fix all errors in this project.

## Context

Read these project artifacts for architecture context:
- \`.proteus-forge/02-design/design.md\` — system design
- \`.proteus-forge/03-plan/plan.md\` — implementation plan

## Steps

1. **Build**: Run \`${pm} run build\`. If it fails, fix all build/typecheck errors before proceeding.
2. **Test**: Run \`${pm} run test\`. If tests fail, fix source code or tests as appropriate.
3. **Lint**: Run \`${pm} run lint\`. If lint fails, fix the code to satisfy the rules.
4. **Final check**: Run all three again (\`${pm} run build && ${pm} run test && ${pm} run lint\`) to confirm everything passes.

## Focus

$ARGUMENTS

## Constraints

- Do not add \`any\` type casts, \`@ts-ignore\`, or \`eslint-disable\` comments
- Do not delete or skip tests, or weaken assertions
- Do not modify build config, tsconfig, or lint rules
- Do not change the architecture or public API surface
- Prefer fixing source code over modifying tests
- Keep fixes minimal — change only what is needed to resolve each error
`;
}

const COMMAND_TEMPLATES: CommandTemplate[] = [
  { filename: "fix-build.md", description: "Fix build/typecheck errors", body: fixBuildTemplate },
  { filename: "fix-tests.md", description: "Fix failing tests", body: fixTestsTemplate },
  { filename: "fix-lint.md", description: "Fix lint errors", body: fixLintTemplate },
  { filename: "fix-all.md", description: "Full verify and fix cycle", body: fixAllTemplate },
];

function buildClaudeMdSection(): string {
  return `
${CLAUDE_MD_SENTINEL}

These slash commands are available for fixing issues found by \`proteus-forge verify\`:

- \`/fix-build\` — Fix build and typecheck errors
- \`/fix-tests\` — Fix failing tests
- \`/fix-lint\` — Fix lint errors
- \`/fix-all\` — Full verify + fix cycle (build → test → lint)

Each command accepts an optional argument to focus on a specific file or error.
`;
}

export async function scaffoldClaudeCommands(
  targetPath: string,
  options?: { packageManager?: PackageManager }
): Promise<ScaffoldResult> {
  const pm = options?.packageManager ?? detectPackageManager(targetPath);
  const commandsDir = join(targetPath, ".claude", "commands");
  await mkdir(commandsDir, { recursive: true });

  const files: string[] = [];
  for (const template of COMMAND_TEMPLATES) {
    const filePath = join(commandsDir, template.filename);
    await writeFile(filePath, template.body(pm));
    files.push(filePath);
  }

  let claudeMdUpdated = false;
  const claudeMdPath = join(targetPath, "CLAUDE.md");
  if (existsSync(claudeMdPath)) {
    const content = await readFile(claudeMdPath, "utf-8");
    if (!content.includes(CLAUDE_MD_SENTINEL)) {
      await writeFile(claudeMdPath, content + buildClaudeMdSection());
      claudeMdUpdated = true;
    }
  }

  return { files, claudeMdUpdated };
}
