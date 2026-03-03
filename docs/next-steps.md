# Next Steps

Status as of 2026-03-03. The GUI is functionally complete for the core pipeline flow — all 5 phases run, IPC is wired, session events stream to the chat panel, file drop zones work, export buttons work, and GitHub clone is live. All 5 pipeline phases have artifact viewers that render results after completion. Abort buttons are live in all 5 phases. IngestSidebar path persistence is wired (blur dirty-check + browse/clone flows). Cost and duration display inline in the CompleteBar after each stage finishes. Staleness warnings render in design, plan, split, and execute canvases when upstream artifacts have changed. Revert/Destroy Phase button is wired to the CLI revert logic via `stage:revert` IPC — confirms with `window.confirm()`, removes downstream artifacts, costs, and commits. Archive upload extracts `.zip`/`.tar.gz`/`.tgz` archives via `project:extract-archive` IPC, unwraps single top-level directories, and persists the extracted path as the POC source.

Below are the remaining gaps, ordered by impact.

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
