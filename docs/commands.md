# CLI Command Reference

## Global Setup

### `proteus-forge setup`

One-time configuration. Enables Claude Code Agent Teams, detects API keys, and writes default model tier configuration to `~/.proteus-forge/config.json`.

```bash
proteus-forge setup
```

### `proteus-forge config get|set <key> [value]`

Read or modify configuration using dot-notation keys.

```bash
proteus-forge config get tiers.fast
proteus-forge config set tiers.fast.model "claude-haiku-4-5"
proteus-forge config set roles.execute-agent "advanced"
```

## Project Management

### `proteus-forge new <name> --source <path> [--target <path>]`

Create a new Proteus Forge project. Initializes the target repository with git, `.proteus-forge/` directory, and a clean `CLAUDE.md`.

```bash
proteus-forge new my-app --source ~/projects/my-poc
proteus-forge new my-app --source ~/projects/my-poc --target ~/projects/my-app-prod
```

If `--target` is omitted, defaults to `{source-directory}-prod`.

### `proteus-forge list`

Show all registered projects with their current pipeline stage.

```bash
proteus-forge list
```

```
  ● my-app                   /home/user/projects/my-poc-prod        (design)
    other-project            /home/user/projects/other-prod          (new)
```

### `proteus-forge use <name>`

Set the active project. Subsequent commands use this project by default.

```bash
proteus-forge use my-app
```

### `proteus-forge destroy <name>`

Remove a project. Deletes the target directory (with confirmation) and removes it from the registry. The source POC is never touched.

```bash
proteus-forge destroy my-app
```

### `proteus-forge status [name]`

Show pipeline status including stage completion timestamps and staleness warnings.

```bash
proteus-forge status
proteus-forge status my-app
```

## Pipeline Stages

All stage commands accept `[name]` to specify a project (defaults to the active project), `--dry-run` to preview without launching agents, and `--budget <amount>` to set a USD spending cap.

### `proteus-forge inspect [name]`

Launches an Agent Team that analyzes the source POC. A scout agent identifies domains (auth, data, API, frontend, devops, etc.), spawns specialist inspectors in parallel, and synthesizes findings into `features.json`.

```bash
proteus-forge inspect
proteus-forge inspect --dry-run
proteus-forge inspect --budget 2.00
```

Output: `.proteus-forge/01-inspect/features.json` with features, data model, integrations, and known issues.

### `proteus-forge design [name]`

Launches an Agent Team that reads the inspection findings and designs a production architecture. An architect agent scopes design domains, spawns design specialists who negotiate API contracts and data boundaries via peer-to-peer messaging, then synthesizes into `design.md` and `design-meta.json`.

```bash
proteus-forge design
proteus-forge design --brief "Use microservices with Go and gRPC instead of Node.js"
proteus-forge design --brief-file ./architecture-requirements.md
```

The `--brief` and `--brief-file` flags inject user architectural requirements at highest priority. Without a brief, the AI decides the architecture based on the POC analysis.

Output: `.proteus-forge/02-design/design.md` (human-editable) and `design-meta.json` (machine-readable).

### `proteus-forge plan [name]`

Single Lead session that reads the design and produces a task DAG with execution waves.

```bash
proteus-forge plan
```

Output: `.proteus-forge/03-plan/plan.json` (task DAG) and `plan.md` (human-editable narrative).

### `proteus-forge split [name]`

Single Lead session that partitions plan tasks into discipline-specific tracks with file ownership boundaries.

```bash
proteus-forge split
```

Output: `.proteus-forge/04-tracks/manifest.json` and per-discipline track files.

### `proteus-forge execute [name]`

Launches an Agent Team with one teammate per track. The Lead handles shared/scaffolding tasks, then engineers work in parallel respecting the wave-based dependency ordering.

```bash
proteus-forge execute
proteus-forge execute --dry-run
proteus-forge execute --budget 15.00
```

Output: Production source code in the target repository, plus `.proteus-forge/05-execute/session.json`.

### `proteus-forge run [name]`

Run the full pipeline or a range of stages without stopping between them. Auto-detects the next incomplete stage if `--from` is not specified.

```bash
proteus-forge run                                    # full pipeline
proteus-forge run --from inspect --to design         # batch specific stages
proteus-forge run --brief "Use microservices in Go"  # with design requirements
proteus-forge run --budget 5.00                      # per-stage budget cap
```

Stops immediately if any stage fails. The `--brief` and `--brief-file` options are forwarded to the design stage.

## Execution Control

### `proteus-forge inform <agent> <message>`

Send a message to a running teammate during execute. Requires an active execute session.

```bash
proteus-forge inform backend-engineer "Use async bcrypt instead of sync"
proteus-forge inform frontend-engineer "Add aria-labels to all form inputs"
```

Messages are delivered to the Lead via a file-based inbox, then relayed to the named teammate.

### `proteus-forge resume [name]`

Resume execute from the last wave checkpoint. Detects the last `proteus-forge: execute wave N complete` git commit and restarts from wave N+1.

```bash
proteus-forge resume
```

### `proteus-forge abort [name]`

Signal a running execute session to stop. Sends an abort message via the inbox, commits partial progress, and the session will shut down on its next turn.

```bash
proteus-forge abort
```

### `proteus-forge watch [name]`

Monitor a running execute session. Tails `.proteus-forge/log.jsonl` for updates and auto-exits when the session ends.

```bash
proteus-forge watch
```

## Analysis & Review

### `proteus-forge validate [name]`

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

### `proteus-forge review <stage> [name]`

Open a stage's primary artifact in `$EDITOR`.

```bash
proteus-forge review design     # opens design.md
proteus-forge review plan       # opens plan.md
proteus-forge review inspect    # opens features.json
```

### `proteus-forge compare [name]`

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

### `proteus-forge diff <stage> [name]`

Show git changes for a stage's artifacts between the last two commits.

```bash
proteus-forge diff design
proteus-forge diff plan
```

### `proteus-forge explain "<question>" [name]`

Launch an AI session that reads the project artifacts and answers a question about the design or plan.

```bash
proteus-forge explain "why is auth in wave 1?"
proteus-forge explain "what services handle product CRUD?"
```

### `proteus-forge log [name]`

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

### `proteus-forge costs [name]`

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

### `proteus-forge verify [name]`

Run install/build/test/lint checks on the target repository. Use `--fix` to launch an agent that repairs failures.

```bash
proteus-forge verify
proteus-forge verify --fix
```

### `proteus-forge style [name]`

Run standalone style extraction. Produces `02-style/style-guide.json` and `style.md`. Also runs automatically after inspect unless `--exclude-style` is used.

```bash
proteus-forge style
```

### `proteus-forge list-models [name]`

Show tier/model configuration. Use `--available` to fetch available models from the API.

```bash
proteus-forge list-models
proteus-forge list-models --available
```
