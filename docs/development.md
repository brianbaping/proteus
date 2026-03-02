# Development

## Monorepo Structure

Three workspace packages under `packages/`:

| Package | Purpose |
|---------|---------|
| `@proteus-forge/cli` | CLI entry point (Commander + all commands) |
| `@proteus-forge/shared` | Types and pure functions shared between CLI and GUI |
| `@proteus-forge/gui` | Electron + React desktop application |

## Build & Test

From the repo root:

```bash
npm install                              # install all workspace dependencies
npm run build -w @proteus-forge/shared   # build shared types
npm run build -w @proteus-forge/cli      # lint → typecheck → test → bundle
npm run dev -w @proteus-forge/gui        # Vite + Electron dev mode
npm run test -w @proteus-forge/cli       # vitest run (CLI tests)
npm run test -w @proteus-forge/gui       # vitest run (GUI tests)
```

Per-package commands remain the same when run from within the package directory.

## Scripts (CLI)

| Script | Description |
|--------|-------------|
| `npm run build` | Full pipeline: lint + typecheck + test + tsup bundle |
| `npm run dev` | Watch mode (tsup) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run typecheck` | TypeScript strict checking |
| `npm run test` | Vitest (single run) |
| `npm run test:watch` | Vitest (watch mode) |

## Testing

106 tests across 12 test files using [Vitest](https://vitest.dev/):

```bash
npm run test -w @proteus-forge/cli
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

## Project Structure (CLI)

```
packages/cli/src/
├── index.ts                    # CLI entry point (Commander)
├── api.ts                      # Public API barrel export for GUI
├── commands/                   # 24 command handlers
│   ├── setup.ts, config.ts
│   ├── new.ts, list.ts, use.ts, destroy.ts
│   ├── inspect.ts, design.ts, plan.ts, split.ts, execute.ts, run.ts
│   ├── inform.ts, resume.ts, abort.ts, watch.ts
│   ├── status.ts, validate.ts, review.ts, diff.ts
│   └── compare.ts, costs.ts, explain.ts, log.ts
├── config/                     # Configuration management
│   ├── types.ts                # TypeScript interfaces
│   ├── global.ts               # ~/.proteus-forge/config.json
│   ├── project.ts              # {target}/.proteus-forge/config.json
│   └── registry.ts             # ~/.proteus-forge/projects.json
├── prompts/                    # Agent prompt generators
│   ├── inspect.ts, design.ts, plan.ts, split.ts, execute.ts
│   ├── style.ts, verify-fix.ts
├── session/
│   └── launcher.ts             # Agent SDK wrapper (query + inbox streaming)
├── utils/
│   ├── claude-settings.ts      # ~/.claude/settings.json management
│   ├── costs.ts, git.ts, inbox.ts, log.ts
│   ├── resolve-project.ts, stages.ts, team-summary.ts
│   ├── dashboard.ts, progress.ts, ansi.ts
│   ├── terminal-reporter.ts    # ProgressReporter for CLI
│   └── model-resolution.ts, models-api.ts
└── __tests__/                  # 12 test files, 106 tests
```

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/claude-agent-sdk` | ^0.1.0 | Claude Code Agent Teams integration |
| `commander` | ^13.0.0 | CLI framework |
| `typescript` | ^5.7.0 | Language (strict mode) |
| `tsup` | ^8.0.0 | Bundler |
| `eslint` | ^10.0.0 | Linter |
| `vitest` | ^4.0.18 | Test framework |

## Code Coverage

Minimum **80% coverage** enforced per package via `vitest.config.ts`:

```bash
npx vitest run --coverage    # from within any package directory
```
