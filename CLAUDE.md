# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Proteus Forge?

Proteus Forge is a TypeScript CLI that transforms POC codebases into production-ready applications using Claude Code Agent Teams. It generates prompts, launches sessions via the Claude Agent SDK's `query()` function, and validates the artifacts produced. All AI work is delegated to Agent Teams.

## Build & Test

```bash
npm run build        # lint → typecheck → test → tsup bundle (all gates must pass)
npm run lint         # ESLint with typescript-eslint
npm run typecheck    # tsc --noEmit (strict mode)
npm run test         # vitest run (106 tests across 12 files)
npm run test:watch   # vitest in watch mode
npm run dev          # tsup watch mode
```

## Architecture

- **TypeScript CLI** using Commander (13 commands). Entry point: `src/index.ts`
- **Agent SDK integration** via `query()` in `src/session/launcher.ts`. Each stage composes a Lead prompt and launches a Claude Code session with `cwd` set to the target repo and `additionalDirectories` pointing to the source POC (read-only).
- **Three-repo separation**: Proteus Forge config at `~/.proteus-forge/`, source POC (never modified), target production repo (agents write here)
- **Provider-agnostic tiers**: `fast`/`standard`/`advanced` mapped to any provider in `~/.proteus-forge/config.json`

## Pipeline Stages

| Stage | Command | Agent Pattern | Model Tier | Key Output |
|-------|---------|---------------|------------|------------|
| Inspect | `proteus-forge inspect` | Agent Team (scout + specialists) | fast | `01-inspect/features.json` |
| Design | `proteus-forge design` | Agent Team (architect + specialists) | advanced | `02-design/design.md` + `design-meta.json` |
| Plan | `proteus-forge plan` | Single Lead | standard | `03-plan/plan.json` + `plan.md` |
| Split | `proteus-forge split` | Single Lead | standard | `04-tracks/manifest.json` + track files |
| Execute | `proteus-forge execute` | Agent Team (orchestrator + track engineers) | advanced | Production source code + `05-execute/session.json` |

## Source Structure

```
src/
├── index.ts              # CLI entry, registers all 13 commands
├── commands/             # One file per command (setup, new, list, use, destroy, status, config, inspect, design, plan, split, execute, inform)
├── config/               # types.ts (interfaces), global.ts, project.ts, registry.ts
├── prompts/              # Prompt generators — one per pipeline stage (inspect, design, plan, split, execute)
├── session/launcher.ts   # Agent SDK query() wrapper with inbox streaming
└── utils/                # claude-settings, costs, git, inbox, log, resolve-project, stages, team-summary
```

## Key Patterns

- **Prompt generators** (`src/prompts/*.ts`) compose the Lead prompt with full artifact schemas embedded. The prompt quality determines output quality — these are the most important files.
- **Session launcher** (`src/session/launcher.ts`) wraps `query()`, captures session ID from init messages, extracts cost/tokens from result messages, handles errors gracefully (returns `SessionResult` instead of throwing).
- **Inbox system** (`src/utils/inbox.ts`) enables `proteus-forge inform` — writes JSON message files that the session launcher polls and injects via `streamInput()`.
- **Staleness detection** (`src/utils/stages.ts`) compares artifact mtimes to warn when upstream changes invalidate downstream stages.
- **Git checkpointing** — each stage commits artifacts to the target repo for recovery.

## Adding a New Command

1. Create `src/commands/mycommand.ts` exporting a Commander `Command`
2. Import and register in `src/index.ts` via `program.addCommand()`
3. Write tests in `src/__tests__/`
4. Run `npm run build` — lint, typecheck, and tests must all pass

## Adding a New Pipeline Stage

1. Create `src/prompts/mystage.ts` with the prompt generator function
2. Create `src/commands/mystage.ts` that resolves the project, generates the prompt, calls `launchSession()`, validates output, commits checkpoint
3. Add prerequisite check (upstream stage must be complete)
4. Add staleness check for downstream stages
5. Write prompt tests in `src/__tests__/prompts/mystage.test.ts`
6. Update `src/utils/stages.ts` STAGE_ARTIFACTS and STAGE_ORDER if it produces a new artifact

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
