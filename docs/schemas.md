# Proteus Forge — Architecture & Artifact Schemas

> Proteus Forge transforms proof-of-concept codebases into production-ready applications using coordinated AI agent teams.
> It is a standalone TypeScript CLI built on Claude Code Agent Teams via the Claude Agent SDK.
> Source repos are read-only. Production code is built in a separate target repo.
> Every command validates its required inputs before executing and refuses to proceed if they're malformed or missing.

---

## How Proteus Forge Works

Proteus Forge is a **workflow layer on top of Claude Code Agent Teams**. It does not implement its own orchestration. Instead, it:

1. Generates prompts for Agent Team Leads that instruct them to create teams, spawn teammates, and manage tasks
2. Launches sessions via the Claude Agent SDK's `query()` function
3. Monitors session progress and captures cost/duration metrics
4. Validates that expected artifacts were produced
5. Commits git checkpoints after each stage

Agent Teams handles: teammate lifecycle, peer-to-peer messaging, shared task lists, dependency auto-unblocking, and display modes.

### The Scout → Specialize → Synthesize Pattern

Stages that benefit from parallel analysis (inspect, design) follow a reusable three-beat pattern:

1. **Scout/Scope**: The Lead agent does a fast sweep to identify domains of concern
2. **Specialize**: N specialist teammates work in parallel, producing partial outputs and messaging each other about cross-domain findings
3. **Synthesize**: The Lead merges all partials into a unified output

Stages that are mechanical transformations (plan, split) use a single Lead session with no teammates. The execute stage uses a wave-based variant with one teammate per discipline track.

### Three-Repo Separation

| Concern | Location | Access |
|---------|----------|--------|
| Proteus Forge global config | `~/.proteus-forge/` | Tool configuration |
| Source (POC) | User-specified path | Read-only — never modified |
| Target (production) | User-specified path | Agent Teams write here |

The source POC is never touched. Agents read it as reference via `additionalDirectories` in the SDK options but write all output to the target repo. The target repo gets its own `CLAUDE.md` controlled by Proteus.

### Fresh Agents Per Stage

No agent carries context between stages. Each stage launches a fresh Agent Team that reads the prior stage's artifacts. Artifacts are the complete source of truth.

### Agent SDK Integration

Each stage command calls the Agent SDK's `query()` function:

```typescript
const session = query({
  prompt: leadPrompt,
  options: {
    cwd: targetPath,
    additionalDirectories: [sourcePath],
    model: resolvedModel,
    permissionMode: "acceptEdits",
    settingSources: ["user", "project"],
    maxBudgetUsd: budget,
  }
});
```

The `leadPrompt` is the key — it contains all instructions for team formation, task creation, teammate spawning, and synthesis. Proteus's prompt generators (`src/prompts/*.ts`) compose these prompts with full artifact schemas embedded.

---

## Global Configuration

### `~/.proteus-forge/config.json`

Created by `proteus-forge setup`. Contains provider configuration and model tier mappings.

```json
{
  "proteusVersion": "1.0.0",
  "providers": {
    "anthropic": {
      "type": "anthropic",
      "apiKey": "$ANTHROPIC_API_KEY"
    }
  },
  "tiers": {
    "fast":     { "provider": "anthropic", "model": "claude-haiku-4-5" },
    "standard": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
    "advanced": { "provider": "anthropic", "model": "claude-opus-4-6" }
  },
  "roles": {
    "scout":              "fast",
    "build-team":         "fast",
    "inspect-specialist": "standard",
    "synthesizer":        "standard",
    "design-specialist":  "advanced",
    "plan-generator":     "standard",
    "execute-agent":      "advanced",
    "qa-agent":           "standard"
  }
}
```

Roles reference tiers, tiers reference providers. A role can also inline a `{ "provider": "...", "model": "..." }` object to bypass tiers.

### `~/.proteus-forge/projects.json`

Project registry managed by `proteus-forge new`, `proteus-forge use`, and `proteus-forge destroy`.

```json
{
  "activeProject": "task-tracker",
  "projects": {
    "task-tracker": {
      "source": "/tmp/demo-poc",
      "target": "/tmp/demo-poc-prod",
      "createdAt": "2026-02-19T21:30:00Z",
      "currentStage": "new"
    }
  }
}
```

---

## Project Configuration

### `{target}/.proteus-forge/config.json`

Created by `proteus-forge new`. Records the source path and project name.

```json
{
  "proteusVersion": "1.0.0",
  "projectName": "task-tracker",
  "source": {
    "path": "/tmp/demo-poc",
    "readonly": true
  }
}
```

---

## Artifact Directory Structure

Based on actual output from a complete pipeline run:

```
{target}/
├── CLAUDE.md                          # Proteus Forge-controlled context for agents
├── .proteus-forge/
│   ├── config.json                    # project config (source path)
│   ├── costs.json                     # token usage per stage
│   ├── log.jsonl                      # audit trail (newline-delimited JSON)
│   │
│   ├── 01-inspect/
│   │   ├── scout.json                 # domain roster
│   │   ├── partials/
│   │   │   ├── domain-auth.json       # per-specialist findings
│   │   │   ├── domain-data.json
│   │   │   ├── domain-api.json
│   │   │   ├── domain-frontend.json
│   │   │   └── domain-devops.json
│   │   └── features.json              # synthesized output
│   │
│   ├── 02-design/
│   │   ├── scope.json                 # design domain assignments
│   │   ├── partials/
│   │   │   ├── design-backend.md      # per-specialist design (narrative)
│   │   │   ├── design-backend.json    # per-specialist design (metadata)
│   │   │   ├── design-data.md
│   │   │   ├── design-data.json
│   │   │   ├── design-frontend.md
│   │   │   ├── design-frontend.json
│   │   │   ├── design-security.md
│   │   │   ├── design-security.json
│   │   │   ├── design-infrastructure.md
│   │   │   └── design-infrastructure.json
│   │   ├── design.md                  # synthesized design (human-editable)
│   │   └── design-meta.json           # synthesized design (machine-readable)
│   │
│   ├── 03-plan/
│   │   ├── plan.json                  # task DAG with dependencies
│   │   └── plan.md                    # narrative plan (human-editable)
│   │
│   ├── 04-tracks/
│   │   ├── manifest.json              # track list and dependencies
│   │   ├── shared.json
│   │   ├── data.json
│   │   ├── devops.json
│   │   ├── backend.json
│   │   ├── frontend.json
│   │   └── qa.json
│   │
│   └── 05-execute/
│       ├── session.json               # execution summary
│       └── inbox/                     # message inbox for proteus-forge inform
│
├── server/                            # production server code
├── client/                            # production client code
├── shared/                            # shared types and validators
├── prisma/                            # database schema and migrations
├── Dockerfile
├── docker-compose.yml
└── .github/workflows/                 # CI/CD pipeline
```

---

## Stage 1 — `proteus-forge inspect`

Launches an Agent Team in the target directory. The Lead reads the source repo (read-only via `additionalDirectories`).

**Model tier**: `roles.scout` → `fast` (claude-haiku-4-5 by default)

### How It Works

1. Lead scouts the source: file tree, package manifests, entry points, config files
2. Lead identifies domains and spawns specialist teammates (one per domain)
3. Specialists inspect in parallel, messaging each other about cross-domain findings
4. Lead synthesizes partials into `features.json`

### Artifacts

**`scout.json`** — Domain roster produced by the Lead's initial analysis:

```json
{
  "proteusVersion": "1.0.0",
  "stage": "inspect",
  "substage": "scout",
  "generatedAt": "2026-02-19T14:30:00Z",
  "source": {
    "path": "/tmp/demo-poc",
    "name": "task-tracker-poc",
    "fileCount": 10,
    "primaryLanguage": "TypeScript"
  },
  "domains": [
    {
      "id": "domain-auth",
      "name": "Authentication & Security",
      "specialist": "auth-inspector",
      "entryFiles": ["src/auth/routes.ts", "src/middleware/auth.ts"],
      "rationale": "JWT-based authentication with hardcoded secrets"
    }
  ]
}
```

**`partials/{domain}.json`** — Per-specialist findings:

```json
{
  "domainId": "domain-auth",
  "specialist": "auth-inspector",
  "generatedAt": "2026-02-19T14:31:00Z",
  "features": [
    {
      "id": "feat-001",
      "name": "User Login API Route",
      "description": "POST /auth/login endpoint...",
      "category": "security",
      "sourceFiles": ["src/auth/routes.ts"],
      "dependencies": ["feat-004"],
      "dependents": ["feat-010"],
      "complexity": "medium",
      "pocQuality": "functional",
      "notes": "Uses hardcoded JWT secret..."
    }
  ],
  "patterns": {
    "tokenStrategy": "JWT with no rotation",
    "sessionStorage": "stateless"
  },
  "crossDomainDependencies": [
    { "from": "domain-auth", "to": "domain-data", "reason": "User table lookups on every login" }
  ],
  "risks": ["No refresh token rotation", "Hardcoded JWT secret"]
}
```

**`features.json`** — Synthesized output (the authoritative inspect artifact):

```json
{
  "proteusVersion": "1.0.0",
  "stage": "inspect",
  "generatedAt": "2026-02-19T14:32:00Z",
  "source": {
    "path": "/tmp/demo-poc",
    "name": "task-tracker-poc",
    "primaryLanguage": "TypeScript",
    "languages": ["TypeScript", "TSX", "JSON", "Dockerfile"],
    "frameworks": ["Express.js", "React", "Prisma", "React Router", "Vite"],
    "entryPoints": ["src/index.ts", "client/src/App.tsx"],
    "testCoverage": "none"
  },
  "features": [
    {
      "id": "feat-001",
      "name": "User Login API Route",
      "description": "...",
      "category": "security",
      "sourceFiles": ["src/auth/routes.ts"],
      "dependencies": ["feat-004"],
      "dependents": ["feat-010"],
      "complexity": "medium",
      "pocQuality": "functional",
      "notes": "..."
    }
  ],
  "dataModel": {
    "store": "PostgreSQL",
    "ormOrDriver": "Prisma ORM",
    "entities": ["User", "Product"],
    "schemaFile": "prisma/schema.prisma"
  },
  "integrations": [
    { "name": "PostgreSQL Database", "type": "database", "status": "active", "sourceFiles": ["prisma/schema.prisma", "src/db.ts"] }
  ],
  "knownIssues": [
    "CRITICAL: Hardcoded JWT secret in source code",
    "CRITICAL: CORS wildcard origin",
    "HIGH: No input validation on product endpoints",
    "..."
  ],
  "summary": "Task Tracker POC with authentication and product management. Critical security issues..."
}
```

### CLI Output

```
[task-tracker] Inspection complete.

  Agent Team (5 specialists):
    • auth-inspector               Authentication & Security
    • data-inspector               Data Layer & ORM
    • api-inspector                API & Service Layer
    • frontend-inspector           Frontend & UI
    • devops-inspector             DevOps & Infrastructure

  Cost: $0.76
  Duration: 4m 11s
  Committed: "proteus-forge: inspect complete"
```

---

## Stage 2 — `proteus-forge design`

Same three-beat pattern. The Lead is an architect that reads `features.json` and coordinates design specialists.

**Model tier**: `roles.design-specialist` → `advanced` (claude-opus-4-6 by default)

Supports `--brief` and `--brief-file` flags for user architectural requirements that override the AI's default choices.

### Artifacts

**`scope.json`** — Design domain assignments:

```json
{
  "proteusVersion": "1.0.0",
  "stage": "design",
  "substage": "scope",
  "generatedAt": "2026-02-19T15:00:00Z",
  "designDomains": [
    {
      "id": "design-backend",
      "name": "Backend Architecture",
      "specialist": "backend-designer",
      "implementsFeatures": ["feat-006", "feat-106", "..."],
      "designFocus": "Service structure, middleware pipeline, API design..."
    }
  ]
}
```

**`partials/{domain}.md`** and **`partials/{domain}.json`** — Per-specialist designs (narrative + machine-readable).

**`design.md`** — Synthesized architecture document (human-editable):

```markdown
# Architecture Design — Task Tracker

**Generated:** 2026-02-19
**Architecture Style:** Modular Monolith
**Target Stack:** Node.js 22 / TypeScript 5.x / Express.js / Prisma / PostgreSQL 16 / React 19 / Vite 6 / Docker

## Overview
...

## Services / Modules
### svc-api-gateway — API Gateway & Middleware Pipeline
### svc-auth — Authentication Service
### svc-products — Products Service
...
```

**`design-meta.json`** — Machine-readable metadata with services, stack, and feature-to-service mapping:

```json
{
  "proteusVersion": "1.0.0",
  "stage": "design",
  "generatedAt": "2026-02-19T15:45:00Z",
  "architectureStyle": "modular-monolith",
  "targetStack": {
    "runtime": "Node.js 22 LTS",
    "language": "TypeScript 5.x (strict mode)",
    "framework": "Express.js 4.x",
    "database": "PostgreSQL 16",
    "cache": "Redis 7",
    "containerization": "Docker",
    "ci": "GitHub Actions"
  },
  "services": [
    {
      "id": "svc-auth",
      "name": "Authentication & Authorization Service",
      "description": "...",
      "implementsFeatures": ["feat-001", "feat-002", "..."],
      "exposedInterfaces": [
        { "type": "REST", "path": "/auth/login", "methods": ["POST"] }
      ],
      "ownedEntities": ["User"],
      "discipline": "backend"
    }
  ],
  "featureToServiceMap": {
    "feat-001": "svc-auth",
    "feat-106": "svc-products"
  }
}
```

---

## Stage 3 — `proteus-forge plan`

Single Lead session (no teammates). Reads design artifacts and generates a task DAG.

**Model tier**: `roles.plan-generator` → `standard` (claude-sonnet-4-6 by default)

### Artifacts

**`plan.json`** — Task DAG with execution waves:

```json
{
  "proteusVersion": "1.0.0",
  "stage": "plan",
  "generatedAt": "2026-02-19T16:00:00Z",
  "tasks": [
    {
      "id": "task-001",
      "title": "Scaffold project directory structure and root configuration",
      "description": "...",
      "discipline": "shared",
      "service": "all",
      "implementsFeatures": ["feat-402", "..."],
      "dependsOn": [],
      "estimatedComplexity": "medium",
      "testingExpectation": "none",
      "acceptanceCriteria": ["package.json exists with all dependencies", "..."],
      "fileOwnership": ["package.json", "tsconfig.json", "..."]
    }
  ],
  "executionWaves": [
    { "wave": 1, "tasks": ["task-001", "task-005", "task-006"], "rationale": "Foundation tasks with no dependencies" }
  ],
  "criticalPath": ["task-001", "task-002", "task-004", "task-007", "task-008", "task-009", "task-013"]
}
```

**`plan.md`** — Human-readable narrative with executive summary, wave descriptions, critical path analysis, and risk areas.

### Task Testing Model

Tasks specify a `testingExpectation` field:

- `"unit"` — The implementing agent writes unit tests alongside the code
- `"integration"` — The QA track writes integration tests after implementation
- `"none"` — Infrastructure/config tasks that don't need tests

---

## Stage 4 — `proteus-forge split`

Single Lead session. Partitions plan tasks into discipline-specific tracks.

**Model tier**: `roles.plan-generator` → `standard`

### Artifacts

**`manifest.json`** — Track list with dependencies:

```json
{
  "proteusVersion": "1.0.0",
  "stage": "split",
  "generatedAt": "2026-02-19T16:15:00Z",
  "tracks": [
    {
      "id": "track-shared",
      "discipline": "shared",
      "taskCount": 2,
      "file": "04-tracks/shared.json",
      "dependsOnTracks": [],
      "requiredByTracks": ["track-data", "track-backend", "track-frontend"]
    },
    {
      "id": "track-backend",
      "discipline": "backend",
      "taskCount": 3,
      "file": "04-tracks/backend.json",
      "dependsOnTracks": ["track-shared", "track-data"],
      "requiredByTracks": ["track-frontend", "track-qa"]
    }
  ]
}
```

**Individual track files** (e.g., `backend.json`):

```json
{
  "trackId": "track-backend",
  "discipline": "backend",
  "tasks": ["task-007", "task-008", "task-009"],
  "context": {
    "targetStack": "Node.js 22, TypeScript 5.x, Express.js 4.x, Prisma 5.x",
    "services": ["svc-api-gateway", "svc-auth", "svc-products"],
    "sharedPatterns": "Feature-based module structure, repository pattern...",
    "fileOwnershipMap": {
      "task-007": ["server/src/app.ts", "server/src/middleware/", "server/src/index.ts"],
      "task-008": ["server/src/features/auth/"],
      "task-009": ["server/src/features/products/"]
    }
  }
}
```

---

## Stage 5 — `proteus-forge execute`

Launches an Agent Team with one teammate per track. The Lead handles shared tasks directly, then coordinates track engineers.

**Model tier**: `roles.execute-agent` → `advanced` (claude-opus-4-6 by default)

### How It Works

1. Lead reads design, plan, and track files for full context
2. Lead completes shared-discipline tasks (scaffolding, shared types) directly
3. Lead spawns one teammate per non-shared track (data-engineer, devops-engineer, backend-engineer, frontend-engineer, qa-engineer)
4. Lead creates all tasks on Agent Teams shared task list with dependency chains
5. Agent Teams auto-unblocks tasks as dependencies complete
6. Teammates self-claim and execute tasks, writing production code
7. Lead writes `session.json` summary on completion

### Message Inbox

During execute, Proteus Forge creates a file-based inbox at `.proteus-forge/05-execute/inbox/`. Users can send messages to running teammates via `proteus-forge inform`:

```bash
proteus-forge inform backend-engineer "Use async bcrypt instead of sync"
```

The session launcher polls the inbox every 3 seconds and injects messages into the running session via the Agent SDK's `streamInput()` method. The Lead relays messages to the named teammate.

### Artifacts

**`session.json`** — Execution summary (written by the Lead on completion):

```json
{
  "proteusVersion": "1.0.0",
  "stage": "execute",
  "sessionId": "...",
  "startedAt": "2026-02-19T15:36:00Z",
  "completedAt": "2026-02-19T15:57:00Z",
  "status": "completed",
  "progress": {
    "totalTasks": 14,
    "completed": 14,
    "failed": 0
  }
}
```

### CLI Output

```
[task-tracker] Execution complete.

  Agent Team (5 teammates):
    • data-engineer                data
    • devops-engineer              devops
    • backend-engineer             backend
    • frontend-engineer            frontend
    • qa-engineer                  qa

  Cost: $8.50
  Duration: 21m 48s
  Committed: "proteus-forge: execute complete"
```

---

## Cost Tracking

### `.proteus-forge/costs.json`

Updated after each stage with token counts and estimated cost:

```json
{
  "stages": {
    "inspect": {
      "timestamp": "2026-02-19T21:34:44.308Z",
      "teammates": 0,
      "tier": "claude-haiku-4-5",
      "duration": "4m 11s",
      "inputTokens": 22641,
      "outputTokens": 49510,
      "estimatedCost": 0.76
    }
  },
  "totalCost": 0.76
}
```

The `teammates` count is set by the command handler (execute passes the actual count; other stages report 0 since teammate spawning happens inside the Lead's session).

---

## Audit Trail

### `.proteus-forge/log.jsonl`

One JSON object per line, appended after each action:

```jsonl
{"timestamp":"2026-02-19T21:34:44Z","action":"inspect","status":"success","duration":"4m 11s","cost":0.76}
{"timestamp":"2026-02-19T21:50:14Z","action":"design","status":"recovered","duration":"11m 41s","cost":0}
{"timestamp":"2026-02-19T22:12:23Z","action":"plan","status":"success","duration":"8m 47s","cost":1.17}
```

Status values: `"success"`, `"recovered"` (session errored but artifacts produced), `"failed"`.

---

## Git Checkpointing

Each stage commits artifacts to the target repo's git history:

```
cdfba0b proteus-forge: execute complete (recovered)
538af7c proteus-forge: split complete
b7d371b proteus-forge: plan complete
d1ea68b proteus-forge: design complete (recovered)
ac72a61 proteus-forge: inspect complete
```

This provides recovery — if a stage needs to be re-run, previous artifacts are preserved in git history.

---

## Staleness Warnings

Before running any stage, Proteus Forge checks modification timestamps. If an upstream artifact was modified after a downstream artifact was generated:

```
  ⚠ inspect was modified after design was generated. Re-run `proteus-forge design`.
```

Implemented in `src/utils/stages.ts` — compares `mtime` of stage artifacts in sequential order.

---

## Editing Artifacts Between Stages

`design.md` and `plan.md` are intentionally human-editable. Proteus Forge re-reads them before the next stage. After editing:

```bash
# Edit the design
vi {target}/.proteus-forge/02-design/design.md

# Regenerate downstream stages
proteus-forge plan
proteus-forge split
proteus-forge execute
```

---

## Cross-Stage Validation Rules

These rules are defined in the prompt schemas and enforced by the agent at generation time:

| Check | When | What |
|-------|------|------|
| Feature IDs unique | inspect output | No duplicate `feat-NNN` IDs |
| No circular feature deps | inspect output | Feature dependency graph is a DAG |
| All features mapped | design output | Every feature ID in `featureToServiceMap` |
| All tasks have owners | plan output | Every task has non-empty `fileOwnership` |
| No overlapping ownership | split output | No file in more than one track (except shared) |
| Shared track exclusive | split output | Shared files only in `track-shared` |
| Dependency wave ordering | plan output | No task in wave N depends on wave N or later |
| No circular task deps | plan output | Task dependency graph is a DAG |
| Staleness check | all stages | Upstream artifacts not modified after downstream |
| Agent Teams available | setup | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` set |

---

## CLI Command Reference

### All Commands (24)

#### Global (2)

| Command | Description |
|---------|-------------|
| `proteus-forge setup` | Enable Agent Teams, configure providers, write `~/.proteus-forge/config.json` |
| `proteus-forge config get\|set <key> [value]` | Read/write config via dot-notation keys |

#### Project Management (4)

| Command | Description |
|---------|-------------|
| `proteus-forge new <name> --source <path> [--target <path>]` | Create project, init target repo with git and `.proteus-forge/` |
| `proteus-forge list` | Show all projects with current stage and active marker |
| `proteus-forge use <name>` | Set active project (default for all commands) |
| `proteus-forge destroy <name>` | Delete target repo (with confirmation), remove from registry |

#### Pipeline Stages (6)

| Command | Options | Description |
|---------|---------|-------------|
| `proteus-forge inspect [name]` | `--dry-run` `--budget` | Agent Team: scout → specialists → synthesize |
| `proteus-forge design [name]` | `--dry-run` `--budget` `--brief` `--brief-file` | Agent Team: scope → specialists → synthesize |
| `proteus-forge plan [name]` | `--dry-run` `--budget` | Single Lead: generate task DAG |
| `proteus-forge split [name]` | `--dry-run` `--budget` | Single Lead: partition into tracks |
| `proteus-forge execute [name]` | `--dry-run` `--budget` | Agent Team: wave-based parallel execution |
| `proteus-forge run [name]` | `--from` `--to` `--budget` `--brief` `--brief-file` | Run full pipeline or a range of stages without stopping |

#### Execution Control (4)

| Command | Description |
|---------|-------------|
| `proteus-forge inform <agent> <message>` | Send message to running teammate during execute |
| `proteus-forge resume [name]` | Resume execute from last wave git checkpoint |
| `proteus-forge abort [name]` | Signal running session to stop via inbox message |
| `proteus-forge watch [name]` | Monitor running session's log for updates |

#### Analysis & Review (8)

| Command | Description |
|---------|-------------|
| `proteus-forge status [name]` | Pipeline state: stage completion, timestamps, staleness warnings |
| `proteus-forge validate [name]` | Run 11 cross-stage validation rules |
| `proteus-forge review <stage> [name]` | Open stage artifact in `$EDITOR` |
| `proteus-forge diff <stage> [name]` | Show git changes for stage artifacts between runs |
| `proteus-forge compare [name]` | Compare source POC vs production target (files, lines, growth) |
| `proteus-forge costs [name]` | Token usage and cost breakdown per stage with totals |
| `proteus-forge explain "<question>" [name]` | AI-powered explanation of design/plan decisions |
| `proteus-forge log [name]` | View audit trail. Supports `-n` for last N entries |

---

## ID Reference System

| Type | Pattern | Examples | Produced By |
|------|---------|----------|-------------|
| Features | `feat-NNN` | feat-001, feat-042 | Inspect |
| Services | `svc-xxx` | svc-auth, svc-products | Design |
| Tasks | `task-NNN` | task-001, task-014 | Plan |
| Tracks | `track-xxx` | track-backend, track-shared | Split |
| Inspect domains | `domain-xxx` | domain-auth, domain-data | Inspect scout |
| Design domains | `design-xxx` | design-backend, design-security | Design scope |

---

## Implementation

### Technology

| | |
|---|---|
| Language | TypeScript (strict mode, ES modules) |
| Runtime | Node.js >= 22.0.0 |
| CLI framework | Commander ^13.0.0 |
| Agent interface | @anthropic-ai/claude-agent-sdk ^0.1.0 |
| Bundler | tsup ^8.0.0 |
| Linter | ESLint ^10.0.0 with typescript-eslint |
| Test framework | Vitest ^4.0.18 |
| Build pipeline | `npm run build` = lint → typecheck → test → bundle |

### Source Structure

```
src/
├── index.ts                    # CLI entry point, registers 13 commands
├── commands/                   # Command handlers (one file per command)
│   ├── setup.ts, new.ts, list.ts, use.ts, destroy.ts
│   ├── status.ts, config.ts
│   ├── inspect.ts, design.ts, plan.ts, split.ts, execute.ts
│   └── inform.ts
├── config/                     # Configuration management
│   ├── types.ts                # TypeScript interfaces for all configs
│   ├── global.ts               # ~/.proteus-forge/config.json
│   ├── project.ts              # {target}/.proteus-forge/config.json
│   └── registry.ts             # ~/.proteus-forge/projects.json
├── prompts/                    # Prompt generators (one per pipeline stage)
│   ├── inspect.ts, design.ts, plan.ts, split.ts, execute.ts
├── session/
│   └── launcher.ts             # Agent SDK query() wrapper + inbox streaming
└── utils/
    ├── claude-settings.ts      # Read/write ~/.claude/settings.json
    ├── costs.ts                # Cost tracking (.proteus-forge/costs.json)
    ├── git.ts                  # Git init, add, commit, checkpoint detection
    ├── inbox.ts                # File-based message inbox for proteus-forge inform
    ├── log.ts                  # Audit trail (.proteus-forge/log.jsonl)
    ├── resolve-project.ts      # Project name → ProjectEntry resolution
    ├── stages.ts               # Stage artifact detection, staleness checks
    └── team-summary.ts         # Read scout.json/scope.json for team display
```

### Tests

106 tests across 12 test files:

| Test File | Tests | Covers |
|-----------|-------|--------|
| config/global.test.ts | 6 | Default config, tier mappings, role assignments |
| config/project.test.ts | 7 | Read/write project config, path helpers |
| config/registry.test.ts | 4 | JSON roundtrip, multiple projects, unregister |
| prompts/inspect.test.ts | 11 | Source/target paths, schemas, team instructions |
| prompts/design.test.ts | 15 | Paths, schemas, brief injection, priority |
| prompts/plan.test.ts | 12 | Input references, task schema, wave rules |
| prompts/split.test.ts | 11 | Track names, ownership rules, DAG constraint |
| prompts/execute.test.ts | 15 | Task summary, teammate defs, file ownership |
| utils/costs.test.ts | 4 | Append, accumulate, overwrite on re-run |
| utils/inbox.test.ts | 9 | Write, consume, ordering, sentinel detection |
| utils/log.test.ts | 3 | File creation, JSONL format, multi-entry |
| utils/stages.test.ts | 9 | Stage detection, current stage, staleness |
