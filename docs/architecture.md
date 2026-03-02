# Architecture

Proteus Forge is a thin workflow layer. It does **not** make AI model calls, spawn agents, manage task lists, or handle inter-agent messaging. All of that is delegated to Claude Code Agent Teams.

Proteus Forge is responsible for:

| Proteus Forge Owns | Agent Teams Provides |
|---|---|
| Stage sequencing and validation | Lead/teammate lifecycle |
| Artifact schemas and cross-stage checks | Shared task list with dependencies |
| Prompt generation for Leads and specialists | Peer-to-peer messaging |
| Cost tracking and audit trail | Auto-unblocking of dependent tasks |
| Git checkpointing and recovery | Display modes (in-process, split panes) |
| CLI commands and project management | Teammate spawning and coordination |

## Scout → Specialize → Synthesize

Inspect and design stages use a reusable three-beat pattern:

1. **Scout/Scope**: A single Lead does a fast sweep to identify domains of concern
2. **Specialize**: N specialist teammates work in parallel, messaging each other about cross-domain findings
3. **Synthesize**: The Lead merges all partials into a unified output

## Fresh Agents Per Stage

No agent carries context between stages. Each stage launches a fresh Agent Team that reads the prior stage's artifacts. This keeps stages decoupled and artifacts as the single source of truth.

## Wave-Based Execution

Tasks are grouped into dependency-respecting waves. Agent Teams natively auto-unblocks tasks as dependencies complete. Proteus Forge commits a git checkpoint after each wave for crash recovery.

## File Ownership Isolation

During execute, each track owns specific files. No file appears in more than one track (except `track-shared`, managed by the Lead). This prevents merge conflicts when multiple agents write code in parallel.
