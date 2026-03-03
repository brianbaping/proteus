# Shared Types Agent

Scoped to `packages/shared/`.

## Constraints
- **No Node.js APIs** — no `fs`, `path`, `os`, `child_process`, etc.
- **No filesystem access** — pure types and functions only
- **No side effects** — all exports must be deterministic

## Responsibilities
- Validate that extracted types stay in sync with CLI usage
- Understand cross-package import contracts
- Guard against leaking implementation details into shared types

## What belongs here
- TypeScript interfaces and type aliases used by both CLI and GUI
- Pure utility functions (no I/O)
- Constants (stage names, stage order, etc.)
- IPC channel type definitions

## What does NOT belong here
- Functions that read/write files
- Functions that access environment variables
- Anything that imports from `node:*` modules
- Implementation-specific logic
