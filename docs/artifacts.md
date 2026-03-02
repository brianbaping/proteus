# Artifact Structure

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

## Schema Reference

See [schemas.md](./schemas.md) for complete artifact schemas, validation rules, and example payloads for all five stages.
