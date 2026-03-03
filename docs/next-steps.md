# Next Steps

Status as of 2026-03-03. The GUI is functionally complete for the core pipeline flow — all 5 phases run, IPC is wired, session events stream to the chat panel, file drop zones work, export buttons work, and GitHub clone is live. All 5 pipeline phases now have artifact viewers that render results after completion. Abort buttons are live in all 5 phases. Test coverage is 91%+ statements across 155 tests.

Below are the remaining gaps, ordered by impact.

---

## High Priority

### IngestSidebar Path Persistence

The POC path and target path inputs in `IngestSidebar` are local state only. Changing them does not update the project entry. A user who edits the paths and clicks "Run Inspection" still runs against the originally registered paths. Either wire the sidebar inputs to update the project config via IPC, or make them read-only displays of the registered paths.

---

## Medium Priority

### Cost Display

`session-store.ts` tracks `cost` and `duration` per session. `readCosts` IPC is wired. But no component renders cost data anywhere — not in session badges, phase headers, or a dedicated panel. Options:
- Add cost/duration to the `SessionBadge` or `CompleteBar` after a stage finishes
- Add a costs summary view (per-stage breakdown, total spend)

### Staleness Warnings

`project-store.staleness` is fetched on every `refreshStatus()` but never rendered. When upstream artifacts change, downstream phases should show a warning badge or banner (e.g., "Design is stale — inspect artifacts changed since last run").

### Revert / Destroy Phase Wiring

`CompleteBar` has a "Destroy Phase & Revert" button, but `handleDestroy` in `App.tsx` only navigates the phase tab backward and refreshes status. It does not call any IPC to actually remove stage artifacts. Need a `stage:revert` IPC handler that calls the CLI's `revert` logic.

### Archive Upload Flow

The "Upload Archive" ingest mode uses `FileDropZone` to get a file path but never extracts it. Need an IPC handler to unpack `.zip` / `.tar.gz` archives into a working directory, then set that as the POC path.

---

## Low Priority

### E2E Tests

`packages/gui/e2e/` exists but is empty. No Playwright dependency, no config, no test scripts. The CLAUDE.md documents the intended setup (`electron-playwright`). Worth setting up once the artifact viewers are in place so there are meaningful user flows to test.

### Settings / Config Panel

`readGlobalConfig` IPC exists but nothing in the UI reads or displays it. A settings panel would let users manage API keys, model tier assignments, and provider config without dropping to the CLI.

### Session ID Surfacing

`stage:run` returns `sessionId: ""` (hardcoded). The CLI launcher captures real session IDs — surface them in the GUI for debugging and log correlation.

### Inspection Data Gaps

`InspectionPhase` hardcodes `linesOfCode: 0` and `fileTree: []` because `features.json` doesn't carry that data. Either enrich the inspect prompt to produce these fields, or remove the dead UI sections.

### shadcn/ui

CLAUDE.md mentions shadcn/ui for base components but none are installed. Either adopt it (cleaner primitives for dialogs, buttons, badges) or update the docs to reflect the hand-rolled Tailwind approach.

---

## CLI

### In-place Dashboard

Replace the scrolling agent dashboard with a fixed-line display using ANSI cursor-up sequences. Each agent gets a pinned terminal line that updates in place. Fall back to scrolling when `!process.stdout.isTTY`. (From `docs/future.md`.)
