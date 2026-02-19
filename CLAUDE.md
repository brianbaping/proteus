# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Proteus?

Proteus is a standalone CLI tool that transforms POC/prototype codebases into production-ready applications using coordinated AI agent teams. It is built entirely on Claude Code Agent Teams — Proteus generates team configurations and launches Agent Teams sessions, delegating all orchestration, messaging, and task management to Agent Teams.

## Architecture

- **Standalone CLI**: Installed globally via `npm install -g proteus`. Global config at `~/.proteus/`.
- **Agent Teams-centric**: All parallel work uses Claude Code Agent Teams (Lead + Teammates). No fallback mode.
- **Three-repo separation**: Source (POC, read-only) and target (production, agents write here) are always separate directories. Proteus never modifies the source.
- **Provider-agnostic**: Model tiers (`fast`/`standard`/`advanced`) mapped to any AI provider. Configured in `~/.proteus/config.json`.
- **Fresh agents per stage**: No agent continuity across stages. Artifacts are the complete source of truth.

## Pipeline Stages

1. **`proteus inspect`** — Agent Team (scout → specialists → synthesize). Analyzes the source POC, identifies domains, produces `features.json`.
2. **`proteus design`** — Agent Team (scope → specialists → synthesize). Generates architecture (`design.md` + `design-meta.json`). Human-editable.
3. **`proteus plan`** — Single Lead. Generates task DAG with execution waves (`plan.json` + `plan.md`). Human-editable.
4. **`proteus split`** — Single Lead. Partitions tasks into discipline tracks with file ownership boundaries.
5. **`proteus execute`** — Agent Team (orchestrator + track teammates). Wave-based parallel code generation with checkpointing.

## Key Concepts

- **Scout → Specialize → Synthesize**: Reusable pattern for inspect and design. Scout identifies domains, specialists work in parallel with peer-to-peer messaging, Lead synthesizes.
- **Wave-based execution**: Tasks are grouped into dependency-respecting waves. Agent Teams auto-unblocks tasks as dependencies complete.
- **File ownership isolation**: No file appears in more than one track. `track-shared` handles cross-cutting files, managed by the Lead.
- **Two-tier testing**: `unit` tests written by implementing agents; `integration` tests written by QA track.
- **Wave-level checkpointing**: Git commits after each wave for crash recovery via `proteus resume`.
- **Staleness warnings**: Proteus detects when upstream artifacts are modified after downstream artifacts were generated.

## Cross-Referencing IDs

`feat-NNN` (features), `svc-xxx` (services), `task-NNN` (tasks), `track-xxx` (tracks), `domain-xxx` (inspection/design domains).

## Schema Reference

See `proteus-schemas.md` for complete artifact schemas, CLI command reference, and configuration details.
