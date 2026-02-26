# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Proteus Forge?

Proteus Forge is a TypeScript CLI that transforms POC codebases into production-ready applications using Claude Code Agent Teams. It generates prompts, launches sessions via the Claude Agent SDK's `query()` function, and validates the artifacts produced. All AI work is delegated to Agent Teams.

## Build & Test

```bash
npm run build        # lint → typecheck → test → tsup bundle (all gates must pass)
npm run lint         # ESLint with typescript-eslint
npm run lint:fix     # ESLint with auto-fix
npm run typecheck    # tsc --noEmit (strict mode)
npm run test         # vitest run
npm run test:watch   # vitest in watch mode
npm run dev          # tsup watch mode
```

Run a single test file or match by name:
```bash
npx vitest run src/__tests__/config/project.test.ts
npx vitest run -t "test name pattern"
```

Requires Node.js >= 22.0.0.

## Architecture

- **TypeScript CLI** using Commander (27 commands). Entry point: `src/index.ts`
- **Agent SDK integration** via `query()` in `src/session/launcher.ts`. Each stage composes a Lead prompt and launches a Claude Code session with `cwd` set to the target repo and `additionalDirectories` pointing to the source POC (read-only). Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json` (handled by `proteus-forge setup` via `claude-settings.ts`).
- **Three-repo separation**: Proteus Forge config at `~/.proteus-forge/`, source POC (never modified), target production repo (agents write here)
- **Provider-agnostic tiers**: `fast`/`standard`/`advanced` mapped to any provider in `~/.proteus-forge/config.json`

## Commands

**Primary workflow** (in order of use): `setup`, `new`, `use`, `inspect`, `design`, `plan`, `split`, `execute`

**Pipeline helpers**: `run` (full pipeline or range via `--from`/`--to`), `resume` (resume execute from last wave checkpoint), `abort` (signal running execute to stop), `watch` (tail log.jsonl live)

**Artifact management**: `revert` (rollback to a stage, removes downstream), `reset` (remove single stage artifacts), `validate` (cross-stage artifact validation), `diff` (git diff for stage artifacts), `compare` (file/line counts between source and target), `review` (open stage .md in `$EDITOR`)

**Project management**: `list`, `destroy`, `retarget` (change target dir, supports `--move`), `status`, `config`, `costs`, `log`, `inform`, `explain` (read-only agent Q&A session)

## Pipeline Stages

| Stage | Command | Agent Pattern | Model Tier | Key Output |
|-------|---------|---------------|------------|------------|
| Inspect | `inspect` | Agent Team (scout + specialists) | fast | `01-inspect/features.json` |
| Design | `design` | Agent Team (architect + specialists) | advanced | `02-design/design.md` + `design-meta.json` |
| Plan | `plan` | Single Lead | standard | `03-plan/plan.json` + `plan.md` |
| Split | `split` | Single Lead | standard | `04-tracks/manifest.json` + track files |
| Execute | `execute` | Agent Team (orchestrator + track engineers) | advanced | Production source code + `05-execute/session.json` |

## Key Patterns

- **Prompt generators** (`src/prompts/*.ts`) compose the Lead prompt with full artifact schemas embedded inline (not imported). The prompt quality determines output quality — these are the most important files.
- **Session launcher** (`src/session/launcher.ts`) wraps `query()`, captures session ID from `init` system messages, extracts cost/tokens from result messages. **Never throws** — always returns a `SessionResult` struct with `success: boolean`. Uses `permissionMode: "acceptEdits"` for pipeline stages and `"plan"` for read-only commands like `explain`.
- **Dual-export convention** — pipeline command files export both a `run<Stage>(name, options): Promise<boolean>` function (used by `run.ts` to chain stages) and a Commander `Command` object (used by `index.ts`). All handlers return `boolean`, never throw.
- **AgentDashboard** (`src/utils/dashboard.ts`) — renders color-coded per-agent activity to stdout during sessions. Detects `Task` tool use to register new agents, throttles progress events, filters internal noise via `NOISE_PATTERNS`. Created via `createDashboard()` from `src/utils/progress.ts`. Must call `cleanup()` after session ends to restore the cursor.
- **Inbox system** (`src/utils/inbox.ts`) enables `proteus-forge inform` — writes JSON message files that the session launcher polls at 3-second intervals and injects via `streamInput()`. Uses a `.active` sentinel file to signal session liveness (checked by `abort` and `watch`).
- **Wave checkpoints** — during execute, each wave commits with the message format `proteus-forge: execute wave N complete`. The `resume` command uses `getLastWaveCheckpoint()` from `src/utils/git.ts` to find the last completed wave number. This commit message convention is load-bearing.
- **Staleness detection** (`src/utils/stages.ts`) compares artifact mtimes to warn when upstream changes invalidate downstream stages. Also exports `STAGE_DIRS`, `STAGE_ORDER`, `getStageDir()`, `getStagesAfter()`, `getCurrentStage()`.
- **ANSI colors** — raw escape codes via `src/utils/ansi.ts`, no chalk or colors dependency.
- **API key resolution** — config supports `"$ENV_VAR_NAME"` syntax (dollar-prefixed strings resolve to environment variables), with fallback to `process.env.ANTHROPIC_API_KEY`.
- **Destructive commands** (`revert`, `reset`, `retarget`) use `confirm()` from `src/utils/confirm.ts` (readline-based Y/N prompt, defaults to N) before proceeding.

## Code Conventions

- **ESM-only** (`"type": "module"` in package.json). All imports must use `.js` extensions even for `.ts` source files (e.g., `import { foo } from "../config/global.js"`).
- **No barrel exports** — import directly from source files, no `index.ts` re-exports.
- **No path aliases** — all imports use relative paths.
- **Unused vars** — prefix with underscore (`_unused`) to satisfy the ESLint rule.
- **Strict TypeScript** — `strict: true` in tsconfig, nullable fields use `?` optional syntax.

## Test Patterns

- Tests live in `src/__tests__/` mirroring the source structure.
- **Integration-style**: tests create real temp directories via `mkdtemp()`, exercise functions end-to-end, then clean up with `rm(tempDir, { recursive: true, force: true })` in `afterEach`.
- **Mocking**: `vi.spyOn()` for function mocks, no custom test utilities or shared fixtures.
- **Commander command tests** use `vi.mock(...)` at the module level, then dynamic `await import(...)` inside the test to get the mocked version (required because Commander parses arguments at import time).
- **Vitest globals** enabled (`describe`, `it`, `expect` available without imports).

## Adding a New Command

1. Create `src/commands/mycommand.ts` exporting a Commander `Command`
2. For pipeline stages: also export a `run<Stage>(name, options): Promise<boolean>` function
3. Import and register in `src/index.ts` via `program.addCommand()`
4. Write tests in `src/__tests__/`
5. Run `npm run build` — lint, typecheck, and tests must all pass

## Adding a New Pipeline Stage

1. Create `src/prompts/mystage.ts` with the prompt generator function
2. Create `src/commands/mystage.ts` that resolves the project, generates the prompt, calls `launchSession()`, validates output, commits checkpoint
3. Add prerequisite check (upstream stage must be complete)
4. Add staleness check for downstream stages
5. Write prompt tests in `src/__tests__/prompts/mystage.test.ts`
6. Update `src/utils/stages.ts` `STAGE_ARTIFACTS`, `STAGE_DIRS`, and `STAGE_ORDER`
7. Add the stage to `run.ts` pipeline chain

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.proteus-forge/config.json` | Global: providers, tiers, role→tier mappings |
| `~/.proteus-forge/projects.json` | Project registry: name → source/target paths |
| `{target}/.proteus-forge/config.json` | Per-project: source path, overrides |
| `{target}/.proteus-forge/costs.json` | Token usage per stage |
| `{target}/.proteus-forge/log.jsonl` | Audit trail (JSONL) |

## Schema Reference

See `proteus-forge-schemas.md` for complete artifact schemas, CLI command reference, and example payloads from actual pipeline runs.
