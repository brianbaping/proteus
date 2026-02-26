import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { hasStyleGuide } from "../utils/style-context.js";

interface Track {
  id: string;
  discipline: string;
  taskCount: number;
  file: string;
}

interface TrackDetail {
  trackId: string;
  discipline: string;
  tasks: string[];
  context: {
    targetStack: string;
    services: string[];
    sharedPatterns: string;
    fileOwnershipMap: Record<string, string[]>;
  };
}

interface PlanTask {
  id: string;
  title: string;
  description: string;
  discipline: string;
  dependsOn: string[];
  acceptanceCriteria: string[];
  fileOwnership: string[];
  testingExpectation: string;
  testScope?: string;
}

export interface ExecuteContext {
  tracks: Track[];
  trackDetails: Map<string, TrackDetail>;
  tasks: PlanTask[];
  waveCount: number;
}

/**
 * Read track and plan artifacts to build context for the execute prompt.
 */
export async function loadExecuteContext(
  targetPath: string
): Promise<ExecuteContext> {
  const tracksDir = join(targetPath, ".proteus-forge", "04-tracks");
  const planPath = join(targetPath, ".proteus-forge", "03-plan", "plan.json");

  // Read manifest
  const manifest = JSON.parse(
    await readFile(join(tracksDir, "manifest.json"), "utf-8")
  );
  const tracks: Track[] = manifest.tracks ?? [];

  // Read each track detail
  const trackDetails = new Map<string, TrackDetail>();
  for (const track of tracks) {
    const trackPath = join(targetPath, ".proteus-forge", track.file);
    if (existsSync(trackPath)) {
      const detail = JSON.parse(
        await readFile(trackPath, "utf-8")
      ) as TrackDetail;
      trackDetails.set(track.id, detail);
    }
  }

  // Read plan
  const plan = JSON.parse(await readFile(planPath, "utf-8"));
  const tasks: PlanTask[] = plan.tasks ?? [];
  const waveCount: number = plan.executionWaves?.length ?? 0;

  return { tracks, trackDetails, tasks, waveCount };
}

/**
 * Generates the Lead (orchestrator) prompt for the execute stage.
 */
export function generateExecuteLeadPrompt(
  sourcePath: string,
  targetPath: string,
  ctx: ExecuteContext
): string {
  const styleGuideExists = hasStyleGuide(targetPath);

  // Build task summary for the prompt
  const taskSummary = ctx.tasks
    .map(
      (t) =>
        `  ${t.id}: "${t.title}" [${t.discipline}] depends on: [${t.dependsOn.join(", ")}]`
    )
    .join("\n");

  // Build teammate definitions
  const teammateBlocks = ctx.tracks
    .filter((t) => t.discipline !== "shared")
    .map((track) => {
      const detail = ctx.trackDetails.get(track.id);
      const taskIds = detail?.tasks ?? [];
      const context = detail?.context;
      const fileMap = context?.fileOwnershipMap
        ? Object.entries(context.fileOwnershipMap)
            .map(([tid, files]) => `    ${tid}: ${files.join(", ")}`)
            .join("\n")
        : "    (see track file)";

      return `
### ${track.id} — ${track.discipline} engineer
Tasks: ${taskIds.join(", ")} (${track.taskCount} tasks)
Stack: ${context?.targetStack ?? "see design"}
Services: ${context?.services?.join(", ") ?? "n/a"}
Patterns: ${context?.sharedPatterns ?? "n/a"}
File ownership:
${fileMap}`;
    })
    .join("\n");

  // Handle shared track separately
  const sharedTrack = ctx.trackDetails.get("track-shared");
  const sharedBlock = sharedTrack
    ? `
### track-shared — managed by Lead
Tasks: ${sharedTrack.tasks.join(", ")}
These tasks are handled directly by you (the Lead), not by teammates.
File ownership:
${Object.entries(sharedTrack.context?.fileOwnershipMap ?? {})
  .map(([tid, files]) => `    ${tid}: ${files.join(", ")}`)
  .join("\n")}
`
    : "";

  const styleContextLine = styleGuideExists
    ? `\n4. ${targetPath}/.proteus-forge/02-style/style-guide.json — visual identity (colors, typography, spacing, layout patterns)`
    : "";

  const styleSpawnInstruction = styleGuideExists
    ? `\n8. For frontend engineers: the style guide at ${targetPath}/.proteus-forge/02-style/style-guide.json is **visual and structural acceptance criteria** — the production UI must preserve the visual identity and screen layouts documented there. Use the exact color palette, typography scale, spacing values, and layout patterns. Reproduce the screen compositions from the \`screens\` array — place components in the same regions and arrangement as the POC. Do not invent new styles or rearrange screen layouts.`
    : "";

  return `You are the Orchestrator for a Proteus Forge execute stage. Your job is to coordinate a team of engineers to build production code based on the plan.

## Context

Source POC (read-only reference): ${sourcePath}
Target repo (build here): ${targetPath}

Architecture design: ${targetPath}/.proteus-forge/02-design/design.md
Plan: ${targetPath}/.proteus-forge/03-plan/plan.json
Tracks: ${targetPath}/.proteus-forge/04-tracks/

## All Tasks (${ctx.tasks.length} tasks across ${ctx.waveCount} waves)

${taskSummary}

## Instructions

### Step 1: Read Context

Read these files to understand the full picture:
1. ${targetPath}/.proteus-forge/02-design/design.md — the architecture
2. ${targetPath}/.proteus-forge/03-plan/plan.json — every task with acceptance criteria
3. Each track file in ${targetPath}/.proteus-forge/04-tracks/ — per-discipline context${styleContextLine}

Also have the source POC at ${sourcePath} available as reference for understanding the original implementation intent. Do NOT copy POC code — reimplement according to the design.

### Step 2: Handle Shared Tasks

Complete the shared-discipline tasks yourself (the Lead) before spawning teammates:
${sharedBlock}

These are foundation tasks (scaffolding, shared types) that must exist before any track engineer can work.

### Step 3: Create Agent Team

Create an agent team. Spawn one teammate per non-shared track:
${teammateBlocks}

Each teammate's spawn prompt should include:
1. Their role (e.g., "You are a backend engineer building production code")
2. The design document path to read for architecture context
3. Their specific tasks from plan.json with full descriptions and acceptance criteria
4. Their file ownership — they must NOT modify files outside their ownership
5. That the source POC at ${sourcePath} is read-only reference (do not copy code)
6. Testing expectations: if testingExpectation is "unit", write unit tests alongside code
7. To mark tasks complete on the shared task list when done
8. Before marking a task complete: run \`npx tsc --noEmit\` in the target repo to catch type errors, and run any unit tests for their owned files. Fix all errors before marking done${styleSpawnInstruction}

### Step 4: Create Tasks on Shared Task List

Create every task from the plan on the shared task list WITH their dependency chains. Agent Teams will auto-unblock tasks as dependencies complete.

Tasks that you (the Lead) already completed in Step 2 should be created as already completed.

### Step 5: Monitor and Coordinate

- Wait for teammates to complete their tasks
- If a teammate needs information about another track's output, relay it
- If a teammate fails a task, check the error and provide guidance
- Track-shared files that teammates need to modify should go through you

### Step 6: Finalize

After all tasks are complete:
1. Verify key files exist (package.json, tsconfig.json, main entry points)
2. **Run CI verification in the target repo** (MANDATORY before writing session.json):
   a. Detect the package manager from lockfiles (bun.lockb → pnpm-lock.yaml → yarn.lock → package-lock.json → default npm)
   b. Run \`<pm> install\` — must install cleanly with no errors
   c. For each script that exists in package.json, run: \`<pm> run build\`, \`<pm> run test\`, \`<pm> run lint\`
   d. If ANY check fails: diagnose the root cause, fix the code (yourself or delegate to the appropriate engineer), then re-run until all checks pass
   e. Only proceed to step 3 after ALL checks pass
3. Write a session summary to TWO files:
   - **${targetPath}/.proteus-forge/05-execute/session.json** — Machine-readable metadata
   - **${targetPath}/.proteus-forge/05-execute/execute.md** — Human-readable summary

The session.json schema:
\`\`\`json
{
  "forgeVersion": "1.0.0",
  "stage": "execute",
  "sessionId": "<your session ID>",
  "startedAt": "<ISO timestamp>",
  "completedAt": "<ISO timestamp>",
  "status": "completed",
  "progress": {
    "totalTasks": ${ctx.tasks.length},
    "completed": ${ctx.tasks.length},
    "failed": 0
  },
  "verification": {
    "packageManager": "<detected pm>",
    "install": "passed|failed|skipped",
    "build": "passed|failed|skipped",
    "test": "passed|failed|skipped",
    "lint": "passed|failed|skipped"
  }
}
\`\`\`

The execute.md should be a human-readable narrative covering:
- **What Was Built**: Overview of the production application
- **Architecture**: Services, components, and how they connect
- **Per-Track Summary**: What each teammate built, key files created
- **Testing**: What tests were written and coverage approach
- **Known Gaps**: Anything not completed or deferred
- **How to Run**: Commands to install, build, and start the application

This document is intended for human review — write it in clear prose, not JSON.

## Important

- The source at ${sourcePath} is READ-ONLY. Never modify it. Reimplement, don't copy.
- Each teammate owns specific files — enforce ownership boundaries.
- Teammates should write unit tests for tasks with testingExpectation "unit".
- Create ${targetPath}/.proteus-forge/05-execute/ directory before writing session.json.
- If you complete shared tasks first, ensure the scaffolding is committed/written before spawning teammates so they can build on it.
`;
}
