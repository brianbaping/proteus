# Proteus Forge User Guide

This guide walks you through using Proteus Forge to transform a proof-of-concept into a production application. It starts with a quickstart for the impatient, then covers each workflow in detail.

> **Reference docs:** [CLI Commands](commands.md) · [Architecture](architecture.md) · [Artifacts](artifacts.md) · [Model Tiers](model-tiers.md) · [Cost Tracking](cost-tracking.md) · [Schemas](schemas.md)

---

## Quickstart

Go from zero to production code in five minutes.

```bash
# 1. Install
git clone https://github.com/brianbaping/proteus.git
cd proteus
npm install && npm run build && npm link

# 2. One-time setup — configures providers, API key, model tiers
proteus-forge setup

# 3. Create a project
proteus-forge new my-app --source ~/projects/my-poc

# 4. Run the full pipeline
proteus-forge run

# 5. Check what you got
proteus-forge status
proteus-forge compare
proteus-forge costs
```

That's it. Your production code is in the target directory (defaults to `~/projects/my-poc-prod`). The rest of this guide explains how to control every step.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Creating a Project](#creating-a-project)
4. [Running the Pipeline](#running-the-pipeline)
5. [Working Stage by Stage](#working-stage-by-stage)
6. [Editing Artifacts Between Stages](#editing-artifacts-between-stages)
7. [Providing Design Requirements](#providing-design-requirements)
8. [Monitoring a Running Session](#monitoring-a-running-session)
9. [Sending Messages to Agents](#sending-messages-to-agents)
10. [Recovering from Failures](#recovering-from-failures)
11. [Re-running a Stage](#re-running-a-stage)
12. [Rolling Back the Pipeline](#rolling-back-the-pipeline)
13. [Verifying Production Output](#verifying-production-output)
14. [Asking Questions About the Design](#asking-questions-about-the-design)
15. [Comparing Source and Target](#comparing-source-and-target)
16. [Configuring Models and Tiers](#configuring-models-and-tiers)
17. [Managing Multiple Projects](#managing-multiple-projects)
18. [Tracking Costs](#tracking-costs)
19. [Viewing the Audit Log](#viewing-the-audit-log)
20. [Using the Desktop GUI](#using-the-desktop-gui)

---

## Prerequisites

- **Node.js** >= 22.0.0
- **Claude Code** installed with a valid API key
- An `ANTHROPIC_API_KEY` environment variable (or configure via `proteus-forge setup`)

---

## Initial Setup

Run setup once after installation:

```bash
proteus-forge setup
```

This does three things:
1. Enables Agent Teams in your Claude Code settings
2. Prompts for your Anthropic API key (or reads `ANTHROPIC_API_KEY` from your environment)
3. Creates `~/.proteus-forge/config.json` with default model tier assignments:
   - **fast** → `claude-haiku-4-5` (used for inspect)
   - **standard** → `claude-sonnet-4-6` (used for style, plan, split)
   - **advanced** → `claude-opus-4-6` (used for design, execute)

You can change these later — see [Configuring Models and Tiers](#configuring-models-and-tiers).

---

## Creating a Project

```bash
proteus-forge new my-app --source ~/projects/my-poc
```

This registers a project with:
- **Source**: your POC directory (mounted read-only — never modified)
- **Target**: where production code will be built (defaults to `{source}-prod`)

To specify a custom target path:

```bash
proteus-forge new my-app --source ~/projects/my-poc --target ~/projects/my-app-prod
```

The target directory is initialized with a git repo, a `.proteus-forge/` config directory, and a `CLAUDE.md` for agent guidance. The project is automatically set as active.

---

## Running the Pipeline

### Full pipeline in one command

```bash
proteus-forge run
```

This runs all five stages sequentially: inspect → design → plan → split → execute. If any stage fails, the pipeline stops and you can fix the issue and resume.

### With options

```bash
# Provide design requirements upfront
proteus-forge run --brief "Use Go with gRPC, PostgreSQL, and React frontend"

# Or load requirements from a file
proteus-forge run --brief-file ~/notes/architecture-requirements.md

# Run a subset of stages
proteus-forge run --from design --to split

# Set a per-stage budget cap (USD)
proteus-forge run --budget 5.00

# Override the model tier for all stages
proteus-forge run --tier advanced
```

### Auto-detection

If you've already completed some stages, `run` picks up where you left off. It detects the next incomplete stage and starts from there.

---

## Working Stage by Stage

For more control, run each stage individually. This lets you review and edit artifacts between stages.

### Stage 1: Inspect

```bash
proteus-forge inspect
```

An agent team (scout + domain specialists) analyzes your POC. The scout identifies domains in the codebase, then spawns specialist inspectors for each domain. Results are synthesized into a feature inventory.

**Output:** `.proteus-forge/01-inspect/`
- `features.json` — feature inventory, data model, integrations, known issues
- `inspect.md` — human-readable summary

Style extraction runs automatically after inspect (unless `--exclude-style`).

### Stage 2: Design

```bash
proteus-forge design
```

An architect agent and design specialists produce a production architecture. The architect scopes domains, then specialists negotiate contracts via peer-to-peer messaging.

**Output:** `.proteus-forge/02-design/`
- `design.md` — architecture blueprint (human-editable)
- `design-meta.json` — service definitions, API contracts, feature-to-service mapping

### Stage 3: Plan

```bash
proteus-forge plan
```

A single lead agent generates a task DAG with execution waves and dependencies.

**Output:** `.proteus-forge/03-plan/`
- `plan.json` — task graph with waves, dependencies, acceptance criteria
- `plan.md` — narrative plan (human-editable)

### Stage 4: Split

```bash
proteus-forge split
```

A single lead agent partitions tasks into discipline tracks (backend, frontend, data, devops, QA) with file ownership so agents don't conflict.

**Output:** `.proteus-forge/04-tracks/`
- `manifest.json` — track definitions and assignments
- Individual track files (e.g., `backend.json`, `frontend.json`)

### Stage 5: Execute

```bash
proteus-forge execute
```

An orchestrator launches parallel track engineers — one per discipline. They write production code wave by wave, with git checkpoints after each wave.

**Output:** Production source code in the target repo, plus `.proteus-forge/05-execute/`
- `session.json` — execution summary
- `execute.md` — narrative log

Post-execute verification runs automatically (npm install → build → test → lint) unless you pass `--skip-verify`.

### Common stage options

All stage commands accept:

```bash
--dry-run           # Preview what would happen without launching agents
--budget <amount>   # USD spending cap for this stage
--tier <tier>       # Override model tier (fast, standard, advanced)
--model <model>     # Override model directly (e.g., claude-opus-4-6)
```

---

## Editing Artifacts Between Stages

The key artifacts — `design.md` and `plan.md` — are intentionally human-editable. This is where you make architectural decisions before any code is written.

### Open an artifact in your editor

```bash
proteus-forge review design    # opens design.md in $EDITOR
proteus-forge review plan      # opens plan.md in $EDITOR
```

Supported stages: `inspect`, `style`, `design`, `plan`, `split`, `execute`.

### Typical workflow

1. Run `inspect` and `design`
2. Review and edit `design.md` — adjust service boundaries, tech stack choices, API contracts
3. Run `plan`
4. Review and edit `plan.md` — reorder tasks, adjust wave groupings, modify acceptance criteria
5. Run `split` and `execute`

After editing, downstream stages will show staleness warnings reminding you to re-run them:

```bash
proteus-forge status
# ✓ inspect     (3/9/2026, 2:34 PM)
# ✓ design      (3/9/2026, 2:50 PM)  ← modified after plan was generated
# ⚠ plan        (3/9/2026, 3:17 PM)  stale: upstream design was modified
# ○ split
```

---

## Providing Design Requirements

Guide the architecture by providing a design brief:

```bash
# Inline
proteus-forge design --brief "Use microservices with Go and gRPC. PostgreSQL for persistence. React frontend with TanStack Router."

# From a file
proteus-forge design --brief-file ~/notes/architecture.md
```

The brief is included in the architect's prompt. You can also pass it via `run`:

```bash
proteus-forge run --brief "Monolith with Next.js and Prisma"
```

---

## Monitoring a Running Session

During `execute`, you can watch agent activity in real time:

```bash
proteus-forge watch
```

This tails the audit log with a 2-second poll interval, showing the last 5 entries on start. It auto-exits when the session completes.

### Check pipeline status

```bash
proteus-forge status
```

Shows each stage's completion state, timestamps, and staleness warnings.

---

## Sending Messages to Agents

During an active `execute` session, you can send messages to specific agents:

```bash
proteus-forge inform backend-engineer "Use async bcrypt for password hashing"
proteus-forge inform frontend-engineer "The design system uses Radix UI primitives"
```

Messages are delivered through an inbox system — the orchestrator relays them to the specified teammate on its next turn.

---

## Recovering from Failures

### Resume from a crash

If `execute` fails or is interrupted, resume from the last wave checkpoint:

```bash
proteus-forge resume
```

Git commits mark each completed wave (`proteus-forge: execute wave N complete`). Resume detects the last checkpoint and restarts from the next wave. Completed work is preserved.

### Abort a running session

```bash
proteus-forge abort
```

This signals the session to stop gracefully. Completed waves are preserved. You can resume later.

### Fix verification failures

If post-execute verification fails:

```bash
# See what failed
proteus-forge verify --verbose

# Launch an agent to fix failures automatically
proteus-forge verify --fix

# Fix with a budget cap
proteus-forge verify --fix --budget 2.00
```

The fix agent reads the failure output, makes corrections, and re-runs verification.

---

## Re-running a Stage

To re-run a single stage without touching downstream artifacts:

```bash
proteus-forge reset design    # removes design artifacts only
proteus-forge design          # re-run design
```

Downstream stages are marked as stale but not deleted. This is useful when you want to regenerate one stage's output and then decide whether to propagate changes.

---

## Rolling Back the Pipeline

To roll back to a specific stage, removing it and everything downstream:

```bash
proteus-forge revert design
```

This removes `02-design/`, `03-plan/`, `04-tracks/`, and `05-execute/` artifacts — taking you back to a completed `inspect` state. You'll need to re-run from `design` onward.

---

## Verifying Production Output

After `execute`, verification runs automatically. You can also run it manually:

```bash
proteus-forge verify              # run install → build → test → lint
proteus-forge verify --verbose    # show full output for failed steps
proteus-forge verify --skip-install  # skip npm install
```

To auto-fix failures:

```bash
proteus-forge verify --fix
```

This launches a Claude Code session that reads the failure output, edits the production code, and re-runs verification.

---

## Asking Questions About the Design

Use `explain` to ask natural-language questions about any artifact:

```bash
proteus-forge explain "Why is auth in wave 1?"
proteus-forge explain "What services handle product CRUD?"
proteus-forge explain "How does the frontend talk to the API?"
```

The agent reads your project's features, design, plan, and track artifacts to answer. Useful for onboarding or reviewing decisions you made earlier in the pipeline.

---

## Comparing Source and Target

See how the production output compares to the original POC:

```bash
proteus-forge compare
```

Example output:

```
Source: 13 files, ~261 lines
Target: 109 files, ~9,430 lines
Growth: 8.4x files, 36.1x lines

Production structure:
  client    46 files
  server    40 files
  shared    11 files
```

### View git changes for a specific stage

```bash
proteus-forge diff design    # show what changed in the last design run
proteus-forge diff execute   # show what the execute stage produced
```

---

## Configuring Models and Tiers

Proteus Forge uses a three-tier model system. Each pipeline phase maps to a tier, and each tier maps to a specific model.

### View current configuration

```bash
proteus-forge list-models
```

Shows tier-to-model mappings and phase-to-tier assignments.

### Fetch available models

```bash
proteus-forge list-models --available
```

Queries the Anthropic API for all models you have access to.

### Change a tier's model

```bash
proteus-forge config set tiers.fast.model "claude-haiku-4-5"
proteus-forge config set tiers.advanced.model "claude-opus-4-6"
```

### Change a phase's tier

```bash
proteus-forge config set phases.inspect "standard"    # use Sonnet for inspect instead of Haiku
proteus-forge config set phases.execute "advanced"    # ensure execute uses Opus
```

### Auto-refresh from the API

```bash
proteus-forge config refresh-models
```

Fetches the latest models from Anthropic and updates tier assignments.

### One-off overrides

Override the model for a single command without changing config:

```bash
proteus-forge design --tier advanced
proteus-forge execute --model claude-opus-4-6
```

### Per-project overrides

Edit `{target}/.proteus-forge/config.json` to override phases for a specific project:

```json
{
  "overrides": {
    "phases": {
      "execute": { "provider": "anthropic", "model": "claude-opus-4-6" }
    }
  }
}
```

---

## Managing Multiple Projects

### List all projects

```bash
proteus-forge list
```

Shows all registered projects with their target paths, current pipeline stage, and which one is active.

### Switch active project

```bash
proteus-forge use my-other-app
```

All subsequent commands (without an explicit name) operate on this project.

### Run a command against a specific project

Most commands accept an optional project name:

```bash
proteus-forge status my-app
proteus-forge inspect my-app
proteus-forge costs my-app
```

### Move a project's target directory

```bash
proteus-forge retarget /new/path my-app --move    # physically move the directory
proteus-forge retarget /new/path my-app            # just update the registry (dir must already exist)
```

### Delete a project

```bash
proteus-forge destroy my-app
```

Removes the target directory and unregisters the project. Your source POC is never touched.

---

## Tracking Costs

### View cost breakdown

```bash
proteus-forge costs
```

Example output:

```
inspect    $  0.76   4m 11s     single session   23K in / 50K out
design     $  0.00   11m 41s    single session
execute    $  2.14   21m 48s    5 teammates
─────────────────────────────────────────────────
Total      $  2.90
```

### Set budget caps

Limit spending per stage:

```bash
proteus-forge execute --budget 5.00
proteus-forge run --budget 3.00          # applies per stage, not total
```

### Cost tracking files

Per-project costs are stored in `{target}/.proteus-forge/costs.json`. Resetting a stage removes its cost entry.

---

## Viewing the Audit Log

Every action is logged to `{target}/.proteus-forge/log.jsonl`:

```bash
proteus-forge log              # show all entries
proteus-forge log -n 10        # show last 10 entries
```

Example output:

```
3/9/2026, 2:34 PM  ✓ inspect     4m 11s  $0.76
3/9/2026, 2:50 PM  ✓ design      11m 41s
3/9/2026, 3:17 PM  ✗ plan        2m 3s   $0.12  — timeout
3/9/2026, 3:20 PM  ✓ plan        5m 22s  $0.31
```

Status icons: ✓ success, ⚠ recovered, ✗ failed.

---

## Using the Desktop GUI

Proteus Forge includes an Electron desktop app that provides a visual interface for the same pipeline.

### Launch the GUI

```bash
# Development mode (hot-reload)
npm run dev -w @proteus-forge/gui

# Production build
npm run build -w @proteus-forge/gui
```

### GUI features

- **Stage tabs** — click through inspect, design, plan, split, execute stages to view artifacts
- **Run/Destroy buttons** — launch or revert stages from the toolbar
- **Agent activity tree** — watch agent teams work in real time during execute
- **Chat panel** — collapsible bottom panel for conversational interaction
- **Log tab** — view persisted session logs per stage with export
- **Settings** — configure providers, tiers, phase assignments, and themes
- **Theme system** — 6 color themes (dark, light, hotdog, synthwave, solarized, forest)
- **Zoom controls** — adjust UI scale for your display

The GUI calls the same CLI functions under the hood — anything you can do in the terminal, you can do in the GUI.

---

## Tips

- **Edit before you execute.** The highest-leverage moment is after `design` and `plan`. Read the artifacts, adjust them, then continue. Once `execute` starts, you're steering with `inform` messages rather than editing blueprints.

- **Start with `--dry-run`.** Every stage command supports `--dry-run` to preview what would happen without spending tokens.

- **Use `explain` liberally.** If you're unsure why the plan looks the way it does, ask. It's cheaper than re-running a stage.

- **Budget conservatively at first.** Use `--budget` to cap early runs while you learn what each stage costs for your codebase size.

- **Check `validate` before execute.** Run `proteus-forge validate` to catch cross-stage inconsistencies (dangling dependencies, missing feature mappings) before committing to an expensive execute run.

- **Keep your POC clean.** Proteus Forge analyzes whatever is in the source directory. Remove experimental branches, dead code, or unrelated files before running `inspect` for better results.
