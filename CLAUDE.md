# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Proteus Forge?

Proteus Forge is a TypeScript CLI that transforms POC codebases into production-ready applications using Claude Code Agent Teams. It generates prompts, launches sessions via the Claude Agent SDK's `query()` function, and validates the artifacts produced.

## Build & Test

**Build order matters**: shared → cli → gui.

```bash
npm install                              # install all workspace dependencies
npm run build -w @proteus-forge/shared   # build shared types (must run first)
npm run build -w @proteus-forge/cli      # lint → typecheck → test → bundle
npm run build -w @proteus-forge/gui      # production build
npm run dev -w @proteus-forge/gui        # Vite + Electron dev mode
npm run test -w @proteus-forge/cli       # vitest run (CLI tests)
npm run test -w @proteus-forge/gui       # vitest run (GUI tests)
npm run lint:fix -w @proteus-forge/cli   # ESLint with auto-fix
npm run typecheck -w @proteus-forge/cli  # TypeScript strict checking
npx vitest run --coverage                # coverage report (run from package dir)
```

Run a single test file or match by name (run from within the package directory):
```bash
npx vitest run src/__tests__/config/project.test.ts
npx vitest run -t "test name pattern"
```

Requires Node.js >= 22.0.0. Minimum **80% coverage** enforced per package.

## Architecture

Three workspace packages under `packages/`:
- **`@proteus-forge/shared`** — types and pure functions (no Node/fs APIs)
- **`@proteus-forge/cli`** — Commander CLI (30 commands). Entry: `packages/cli/src/index.ts`
- **`@proteus-forge/gui`** — Electron + React desktop app. Entry: `packages/gui/electron/main.ts` (main), `packages/gui/src/main.tsx` (renderer)

Cross-package imports use workspace names (`import { StageName } from "@proteus-forge/shared"`). Within a package, relative paths with `.js` extensions.

**Agent SDK integration** via `query()` in `packages/cli/src/session/launcher.ts`. Each stage composes a Lead prompt and launches a Claude Code session with `cwd` set to the target repo and `additionalDirectories` pointing to the source POC (read-only).

**Three-repo separation**: Proteus Forge config at `~/.proteus-forge/`, source POC (never modified), target production repo (agents write here).

## Pipeline Stages

| Stage | Agent Pattern | Model Tier | Key Output |
|-------|---------------|------------|------------|
| Inspect | Agent Team (scout + specialists) | fast | `01-inspect/features.json` |
| Style | Single Lead (auto after inspect) | fast | `02-style/style-guide.json` + `style.md` |
| Design | Agent Team (architect + specialists) | advanced | `02-design/design.md` + `design-meta.json` |
| Plan | Single Lead | standard | `03-plan/plan.json` + `plan.md` |
| Split | Single Lead | standard | `04-tracks/manifest.json` + track files |
| Execute | Agent Team (orchestrator + track engineers) | advanced | Production source + `05-execute/session.json` |

Primary workflow: `setup` → `new` → `use` → `inspect` → (`style` auto-runs) → `design` → `plan` → `split` → `execute`

## Load-Bearing Patterns

- **Prompt generators** (`packages/cli/src/prompts/*.ts`) compose Lead prompts with full artifact schemas embedded inline. These are the highest-leverage files in the codebase.
- **Session launcher** (`src/session/launcher.ts`) **never throws** — always returns `SessionResult` with `success: boolean`.
- **Dual-export convention** — pipeline command files export both `run<Stage>(name, options): Promise<boolean>` (used by `run.ts`) and a Commander `Command` object (used by `index.ts`).
- **Wave checkpoint commits** use the message format `proteus-forge: execute wave N complete`. The `resume` command depends on this exact format — it is load-bearing.
- **Staleness detection** (`src/utils/stages.ts`) compares artifact mtimes to warn when upstream changes invalidate downstream. Also exports `STAGE_DIRS`, `STAGE_ORDER`, `getStageDir()`.
- **CLI public API** (`packages/cli/src/api.ts`) is the sole barrel export. All GUI→CLI calls go through this surface.

## GUI Architecture

- **React + TypeScript** with Vite, **Tailwind CSS** (hand-rolled components, no UI library), **Zustand** stores (project, session, chat)
- **Electron** main process built with tsup (CJS format, config at `packages/gui/tsup.electron.ts`)
- **IPC boundary**: channel types in `packages/shared/src/ipc.ts`, preload in `packages/gui/electron/preload.ts` (uses `satisfies IpcChannel`), handlers in `packages/gui/electron/ipc/` by domain
- Fonts bundled locally (JetBrains Mono, Syne)

## Code Conventions

- **ESM-only** (`"type": "module"`). All imports use `.js` extensions even for `.ts` sources.
- **No barrel exports** (except `packages/cli/src/api.ts`). No path aliases except `#electron` in the GUI package (maps to `electron/` dir). Relative paths only.
- **Unused vars** — prefix with underscore (`_unused`).
- **Strict TypeScript** — `strict: true`, nullable fields use `?` optional syntax.

## Test Patterns

- Tests in `packages/*/src/__tests__/` mirroring source structure. Vitest globals enabled.
- **Integration-style**: real temp dirs via `mkdtemp()`, cleanup in `afterEach`.
- **Mocking**: `vi.spyOn()` for functions, `vi.mock()` at module level for Commander command tests and child components.
- **Commander tests**: `vi.mock(...)` at module level, then `await import(...)` inside test body.
- **GUI component tests**: mock `window.electronAPI` in `beforeEach` *before* importing components (they access it at module load). Use `#electron` path alias for `electron/` dir imports.
- **Gotcha**: `node:child_process` can't be spied on in ESM — use `vi.mock()` with `__esModule: true` in a separate test file.

## Adding a New Command

1. Create `packages/cli/src/commands/mycommand.ts` exporting a Commander `Command`
2. For pipeline stages: also export `run<Stage>(name, options): Promise<boolean>`
3. Register in `src/index.ts` via `program.addCommand()`
4. Write tests in `src/__tests__/`
5. `npm run build -w @proteus-forge/cli` must pass (lint + typecheck + tests)

For new pipeline stages, also: add prompt in `src/prompts/`, update `STAGE_ARTIFACTS`/`STAGE_DIRS`/`STAGE_ORDER` in `src/utils/stages.ts`, add to `run.ts` chain.

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.proteus-forge/config.json` | Global: providers, tiers, role→tier mappings |
| `~/.proteus-forge/projects.json` | Project registry: name → source/target paths |
| `{target}/.proteus-forge/config.json` | Per-project: source path, overrides |
| `{target}/.proteus-forge/costs.json` | Token usage per stage |
| `{target}/.proteus-forge/log.jsonl` | Audit trail (JSONL) |

See `docs/schemas.md` for complete artifact schemas and example payloads.
