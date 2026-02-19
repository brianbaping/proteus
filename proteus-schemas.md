# Proteus — Architecture & Artifact Schemas

> Proteus transforms proof-of-concept codebases into production-ready applications using coordinated AI agent teams.
> It is a standalone CLI tool built on Claude Code Agent Teams.
> Source repos are read-only. Production code is built in a separate target repo.
> Every command validates its required inputs before executing and refuses to proceed if they're malformed or missing.

---

## How Proteus Works

Proteus is a **workflow layer on top of Claude Code Agent Teams**. It does not implement its own orchestration. Instead, it:

1. Defines what work needs to happen at each pipeline stage
2. Generates Agent Teams configurations (Lead prompts, teammate spawn prompts, task lists with dependencies, hooks)
3. Launches Agent Teams sessions via the Claude Agent SDK in the target repo's working directory
4. Validates the artifacts each team produces

Agent Teams handles: teammate lifecycle, peer-to-peer messaging, shared task lists, dependency auto-unblocking, and display modes.

### The Scout → Specialize → Synthesize Pattern

Stages that benefit from parallel analysis (inspect, design) follow a reusable three-beat pattern:

1. **Scout/Scope**: A single Lead agent does a fast, shallow sweep to identify domains of concern
2. **Specialize**: N specialist teammates work in parallel on their assigned domains, producing partial outputs and messaging each other about cross-domain findings
3. **Synthesize**: The Lead merges all partials, resolves contradictions, and validates cross-domain consistency

Stages that are mechanical transformations (plan, split) use a single Lead session with no teammates. The execute stage uses a wave-based variant with dependency-driven parallelism.

### Three-Repo Separation

| Concern | Location | Access |
|---------|----------|--------|
| Proteus global config | `~/.proteus/` | Tool configuration |
| Source (POC) | User-specified path | Read-only — never modified |
| Target (production) | User-specified path | Agent Teams write here |

The source POC is never touched. Agents read it as reference during inspect and execute but write all output to the target repo. The target repo gets its own `CLAUDE.md` controlled by Proteus — clean of any POC-era instructions.

### Fresh Agents Per Stage

No agent carries context between stages. Each stage launches a fresh Agent Team that reads the prior stage's artifacts. Artifacts are the complete source of truth.

---

## Global Configuration

### `~/.proteus/config.json`

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
  },
  "notifications": {
    "provider": "slack",
    "webhook": "$SLACK_WEBHOOK_URL",
    "events": ["stage-complete", "wave-complete", "failure", "escalation"]
  }
}
```

**Model tier system**: Roles reference tiers (`"fast"`, `"standard"`, `"advanced"`), tiers reference providers. This decouples Proteus from any specific AI provider. Users can map tiers to Anthropic, OpenAI, local models, or any combination. A role can also inline a `{ "provider": "...", "model": "..." }` object to bypass tiers for a specific role.

### `~/.proteus/projects.json`

```json
{
  "activeProject": "product-dashboard",
  "projects": {
    "product-dashboard": {
      "source": "/home/user/projects/product-dashboard-poc",
      "target": "/home/user/projects/product-dashboard-prod",
      "createdAt": "2026-02-19T10:00:00Z",
      "currentStage": "design"
    }
  }
}
```

### `~/.proteus/templates/`

Pre-configured specialist catalogs for common POC types. Templates influence the scout's domain discovery and specialist selection.

```json
{
  "templateName": "react-node",
  "domains": ["frontend", "bff", "api", "data", "auth", "devops"],
  "specialistHints": {
    "frontend": { "focus": "React component tree, state management, routing" },
    "bff": { "focus": "Backend-for-frontend pattern, API aggregation, caching" }
  }
}
```

Applied via: `proteus new myproject --source ./poc --template react-node`

---

## Project Configuration

### `{target}/.proteus/config.json`

```json
{
  "proteusVersion": "1.0.0",
  "projectName": "product-dashboard",
  "source": {
    "path": "/home/user/projects/product-dashboard-poc",
    "readonly": true
  },
  "overrides": {
    "roles": {
      "execute-agent": { "provider": "anthropic", "model": "claude-opus-4-6" }
    }
  },
  "hooks": {
    "post-inspect": "scripts/validate-features.sh",
    "post-execute": "scripts/run-security-scan.sh"
  }
}
```

Per-project overrides take precedence over global config. User-defined stage hooks run at stage boundaries; non-zero exit code blocks progression.

---

## Target Directory Structure

```
{target}/
├── CLAUDE.md                          # Proteus-controlled context for all Agent Teams
├── .proteus/
│   ├── config.json                    # project config (source path, overrides, hooks)
│   ├── costs.json                     # token usage and cost tracking per stage
│   ├── log.jsonl                      # structured audit trail
│   │
│   ├── 01-inspect/
│   │   ├── scout.json                 # domain roster
│   │   ├── team/
│   │   │   ├── manifest.json          # teammate configs
│   │   │   └── agent-{domain}.json    # spawn prompts
│   │   ├── partials/
│   │   │   └── {domain}.json          # per-specialist findings
│   │   └── features.json              # synthesized output
│   │
│   ├── 02-design/
│   │   ├── scope.json                 # design domain assignments
│   │   ├── team/
│   │   │   ├── manifest.json
│   │   │   └── agent-{domain}.json
│   │   ├── partials/
│   │   │   ├── {domain}.md            # per-specialist design (human-readable)
│   │   │   └── {domain}.json          # per-specialist design (machine-readable)
│   │   ├── design.md                  # synthesized design (human-reviewable/editable)
│   │   └── design-meta.json           # synthesized design (machine-readable)
│   │
│   ├── 03-plan/
│   │   ├── plan.json                  # task DAG with dependencies
│   │   └── plan.md                    # human-reviewable narrative
│   │
│   ├── 04-tracks/
│   │   ├── manifest.json              # track list and dependencies
│   │   ├── shared.json                # cross-cutting files track
│   │   ├── backend.json
│   │   ├── frontend.json
│   │   └── ...
│   │
│   └── 05-execute/
│       ├── team/
│       │   ├── manifest.json          # execution agent configs
│       │   └── agent-{track}.json     # spawn prompts per track
│       ├── session.json               # live progress tracking
│       └── logs/
│           └── agent-{track}.log
│
├── src/                               # production code (agents write here)
├── tests/
├── Dockerfile
└── ...
```

---

## Stage 1 — `proteus inspect`

Launches an Agent Team in the target directory. The Lead reads the source repo (read-only).

### Sub-stage 1a — Scout

The Lead (scout) does a shallow sweep of the source: file tree, package manifests, entry points, config files, CI pipelines, Dockerfiles. It identifies domains of concern and creates tasks for specialist teammates.

**Output:** `.proteus/01-inspect/scout.json`

```json
{
  "proteusVersion": "1.0.0",
  "stage": "inspect",
  "substage": "scout",
  "generatedAt": "2026-02-19T10:00:00Z",
  "source": {
    "path": "/home/user/projects/product-dashboard-poc",
    "name": "product-dashboard-poc",
    "fileCount": 47,
    "primaryLanguage": "TypeScript"
  },
  "domains": [
    {
      "id": "domain-auth",
      "name": "Authentication & Security",
      "specialist": "auth-inspector",
      "entryFiles": ["src/auth/", "src/middleware/auth.ts"],
      "rationale": "JWT middleware, login/logout routes, hardcoded secrets detected"
    },
    {
      "id": "domain-data",
      "name": "Data Layer",
      "specialist": "data-inspector",
      "entryFiles": ["prisma/schema.prisma", "src/db/"],
      "rationale": "Prisma ORM with PostgreSQL, 4 entity types"
    },
    {
      "id": "domain-api",
      "name": "API & Service Layer",
      "specialist": "api-inspector",
      "entryFiles": ["src/routes/", "src/services/"],
      "rationale": "Express routes with service layer pattern"
    },
    {
      "id": "domain-frontend",
      "name": "Frontend",
      "specialist": "frontend-inspector",
      "entryFiles": ["client/src/"],
      "rationale": "React SPA with Vite build"
    },
    {
      "id": "domain-devops",
      "name": "DevOps & Infrastructure",
      "specialist": "devops-inspector",
      "entryFiles": ["Dockerfile", "docker-compose.yml", ".github/workflows/"],
      "rationale": "Docker setup detected, CI pipeline present"
    }
  ]
}
```

### Sub-stage 1b — Specialize

The Lead spawns one teammate per domain. Each specialist receives a spawn prompt scoped to their domain with entry files and output path. Specialists work in parallel and message each other about cross-domain findings via Agent Teams' peer-to-peer mailbox.

**Output per specialist:** `.proteus/01-inspect/partials/{domain}.json`

```json
{
  "domainId": "domain-auth",
  "specialist": "auth-inspector",
  "generatedAt": "2026-02-19T10:02:00Z",
  "features": [
    {
      "id": "feat-001",
      "name": "User Authentication",
      "description": "JWT-based auth with login, logout, and token refresh",
      "category": "security",
      "sourceFiles": ["src/auth/login.ts", "src/auth/refresh.ts", "src/middleware/auth.ts"],
      "dependencies": [],
      "dependents": [],
      "complexity": "medium",
      "pocQuality": "prototype",
      "notes": "No refresh token rotation, secrets hardcoded in env vars"
    }
  ],
  "patterns": {
    "tokenStrategy": "JWT with no rotation",
    "sessionStorage": "stateless",
    "middlewareChain": ["cors", "rateLimit", "authCheck"]
  },
  "crossDomainDependencies": [
    {
      "from": "domain-auth",
      "to": "domain-data",
      "reason": "User table lookups on every login"
    },
    {
      "from": "domain-auth",
      "to": "domain-api",
      "reason": "Auth middleware applied to all /api/* routes"
    }
  ],
  "risks": [
    "No refresh token rotation — token theft gives permanent access",
    "Secrets loaded from process.env with no validation",
    "No rate limiting on login endpoint"
  ]
}
```

### Sub-stage 1c — Synthesize

When all specialist tasks complete (auto-unblocked by Agent Teams dependency system), the Lead claims the synthesis task. It reads all partials, deduplicates features, resolves contradictions, validates cross-references, and merges into the final output.

**Output:** `.proteus/01-inspect/features.json`

```json
{
  "proteusVersion": "1.0.0",
  "stage": "inspect",
  "generatedAt": "2026-02-19T10:03:00Z",
  "source": {
    "path": "/home/user/projects/product-dashboard-poc",
    "name": "product-dashboard-poc",
    "primaryLanguage": "TypeScript",
    "languages": ["TypeScript", "SQL", "Shell"],
    "frameworks": ["Express", "React", "Prisma"],
    "entryPoints": ["src/index.ts"],
    "testCoverage": "none"
  },
  "features": [
    {
      "id": "feat-001",
      "name": "User Authentication",
      "description": "JWT-based auth with login, logout, and token refresh",
      "category": "security",
      "sourceFiles": ["src/auth/login.ts", "src/auth/refresh.ts", "src/middleware/auth.ts"],
      "dependencies": [],
      "dependents": ["feat-003", "feat-005"],
      "complexity": "medium",
      "pocQuality": "prototype",
      "notes": "No refresh token rotation, secrets hardcoded in env vars"
    }
  ],
  "dataModel": {
    "store": "PostgreSQL",
    "ormOrDriver": "Prisma",
    "entities": ["User", "Product", "Order", "OrderItem"],
    "schemaFile": "prisma/schema.prisma"
  },
  "integrations": [
    {
      "name": "Stripe",
      "type": "payment",
      "status": "stubbed",
      "sourceFiles": ["src/payments/stripe.ts"]
    }
  ],
  "knownIssues": [
    "No error handling on database calls in product service",
    "No input validation on POST /orders",
    "CORS wildcard in production config"
  ],
  "summary": "E-commerce POC with auth, product catalog, and stubbed checkout. Core flows are functional but not production-ready."
}
```

### Agent Teams Configuration for Inspect

```json
{
  "stage": "inspect",
  "lead": {
    "role": "scout",
    "tier": "fast"
  },
  "teammates": [
    {
      "name": "auth-inspector",
      "tier": "standard",
      "spawnPrompt": "You are inspecting the authentication domain of the source repo at {source.path}. This repo is READ-ONLY. Focus on: {domain.entryFiles}. Write your findings to {target}/.proteus/01-inspect/partials/auth.json following the partial schema. Message other teammates about cross-domain dependencies you discover."
    }
  ],
  "tasks": [
    { "id": "inspect-auth", "assignTo": "auth-inspector", "dependsOn": [] },
    { "id": "inspect-data", "assignTo": "data-inspector", "dependsOn": [] },
    { "id": "synthesize", "assignTo": "lead", "dependsOn": ["inspect-auth", "inspect-data", "..."] }
  ],
  "hooks": {
    "TaskCompleted": "proteus validate-task --stage inspect"
  }
}
```

### Validation Rules

- `features` array must be non-empty
- Each feature must have a unique `id` matching the pattern `feat-NNN`
- `dependencies` must reference valid feature IDs within the same artifact
- No circular dependencies allowed (feature dependency graph must be a DAG)
- Every domain in `scout.json` must have a corresponding partial
- All partials must be merged into the synthesized output

---

## Stage 2 — `proteus design`

Same three-beat pattern. The Lead is an architect. It reads `features.json`, determines design domains, and spawns design specialists.

### Sub-stage 2a — Scope

The Lead reads the inspect output and assigns design domains to specialists.

**Output:** `.proteus/02-design/scope.json`

```json
{
  "proteusVersion": "1.0.0",
  "stage": "design",
  "substage": "scope",
  "generatedAt": "2026-02-19T10:05:00Z",
  "designDomains": [
    {
      "id": "design-auth",
      "name": "Authentication & Authorization Architecture",
      "specialist": "auth-designer",
      "implementsFeatures": ["feat-001"],
      "designFocus": "Token lifecycle, session strategy, RBAC, secrets management"
    },
    {
      "id": "design-commerce",
      "name": "Commerce Service Architecture",
      "specialist": "commerce-designer",
      "implementsFeatures": ["feat-002", "feat-003", "feat-004"],
      "designFocus": "Service boundaries, data ownership, API contracts"
    }
  ]
}
```

### Sub-stage 2b — Design Specialists

Specialists produce partial designs. They negotiate with each other via peer-to-peer messaging — API contracts, shared types, data boundaries.

**Output per specialist:** `.proteus/02-design/partials/{domain}.md` + `{domain}.json`

The `.md` file is a narrative design document for the domain. The `.json` file is machine-readable metadata (services, interfaces, entities).

### Sub-stage 2c — Synthesize

The architect merges partial designs into unified outputs.

**Output:** `.proteus/02-design/design.md` (human-reviewable/editable)

```markdown
# Architecture Design — product-dashboard

**Generated:** 2026-02-19
**Architecture Style:** Modular Monolith
**Target Stack:** Node.js 22, TypeScript 5, Fastify, React 19, PostgreSQL 16, Redis

---

## Overview
[narrative description of the target architecture]

## Services
### Auth Module
Responsible for: authentication, authorization, token lifecycle
...

## Data Architecture
[data layer decisions]

## Infrastructure
[deployment, scaling, observability decisions]

## Migration Notes
[specific callouts from POC that need rework]
```

**Output:** `.proteus/02-design/design-meta.json` (machine-readable)

```json
{
  "proteusVersion": "1.0.0",
  "stage": "design",
  "generatedAt": "2026-02-19T10:06:00Z",
  "architectureStyle": "modular-monolith",
  "targetStack": {
    "runtime": "Node.js 22",
    "language": "TypeScript 5",
    "framework": "Fastify",
    "database": "PostgreSQL 16",
    "cache": "Redis 7",
    "containerization": "Docker",
    "orchestration": "AWS ECS"
  },
  "services": [
    {
      "id": "svc-auth",
      "name": "Auth Module",
      "description": "Handles authentication and authorization",
      "implementsFeatures": ["feat-001"],
      "exposedInterfaces": [
        { "type": "REST", "path": "/auth", "methods": ["POST /login", "POST /refresh", "POST /logout"] }
      ],
      "ownedEntities": ["User", "RefreshToken"],
      "discipline": "backend"
    }
  ],
  "sharedInfrastructure": {
    "apiGateway": false,
    "centralLogging": "structured JSON logs",
    "monitoring": "Prometheus + Grafana"
  },
  "featureToServiceMap": {
    "feat-001": "svc-auth",
    "feat-002": "svc-products"
  }
}
```

### Validation Rules

- Every feature ID from `features.json` must appear in `featureToServiceMap`
- Every service must implement at least one feature
- `design.md` and `design-meta.json` must be consistent (architecture style, stack, services)

---

## Stage 3 — `proteus plan`

Single Lead session (no teammates). Reads the design artifacts and generates a task DAG with execution waves.

**Output:** `.proteus/03-plan/plan.json`

```json
{
  "proteusVersion": "1.0.0",
  "stage": "plan",
  "generatedAt": "2026-02-19T10:10:00Z",
  "tasks": [
    {
      "id": "task-001",
      "title": "Design database schema for Auth Module",
      "description": "Create migration for User and RefreshToken entities with proper indexes and constraints",
      "discipline": "data",
      "service": "svc-auth",
      "implementsFeatures": ["feat-001"],
      "dependsOn": [],
      "estimatedComplexity": "low",
      "testingExpectation": "unit",
      "testScope": "tests/unit/auth-schema/",
      "acceptanceCriteria": [
        "Migration runs cleanly on empty database",
        "User table has unique constraint on email",
        "RefreshToken has FK to User with cascade delete"
      ],
      "fileOwnership": ["prisma/schema.prisma", "prisma/migrations/auth/"]
    },
    {
      "id": "task-002",
      "title": "Implement Auth Module — core logic",
      "description": "JWT login, refresh with rotation, logout with token invalidation",
      "discipline": "backend",
      "service": "svc-auth",
      "implementsFeatures": ["feat-001"],
      "dependsOn": ["task-001"],
      "estimatedComplexity": "medium",
      "testingExpectation": "unit",
      "testScope": "tests/unit/auth/",
      "acceptanceCriteria": [
        "Login returns access + refresh token",
        "Refresh rotates refresh token",
        "Logout invalidates refresh token in DB",
        "All endpoints return correct HTTP status codes"
      ],
      "fileOwnership": ["src/auth/"]
    },
    {
      "id": "task-003",
      "title": "Write integration tests for Auth Module",
      "description": "Full flow tests: login -> refresh -> logout, expired token handling, invalid credentials",
      "discipline": "qa",
      "service": "svc-auth",
      "implementsFeatures": ["feat-001"],
      "dependsOn": ["task-002"],
      "estimatedComplexity": "medium",
      "testingExpectation": "integration",
      "testScope": "tests/integration/auth/",
      "acceptanceCriteria": [
        "All happy path flows pass",
        "Error cases return correct status codes",
        "Coverage > 80%"
      ],
      "fileOwnership": ["tests/integration/auth/"]
    }
  ],
  "executionWaves": [
    { "wave": 1, "tasks": ["task-001"], "rationale": "Schema must exist before any service code" },
    { "wave": 2, "tasks": ["task-002"], "rationale": "Auth module depends on schema" },
    { "wave": 3, "tasks": ["task-003"], "rationale": "Integration tests after implementation" }
  ],
  "criticalPath": ["task-001", "task-002", "task-003"]
}
```

**Output:** `.proteus/03-plan/plan.md` (human-reviewable narrative)

```markdown
# Production Plan — product-dashboard

**Generated:** 2026-02-19
**Total Tasks:** 14
**Estimated Waves:** 4

## Executive Summary
[high level description of the production build approach]

## Wave 1 — Foundation
[narrative of what happens first and why]

## Wave 2 — Core Services
[narrative]

## Wave 3 — Frontend
[narrative]

## Wave 4 — Production Readiness
[narrative]

## Risk Areas
[specific things to watch out for]
```

### Task Testing Model

Tasks use a two-tier testing model:

- `testingExpectation: "unit"` — The implementing agent writes unit tests alongside the implementation. The `testScope` field specifies where tests go.
- `testingExpectation: "integration"` — The QA track writes integration tests that run after the implementation is complete.

This eliminates the circular dependency between QA writing tests and agents needing tests to validate their work.

### Validation Rules

- Every task must have a unique `id` matching `task-NNN`
- `dependsOn` must reference valid task IDs
- No circular dependencies (task dependency graph must be a DAG)
- Every task must have non-empty `fileOwnership`
- No task in wave N may depend on a task in wave N or later
- `testingExpectation` must be `"unit"` or `"integration"`
- Every feature from `features.json` should be covered by at least one task's `implementsFeatures`

---

## Stage 4 — `proteus split`

Single Lead session. Partitions tasks from the plan into discipline-specific tracks with file ownership boundaries.

**Output:** `.proteus/04-tracks/manifest.json`

```json
{
  "proteusVersion": "1.0.0",
  "stage": "split",
  "generatedAt": "2026-02-19T10:15:00Z",
  "tracks": [
    {
      "id": "track-data",
      "discipline": "data",
      "taskCount": 3,
      "file": "04-tracks/data.json",
      "dependsOnTracks": [],
      "requiredByTracks": ["track-backend"]
    },
    {
      "id": "track-backend",
      "discipline": "backend",
      "taskCount": 5,
      "file": "04-tracks/backend.json",
      "dependsOnTracks": ["track-data"],
      "requiredByTracks": ["track-frontend", "track-qa"]
    },
    {
      "id": "track-frontend",
      "discipline": "frontend",
      "taskCount": 4,
      "file": "04-tracks/frontend.json",
      "dependsOnTracks": ["track-backend"],
      "requiredByTracks": ["track-qa"]
    },
    {
      "id": "track-devops",
      "discipline": "devops",
      "taskCount": 2,
      "file": "04-tracks/devops.json",
      "dependsOnTracks": [],
      "requiredByTracks": []
    },
    {
      "id": "track-qa",
      "discipline": "qa",
      "taskCount": 2,
      "file": "04-tracks/qa.json",
      "dependsOnTracks": ["track-backend", "track-frontend"],
      "requiredByTracks": []
    },
    {
      "id": "track-shared",
      "discipline": "shared",
      "taskCount": 0,
      "file": "04-tracks/shared.json",
      "dependsOnTracks": [],
      "requiredByTracks": ["track-backend", "track-frontend", "track-devops"],
      "note": "Cross-cutting files managed by the Lead between waves"
    }
  ]
}
```

**Individual track file** (e.g. `backend.json`):

```json
{
  "trackId": "track-backend",
  "discipline": "backend",
  "tasks": ["task-002", "task-005", "task-008"],
  "context": {
    "targetStack": "Node.js 22, TypeScript 5, Fastify",
    "services": ["svc-auth", "svc-products"],
    "sharedPatterns": "Use repository pattern, all services expose typed interfaces",
    "fileOwnershipMap": {
      "task-002": ["src/auth/"],
      "task-005": ["src/products/"],
      "task-008": ["src/orders/"]
    }
  }
}
```

**Shared track** (`shared.json`):

```json
{
  "trackId": "track-shared",
  "discipline": "shared",
  "ownedFiles": ["tsconfig.json", "package.json", "src/types/", "docker-compose.yml"],
  "managedBy": "lead",
  "note": "The Lead manages shared files directly. Teammates that need changes to shared files message the Lead with a change request."
}
```

### Validation Rules

- No file may appear in more than one track's file ownership (except `track-shared`)
- Files in `track-shared` must not appear in any other track
- Every task from `plan.json` must appear in exactly one track
- Track dependency graph must be a DAG

---

## Stage 5 — `proteus execute`

Launches an Agent Team. The Lead is an orchestrator. One teammate per track.

### Agent Teams Configuration

The Lead creates ALL tasks on the Agent Teams shared task list with full dependency chains. Dependencies encode wave ordering: wave 2 tasks depend on wave 1 tasks. Agent Teams natively auto-unblocks tasks as dependencies complete. Teammates self-claim available tasks.

```json
{
  "stage": "execute",
  "lead": {
    "role": "orchestrator",
    "tier": "advanced"
  },
  "teammates": [
    {
      "name": "backend-engineer",
      "tier": "advanced",
      "trackId": "track-backend",
      "spawnPrompt": "You are a backend engineer building production code. Your track: {track.context}. The original POC is at {source.path} for reference — do not copy POC code, reimplement according to the design. You own: {track.fileOwnershipMap}. Do not modify files outside your ownership. Complete one task at a time, write unit tests for each, verify acceptance criteria, then mark done."
    }
  ],
  "hooks": {
    "TaskCompleted": "proteus validate-task --stage execute",
    "TeammateIdle": "proteus on-idle --stage execute"
  }
}
```

### Hooks

**TaskCompleted** (`proteus validate-task`):
- Runs the task's unit tests
- Checks that the code compiles/lints
- Validates acceptance criteria markers
- Updates cost tracking
- If the hook exits with code 2, Agent Teams rejects the completion and sends feedback to the teammate
- On wave completion, triggers a git checkpoint commit

**TeammateIdle** (`proteus on-idle`):
- Checks if unblocked tasks remain for this teammate's track
- If none, allows the teammate to idle or shut down
- If tasks exist in other tracks and this teammate could help, notifies the Lead

### Wave-Level Checkpointing

After each wave completes, Proteus commits the target repo:

```
git commit -m "proteus: execute wave 1 complete"
git commit -m "proteus: execute wave 2 complete"
...
```

If the session crashes, `proteus resume` reads the git log, finds the last wave checkpoint, and restarts from wave N+1.

### Session State

**Output:** `.proteus/05-execute/session.json` (live, updated during execution)

```json
{
  "proteusVersion": "1.0.0",
  "stage": "execute",
  "sessionId": "sess-20260219-abc123",
  "startedAt": "2026-02-19T10:30:00Z",
  "status": "running",
  "teammates": [
    {
      "name": "backend-engineer",
      "trackId": "track-backend",
      "status": "running",
      "currentTask": "task-002",
      "tasksCompleted": [],
      "tasksFailed": [],
      "startedAt": "2026-02-19T10:30:00Z"
    }
  ],
  "waves": [
    { "wave": 1, "status": "completed", "completedAt": "2026-02-19T10:45:00Z" },
    { "wave": 2, "status": "running", "startedAt": "2026-02-19T10:46:00Z" }
  ],
  "progress": {
    "totalTasks": 14,
    "completed": 3,
    "running": 2,
    "pending": 9,
    "failed": 0
  },
  "failurePolicy": {
    "maxRetries": 2,
    "retryStrategy": "restart-task",
    "onExhaustedRetries": "pause-and-escalate",
    "cascadePolicy": "block-dependents"
  }
}
```

### Failure Recovery

- **Retry**: Teammate retries the same task with its previous error output as additional context
- **Block dependents**: If a task fails, downstream dependent tasks remain pending
- **Escalate**: After max retries, the teammate pauses and the Lead surfaces the failure for human intervention
- **Checkpoint rollback**: If a task fails mid-execution, the wave checkpoint provides a known-good state

---

## Cost Tracking

### `.proteus/costs.json`

```json
{
  "stages": {
    "inspect": {
      "timestamp": "2026-02-19T10:03:00Z",
      "teammates": 4,
      "tier": "standard",
      "duration": "2m 15s",
      "inputTokens": 125000,
      "outputTokens": 45000,
      "estimatedCost": 0.38
    },
    "design": {
      "timestamp": "2026-02-19T10:06:00Z",
      "teammates": 3,
      "tier": "advanced",
      "duration": "3m 40s",
      "inputTokens": 340000,
      "outputTokens": 120000,
      "estimatedCost": 1.05
    }
  },
  "totalCost": 8.79
}
```

Before launching any Agent Team stage, Proteus estimates token usage based on source repo size, number of teammates, and tier costs. For stages above a configurable cost threshold, the user must confirm before proceeding.

---

## Audit Trail

### `.proteus/log.jsonl`

One JSON object per line, appended after each action:

```json
{"timestamp": "2026-02-19T10:00:00Z", "action": "setup", "status": "success", "details": "Agent Teams enabled, Anthropic configured"}
{"timestamp": "2026-02-19T10:01:00Z", "action": "new", "status": "success", "details": "project product-dashboard created"}
{"timestamp": "2026-02-19T10:03:00Z", "action": "inspect", "status": "success", "teammates": 4, "duration": "2m 15s", "cost": 0.38}
{"timestamp": "2026-02-19T10:05:30Z", "action": "edit", "status": "info", "details": "user edited design.md"}
{"timestamp": "2026-02-19T10:06:00Z", "action": "design", "status": "success", "teammates": 3, "duration": "3m 40s", "cost": 1.05}
```

Viewable via `proteus log`.

---

## Editing Artifacts Between Stages

The Markdown files (`design.md`, `plan.md`) are intentionally human-editable. Proteus re-reads them before proceeding to the next stage. If you edit the design doc to change an architectural decision, run `proteus plan` again to regenerate the plan from your updated design.

### Staleness Warnings

Before running any stage, Proteus checks modification timestamps. If an upstream artifact was modified after a downstream artifact was generated, Proteus warns:

```
Warning: design.md was modified after plan was generated.
Run `proteus plan` first to regenerate from the updated design.
```

Re-running any stage overwrites its artifacts and marks all downstream stages as stale. The previous artifacts are preserved in git history.

---

## Cross-Stage Validation Rules

| Check | When | What |
|-------|------|------|
| Feature IDs unique | inspect output | No duplicate `feat-NNN` IDs |
| No circular feature deps | inspect output | Feature dependency graph is a DAG |
| All domains have partials | inspect output | Every domain in `scout.json` has a partial |
| All features mapped | design output | Every feature ID in `featureToServiceMap` |
| All tasks have owners | plan output | Every task has non-empty `fileOwnership` |
| No overlapping ownership | split output | No file in more than one track (except shared) |
| Shared track exclusive | split output | Shared files only in `track-shared` |
| Dependency wave ordering | plan output | No task in wave N depends on wave N or later |
| All task IDs valid | execute team | All task IDs in spawn prompts exist in `plan.json` |
| Staleness check | all stages | Upstream artifacts not modified after downstream |
| Agent Teams available | all stages | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` set |

---

## CLI Command Reference

### Global (2)

| Command | Description |
|---------|-------------|
| `proteus setup` | One-time configuration: enable Agent Teams, configure providers, set tier defaults |
| `proteus config [set\|get] <key> [value]` | Modify global or project config without editing JSON |

### Project Management (4)

| Command | Description |
|---------|-------------|
| `proteus new <name> --source <path> [--target <path>] [--template <name>]` | Create project, init target repo, register in project list |
| `proteus list` | Show all projects with status and active marker |
| `proteus use <name>` | Set active project (default for all commands) |
| `proteus destroy <name>` | Remove project: delete target repo (with confirmation), remove from registry |

### Pipeline Stages (5)

| Command | Description |
|---------|-------------|
| `proteus inspect [name]` | Agent Team: scout -> specialists -> synthesize |
| `proteus design [name]` | Agent Team: scope -> specialists -> synthesize |
| `proteus plan [name]` | Single Lead: generate task DAG with execution waves |
| `proteus split [name]` | Single Lead: partition tasks into discipline tracks |
| `proteus execute [name]` | Agent Team: wave-based parallel code generation |

### Execution Control (3)

| Command | Description |
|---------|-------------|
| `proteus resume [name]` | Resume execute from last wave checkpoint |
| `proteus abort [name]` | Gracefully stop in-progress stage, preserve checkpoints |
| `proteus watch [name]` | Attach to live Agent Team session to observe and intervene |

### Analysis & Review (8)

| Command | Description |
|---------|-------------|
| `proteus status [name]` | Pipeline state summary: which stages complete, current stage |
| `proteus validate [name]` | Run all cross-stage validation rules |
| `proteus review <stage> [name]` | Open stage artifact in `$EDITOR` |
| `proteus diff <stage> [name]` | Show changes between current and previous run of a stage |
| `proteus compare [name]` | Diff source vs target: what was added, replaced, removed, preserved |
| `proteus costs [name]` | Token usage and cost breakdown per stage |
| `proteus explain "<question>" [name]` | Explain design/plan decisions by reading artifacts |
| `proteus log [name]` | View structured audit trail |

### Global Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview without launching agents: show tasks, teammates, estimated cost |
| `--budget <amount>` | Spending cap for the stage |
| `--project <name>` | Explicit project name (alternative to `proteus use`) |

All `[name]` parameters are optional if an active project is set via `proteus use`.

---

## Implementation

Proteus is a TypeScript CLI built on the Claude Agent SDK.

- **Language**: TypeScript
- **Runtime**: Node.js
- **CLI framework**: Commander or oclif
- **Agent interface**: Claude Agent SDK (programmatic Agent Teams session creation and monitoring)
- **Package**: npm (`npm install -g proteus`)

### Key Components

| Component | Responsibility |
|-----------|---------------|
| `src/cli/` | CLI framework, 22 command handlers |
| `src/prompts/` | Prompt generators for Lead and specialist spawn prompts |
| `src/session/` | Agent SDK session launcher and monitor |
| `src/hooks/` | TaskCompleted and TeammateIdle hook scripts |
| `src/validator/` | JSON Schema validation for all artifact types |
| `src/git/` | Checkpoint commits, snapshots, diff |
| `src/config/` | Global/project config, project registry |
| `src/costs/` | Token estimation and cost tracking |

### What Proteus Does NOT Implement

Proteus is glue code. It does not:

- Make AI model calls directly (Claude Code does this)
- Spawn or manage agents (Agent Teams does this)
- Manage task lists or dependencies (Agent Teams shared task list does this)
- Handle inter-agent messaging (Agent Teams mailbox does this)
- Edit files or generate code (Agent Teams teammates do this)

Proteus composes prompts, launches sessions, validates outputs, and manages project state.
