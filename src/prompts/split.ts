/**
 * Generates the Lead prompt for the split stage.
 * Single agent, no teammates — reads the plan and partitions tasks into discipline tracks.
 */
export function generateSplitLeadPrompt(
  targetPath: string
): string {
  return `You are the Lead for a Proteus split stage. Your job is to read the task plan and partition tasks into discipline-specific tracks with file ownership boundaries.

## Context

You are working in: ${targetPath}

The task plan is at:
  ${targetPath}/.proteus/03-plan/plan.json
  ${targetPath}/.proteus/03-plan/plan.md

The design is at:
  ${targetPath}/.proteus/02-design/design-meta.json

## Instructions

### Step 1: Read the Plan

Read ${targetPath}/.proteus/03-plan/plan.json thoroughly. Understand every task's discipline, file ownership, and dependencies.

Also read ${targetPath}/.proteus/02-design/design-meta.json for the service definitions.

### Step 2: Group Tasks by Discipline

Partition tasks into tracks based on their \`discipline\` field:
- **track-backend** — tasks with discipline "backend"
- **track-frontend** — tasks with discipline "frontend"
- **track-data** — tasks with discipline "data"
- **track-devops** — tasks with discipline "devops"
- **track-qa** — tasks with discipline "qa"
- **track-shared** — tasks with discipline "shared", plus any cross-cutting files

If a discipline has no tasks, omit that track.

### Step 3: Build File Ownership Maps

For each track, compile the complete file ownership map from all tasks in that track. Verify:
- No file or directory appears in more than one track (except track-shared)
- Files in track-shared do not appear in any other track
- Every task from plan.json is assigned to exactly one track

### Step 4: Determine Track Dependencies

A track depends on another track if any of its tasks depend on tasks in the other track. For example, if track-backend has task-008 which depends on task-004 (in track-data), then track-backend depends on track-data.

### Step 5: Build Context for Each Track

For each track, compile context that an execution agent would need:
- Target stack relevant to this discipline
- Services this track implements
- Shared patterns or conventions to follow
- The file ownership map (task → files)

### Step 6: Write Outputs

Create the directory ${targetPath}/.proteus/04-tracks/ and write:

**manifest.json** — Track list and dependencies:
\`\`\`json
{
  "proteusVersion": "1.0.0",
  "stage": "split",
  "generatedAt": "<ISO timestamp>",
  "tracks": [
    {
      "id": "track-<discipline>",
      "discipline": "<discipline>",
      "taskCount": <number>,
      "file": "04-tracks/<discipline>.json",
      "dependsOnTracks": ["<track-IDs this track depends on>"],
      "requiredByTracks": ["<track-IDs that depend on this track>"]
    }
  ]
}
\`\`\`

**Individual track files** (e.g., backend.json):
\`\`\`json
{
  "trackId": "track-<discipline>",
  "discipline": "<discipline>",
  "tasks": ["<task-IDs in this track>"],
  "context": {
    "targetStack": "<relevant stack for this discipline>",
    "services": ["<svc-IDs this track implements>"],
    "sharedPatterns": "<conventions and patterns to follow>",
    "fileOwnershipMap": {
      "<task-ID>": ["<files/directories owned by this task>"]
    }
  }
}
\`\`\`

**shared.json** — Cross-cutting files:
\`\`\`json
{
  "trackId": "track-shared",
  "discipline": "shared",
  "tasks": ["<task-IDs with discipline 'shared'>"],
  "ownedFiles": ["<cross-cutting files: tsconfig, package.json, shared types, etc>"],
  "managedBy": "lead",
  "context": {
    "targetStack": "<relevant stack>",
    "services": [],
    "sharedPatterns": "<conventions>",
    "fileOwnershipMap": {
      "<task-ID>": ["<files>"]
    }
  }
}
\`\`\`

## Important

- Every task from plan.json must appear in exactly one track.
- No file ownership overlap between tracks (except track-shared which is exclusive).
- Track dependency graph must be a DAG (no circular dependencies between tracks).
- Create the directory ${targetPath}/.proteus/04-tracks/ before writing.
`;
}
