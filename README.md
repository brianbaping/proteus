# Proteus Forge

Transform proof-of-concept codebases into production-ready applications using coordinated AI agent teams.

Proteus Forge is a CLI tool that orchestrates [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) through a five-stage pipeline: **inspect** the POC, **design** a production architecture, **plan** the implementation tasks, **split** into discipline tracks, and **execute** with parallel agent teams writing production code.

---

## How It Works

```
Source POC (read-only)          Proteus Forge Pipeline                    Production Code
┌──────────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│ src/auth/         │     │ inspect → design → plan  │     │ server/src/auth/     │
│ src/products/     │────>│     → split → execute    │────>│ server/src/products/ │
│ prisma/schema     │     │                          │     │ client/src/features/ │
│ Dockerfile        │     │ Agent Teams do the work  │     │ tests/               │
└──────────────────┘     └──────────────────────────┘     │ Dockerfile           │
                                                           │ .github/workflows/   │
                                                           └──────────────────────┘
```

Proteus Forge never modifies your POC. It analyzes the source as read-only reference and builds the production version in a separate target repository.

### Pipeline Stages

| Stage | Command | Agents | What Happens |
|-------|---------|--------|-------------|
| **Inspect** | `proteus-forge inspect` | Scout + domain specialists | Analyzes the POC, identifies features, data model, integrations, and known issues |
| **Design** | `proteus-forge design` | Architect + design specialists | Produces a production architecture with service definitions and API contracts |
| **Plan** | `proteus-forge plan` | Single Lead | Generates a task DAG with execution waves, dependencies, and acceptance criteria |
| **Split** | `proteus-forge split` | Single Lead | Partitions tasks into discipline tracks (backend, frontend, data, devops, qa) with file ownership |
| **Execute** | `proteus-forge execute` | Orchestrator + track engineers | Parallel agent teams write production code wave by wave |

Each stage produces artifacts in `.proteus-forge/` that feed the next stage. Human-editable files (`design.md`, `plan.md`) can be modified between stages to guide the architecture.

---

## Prerequisites

- **Node.js** >= 22.0.0
- **Claude Code** installed with a valid API key
- An `ANTHROPIC_API_KEY` environment variable (or other supported provider key)

Agent Teams is enabled automatically by `proteus-forge setup`.

---

## Installation

```bash
git clone https://github.com/brianbaping/proteus.git
cd proteus
npm install
npm run build
npm link
```

This builds the CLI and makes `proteus-forge` available globally.

## Quick Start

```bash
# One-time setup (configures providers, enables Agent Teams)
proteus-forge setup

# Create a project pointing at your POC
proteus-forge new my-app --source ~/projects/my-poc

# Run the pipeline
proteus-forge inspect
proteus-forge design
proteus-forge plan
proteus-forge split
proteus-forge execute
```

Check progress at any point:

```bash
proteus-forge status
```

```
[my-app] Pipeline Status

  Source: /home/user/projects/my-poc
  Target: /home/user/projects/my-poc-prod

  ✓ inspect       (2/19/2026, 2:34:19 PM)
  ✓ design        (2/19/2026, 2:48:16 PM)
  ✓ plan          (2/19/2026, 3:12:23 PM)
  ○ split
  ○ execute
```

Or run the entire pipeline in one command:

```bash
proteus-forge run                                    # full pipeline, no stopping
proteus-forge run --brief "Use Go with gRPC"         # with design requirements
proteus-forge run --from design --to split           # batch specific stages
proteus-forge run --budget 5.00                      # per-stage budget cap
```

---

## Commands

### Global Setup

#### `proteus-forge setup`

One-time configuration. Enables Claude Code Agent Teams, detects API keys, and writes default model tier configuration to `~/.proteus-forge/config.json`.

```bash
proteus-forge setup
```

#### `proteus-forge config get|set <key> [value]`

Read or modify configuration using dot-notation keys.

```bash
proteus-forge config get tiers.fast
proteus-forge config set tiers.fast.model "claude-haiku-4-5"
proteus-forge config set roles.execute-agent "advanced"
```

### Project Management

#### `proteus-forge new <name> --source <path> [--target <path>]`

Create a new Proteus Forge project. Initializes the target repository with git, `.proteus-forge/` directory, and a clean `CLAUDE.md`.

```bash
proteus-forge new my-app --source ~/projects/my-poc
proteus-forge new my-app --source ~/projects/my-poc --target ~/projects/my-app-prod
```

If `--target` is omitted, defaults to `{source-directory}-prod`.

#### `proteus-forge list`

Show all registered projects with their current pipeline stage.

```bash
proteus-forge list
```

```
  ● my-app                   /home/user/projects/my-poc-prod        (design)
    other-project            /home/user/projects/other-prod          (new)
```

#### `proteus-forge use <name>`

Set the active project. Subsequent commands use this project by default.

```bash
proteus-forge use my-app
```

#### `proteus-forge destroy <name>`

Remove a project. Deletes the target directory (with confirmation) and removes it from the registry. The source POC is never touched.

```bash
proteus-forge destroy my-app
```

#### `proteus-forge status [name]`

Show pipeline status including stage completion timestamps and staleness warnings.

```bash
proteus-forge status
proteus-forge status my-app
```

### Pipeline Stages

All stage commands accept `[name]` to specify a project (defaults to the active project), `--dry-run` to preview without launching agents, and `--budget <amount>` to set a USD spending cap.

#### `proteus-forge inspect [name]`

Launches an Agent Team that analyzes the source POC. A scout agent identifies domains (auth, data, API, frontend, devops, etc.), spawns specialist inspectors in parallel, and synthesizes findings into `features.json`.

```bash
proteus-forge inspect
proteus-forge inspect --dry-run
proteus-forge inspect --budget 2.00
```

Output: `.proteus-forge/01-inspect/features.json` with features, data model, integrations, and known issues.

#### `proteus-forge design [name]`

Launches an Agent Team that reads the inspection findings and designs a production architecture. An architect agent scopes design domains, spawns design specialists who negotiate API contracts and data boundaries via peer-to-peer messaging, then synthesizes into `design.md` and `design-meta.json`.

```bash
proteus-forge design
proteus-forge design --brief "Use microservices with Go and gRPC instead of Node.js"
proteus-forge design --brief-file ./architecture-requirements.md
```

The `--brief` and `--brief-file` flags inject user architectural requirements at highest priority. Without a brief, the AI decides the architecture based on the POC analysis.

Output: `.proteus-forge/02-design/design.md` (human-editable) and `design-meta.json` (machine-readable).

#### `proteus-forge plan [name]`

Single Lead session that reads the design and produces a task DAG with execution waves.

```bash
proteus-forge plan
```

Output: `.proteus-forge/03-plan/plan.json` (task DAG) and `plan.md` (human-editable narrative).

#### `proteus-forge split [name]`

Single Lead session that partitions plan tasks into discipline-specific tracks with file ownership boundaries.

```bash
proteus-forge split
```

Output: `.proteus-forge/04-tracks/manifest.json` and per-discipline track files.

#### `proteus-forge execute [name]`

Launches an Agent Team with one teammate per track. The Lead handles shared/scaffolding tasks, then engineers work in parallel respecting the wave-based dependency ordering.

```bash
proteus-forge execute
proteus-forge execute --dry-run
proteus-forge execute --budget 15.00
```

Output: Production source code in the target repository, plus `.proteus-forge/05-execute/session.json`.

#### `proteus-forge run [name]`

Run the full pipeline or a range of stages without stopping between them. Auto-detects the next incomplete stage if `--from` is not specified.

```bash
proteus-forge run                                    # full pipeline
proteus-forge run --from inspect --to design         # batch specific stages
proteus-forge run --brief "Use microservices in Go"  # with design requirements
proteus-forge run --budget 5.00                      # per-stage budget cap
```

Stops immediately if any stage fails. The `--brief` and `--brief-file` options are forwarded to the design stage.

### Execution Control

#### `proteus-forge inform <agent> <message>`

Send a message to a running teammate during execute. Requires an active execute session.

```bash
proteus-forge inform backend-engineer "Use async bcrypt instead of sync"
proteus-forge inform frontend-engineer "Add aria-labels to all form inputs"
```

Messages are delivered to the Lead via a file-based inbox, then relayed to the named teammate.

#### `proteus-forge resume [name]`

Resume execute from the last wave checkpoint. Detects the last `proteus-forge: execute wave N complete` git commit and restarts from wave N+1.

```bash
proteus-forge resume
```

#### `proteus-forge abort [name]`

Signal a running execute session to stop. Sends an abort message via the inbox, commits partial progress, and the session will shut down on its next turn.

```bash
proteus-forge abort
```

#### `proteus-forge watch [name]`

Monitor a running execute session. Tails `.proteus-forge/log.jsonl` for updates and auto-exits when the session ends.

```bash
proteus-forge watch
```

### Analysis & Review

#### `proteus-forge validate [name]`

Run cross-stage validation rules against all completed artifacts.

```bash
proteus-forge validate
```

```
[task-tracker] Validating artifacts...

  ✓ Features array non-empty                 62 features found
  ✓ Feature IDs unique                       62 unique IDs
  ✓ No dangling feature dependencies         All dependency references valid
  ✓ Feature-to-service map exists            62 features mapped
  ✓ design.md exists                         Present
  ✓ Task IDs unique                          14 unique task IDs
  ✓ All tasks have file ownership            All tasks have ownership
  ✓ No dangling task dependencies            All valid
  ✓ Execution waves defined                  7 waves
  ✓ Track manifest has tracks                6 tracks
  ✓ No stale artifacts                       All artifacts up to date

  11 passed, 0 failed
```

#### `proteus-forge review <stage> [name]`

Open a stage's primary artifact in `$EDITOR`.

```bash
proteus-forge review design     # opens design.md
proteus-forge review plan       # opens plan.md
proteus-forge review inspect    # opens features.json
```

#### `proteus-forge compare [name]`

Compare the source POC against the production target.

```bash
proteus-forge compare
```

```
[task-tracker] Source vs Target Comparison

  Source: /tmp/demo-poc
    13 files, ~261 lines

  Target: /tmp/demo-poc-prod
    109 files, ~9,430 lines

  Growth: 8.4x files, 36.1x lines

  Production structure:
    client               46 files
    prisma               2 files
    server               40 files
    shared               11 files
```

#### `proteus-forge diff <stage> [name]`

Show git changes for a stage's artifacts between the last two commits.

```bash
proteus-forge diff design
proteus-forge diff plan
```

#### `proteus-forge explain "<question>" [name]`

Launch an AI session that reads the project artifacts and answers a question about the design or plan.

```bash
proteus-forge explain "why is auth in wave 1?"
proteus-forge explain "what services handle product CRUD?"
```

#### `proteus-forge log [name]`

View the audit trail. Shows timestamps, status, duration, cost, and teammate counts.

```bash
proteus-forge log
proteus-forge log -n 3          # last 3 entries
```

```
[task-tracker] Audit Trail

  2/19/2026, 2:34:44 PM  ✓ inspect     4m 11s  $0.76
  2/19/2026, 2:50:14 PM  ⚠ design      11m 41s
  2/19/2026, 3:17:03 PM  ✓ plan        8m 47s  $1.17
  2/19/2026, 3:22:31 PM  ✓ split       2m 52s  $0.68
  2/19/2026, 3:58:17 PM  ⚠ execute     21m 48s  5 teammates
```

#### `proteus-forge costs [name]`

Show token usage and cost breakdown per stage.

```bash
proteus-forge costs
```

```
[task-tracker] Cost Breakdown

  inspect    $  0.76   4m 11s     single session   23K in / 50K out
  design     $  0.00   11m 41s    single session
  plan       $  1.17   8m 47s     single session   35K in / 30K out
  split      $  0.68   2m 52s     single session   17K in / 12K out
  execute    $  0.00   21m 48s    5 teammates
  ────────────────────────────────────────────────────────────
  Total      $  2.62
```

---

## Model Tiers

Proteus Forge uses a three-tier system that decouples agent roles from specific models. Configure in `~/.proteus-forge/config.json`:

```json
{
  "tiers": {
    "fast": { "provider": "anthropic", "model": "claude-haiku-4-5" },
    "standard": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
    "advanced": { "provider": "anthropic", "model": "claude-opus-4-6" }
  }
}
```

Default role-to-tier mapping:

| Role | Tier | Used By |
|------|------|---------|
| scout | fast | Inspect stage Lead |
| inspect-specialist | standard | Inspect domain specialists |
| design-specialist | advanced | Design stage Lead and specialists |
| plan-generator | standard | Plan and split stage Leads |
| execute-agent | advanced | Execute stage Lead and teammates |
| qa-agent | standard | QA track agents |

Override per-project in `{target}/.proteus-forge/config.json`:

```json
{
  "overrides": {
    "roles": {
      "execute-agent": { "provider": "openai", "model": "o3" }
    }
  }
}
```

---

## Artifact Structure

Each stage writes artifacts to `.proteus-forge/` in the target repository:

```
{target}/.proteus-forge/
├── config.json                    # Project config (source path, overrides)
├── costs.json                     # Token usage per stage
├── log.jsonl                      # Audit trail
│
├── 01-inspect/
│   ├── scout.json                 # Domain roster
│   ├── partials/{domain}.json     # Per-specialist findings
│   └── features.json              # Synthesized feature inventory
│
├── 02-design/
│   ├── scope.json                 # Design domain assignments
│   ├── partials/{domain}.md       # Per-specialist design (narrative)
│   ├── partials/{domain}.json     # Per-specialist design (metadata)
│   ├── design.md                  # Synthesized design (human-editable)
│   └── design-meta.json           # Synthesized design (machine-readable)
│
├── 03-plan/
│   ├── plan.json                  # Task DAG with dependencies
│   └── plan.md                    # Narrative plan (human-editable)
│
├── 04-tracks/
│   ├── manifest.json              # Track list and dependencies
│   └── {discipline}.json          # Per-track task list and context
│
└── 05-execute/
    ├── session.json               # Execution progress
    └── inbox/                     # Message inbox for proteus-forge inform
```

Git checkpoints are committed after each stage (`proteus-forge: inspect complete`, `proteus-forge: design complete`, etc.) for recovery.

---

## Editing Between Stages

`design.md` and `plan.md` are intended to be edited by the user. After editing, re-run the downstream stages:

```bash
# Edit the design
proteus-forge review design          # opens design.md in $EDITOR
# ... make changes ...

# Regenerate plan from updated design
proteus-forge plan

# Continue
proteus-forge split
proteus-forge execute
```

Proteus Forge detects staleness — if an upstream artifact is modified after a downstream one was generated, you'll see a warning:

```
  ⚠ design was modified after plan was generated. Re-run `proteus-forge plan`.
```

---

## Cost Tracking

Every stage reports token usage and estimated cost. View the breakdown:

```bash
proteus-forge costs
```

Costs are stored in `.proteus-forge/costs.json`:

```json
{
  "stages": {
    "inspect": { "duration": "4m 11s", "estimatedCost": 0.76 },
    "design": { "duration": "11m 41s", "estimatedCost": 1.05 },
    "plan": { "duration": "8m 47s", "estimatedCost": 1.17 },
    "split": { "duration": "2m 52s", "estimatedCost": 0.68 },
    "execute": { "duration": "21m 48s", "estimatedCost": 8.50 }
  },
  "totalCost": 12.16
}
```

Use `--budget` on any stage to set a spending cap:

```bash
proteus-forge execute --budget 10.00
```

---

## Development

The build script runs all quality gates in sequence — a lint error, type error, or test failure blocks the bundle.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Full pipeline: lint + typecheck + test + tsup bundle |
| `npm run dev` | Watch mode (tsup) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run typecheck` | TypeScript strict checking |
| `npm run test` | Vitest (single run) |
| `npm run test:watch` | Vitest (watch mode) |

### Testing

106 tests across 12 test files using [Vitest](https://vitest.dev/):

```bash
npm run test
```

```
 ✓ src/__tests__/config/global.test.ts        (6 tests)
 ✓ src/__tests__/config/project.test.ts       (7 tests)
 ✓ src/__tests__/config/registry.test.ts      (4 tests)
 ✓ src/__tests__/prompts/inspect.test.ts      (11 tests)
 ✓ src/__tests__/prompts/design.test.ts       (15 tests)
 ✓ src/__tests__/prompts/plan.test.ts         (12 tests)
 ✓ src/__tests__/prompts/split.test.ts        (11 tests)
 ✓ src/__tests__/prompts/execute.test.ts      (15 tests)
 ✓ src/__tests__/utils/costs.test.ts          (4 tests)
 ✓ src/__tests__/utils/inbox.test.ts          (9 tests)
 ✓ src/__tests__/utils/log.test.ts            (3 tests)
 ✓ src/__tests__/utils/stages.test.ts         (9 tests)

 Test Files  12 passed (12)
      Tests  106 passed (106)
```

Tests cover the config layer, all prompt generators, utility modules (costs, inbox, log, stages), and use temp directories for filesystem operations.

### Project Structure

```
src/
├── index.ts                    # CLI entry point (Commander)
├── commands/                   # 24 command handlers
│   ├── setup.ts, config.ts
│   ├── new.ts, list.ts, use.ts, destroy.ts
│   ├── inspect.ts, design.ts, plan.ts, split.ts, execute.ts, run.ts
│   ├── inform.ts, resume.ts, abort.ts, watch.ts
│   ├── status.ts, validate.ts, review.ts, diff.ts
│   └── compare.ts, costs.ts, explain.ts, log.ts
├── config/                     # Configuration management
│   ├── types.ts                # All TypeScript interfaces
│   ├── global.ts               # ~/.proteus-forge/config.json
│   ├── project.ts              # {target}/.proteus-forge/config.json
│   └── registry.ts             # ~/.proteus-forge/projects.json
├── prompts/                    # Agent prompt generators
│   ├── inspect.ts
│   ├── design.ts
│   ├── plan.ts
│   ├── split.ts
│   └── execute.ts
├── session/
│   └── launcher.ts             # Agent SDK wrapper (query + inbox streaming)
├── utils/
│   ├── claude-settings.ts      # ~/.claude/settings.json management
│   ├── costs.ts                # Cost tracking
│   ├── git.ts                  # Git operations
│   ├── inbox.ts                # File-based message inbox
│   ├── log.ts                  # Audit trail (JSONL)
│   ├── resolve-project.ts      # Project name resolution
│   ├── stages.ts               # Stage detection and staleness
│   └── team-summary.ts         # Agent team display formatting
└── __tests__/                  # 12 test files, 106 tests
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/claude-agent-sdk` | ^0.1.0 | Claude Code Agent Teams integration |
| `commander` | ^13.0.0 | CLI framework |
| `typescript` | ^5.7.0 | Language (strict mode) |
| `tsup` | ^8.0.0 | Bundler |
| `eslint` | ^10.0.0 | Linter |
| `vitest` | ^4.0.18 | Test framework |

---

## Architecture

Proteus Forge is a thin workflow layer. It does **not** make AI model calls, spawn agents, manage task lists, or handle inter-agent messaging. All of that is delegated to Claude Code Agent Teams.

Proteus Forge is responsible for:

| Proteus Forge Owns | Agent Teams Provides |
|---|---|
| Stage sequencing and validation | Lead/teammate lifecycle |
| Artifact schemas and cross-stage checks | Shared task list with dependencies |
| Prompt generation for Leads and specialists | Peer-to-peer messaging |
| Cost tracking and audit trail | Auto-unblocking of dependent tasks |
| Git checkpointing and recovery | Display modes (in-process, split panes) |
| CLI commands and project management | Teammate spawning and coordination |

### Scout → Specialize → Synthesize

Inspect and design stages use a reusable three-beat pattern:

1. **Scout/Scope**: A single Lead does a fast sweep to identify domains of concern
2. **Specialize**: N specialist teammates work in parallel, messaging each other about cross-domain findings
3. **Synthesize**: The Lead merges all partials into a unified output

### Fresh Agents Per Stage

No agent carries context between stages. Each stage launches a fresh Agent Team that reads the prior stage's artifacts. This keeps stages decoupled and artifacts as the single source of truth.

### Wave-Based Execution

Tasks are grouped into dependency-respecting waves. Agent Teams natively auto-unblocks tasks as dependencies complete. Proteus Forge commits a git checkpoint after each wave for crash recovery.

### File Ownership Isolation

During execute, each track owns specific files. No file appears in more than one track (except `track-shared`, managed by the Lead). This prevents merge conflicts when multiple agents write code in parallel.

---

## Schema Reference

See [proteus-forge-schemas.md](./proteus-forge-schemas.md) for complete artifact schemas, validation rules, and example payloads for all five stages.
