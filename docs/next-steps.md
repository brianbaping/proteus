# Next Steps

Status as of 2026-03-03. The GUI is functionally complete for the core pipeline flow — all 5 phases run, IPC is wired, session events stream to the chat panel, file drop zones work, export buttons work, and GitHub clone is live. All 5 pipeline phases have artifact viewers that render results after completion. Abort buttons are live in all 5 phases. IngestSidebar path persistence is wired (blur dirty-check + browse/clone flows). Cost and duration display inline in the CompleteBar after each stage finishes. Session IDs from the Claude Agent SDK are persisted to `costs.json` and surfaced in the CompleteBar for debugging and log correlation. Staleness warnings render in design, plan, split, and execute canvases when upstream artifacts have changed. Revert/Destroy Phase button is wired to the CLI revert logic via `stage:revert` IPC — confirms with `window.confirm()`, removes downstream artifacts, costs, and commits. Archive upload extracts `.zip`/`.tar.gz`/`.tgz` archives via `project:extract-archive` IPC, unwraps single top-level directories, and persists the extracted path as the POC source. Settings dialog (gear icon in TopBar) lets users manage providers (API keys), tiers (fast/standard/advanced model assignments), and roles (role→tier mappings) — full parity with `~/.proteus-forge/config.json`. Inspect prompt now produces `totalLines` and `fileTree` in `features.json`, so the InspectionCanvas "Lines of Code" stat and "File Structure" section render real data.

Below are the remaining gaps, ordered by impact.

---

## Deferred

### E2E Tests

`packages/gui/e2e/` exists but is empty. No Playwright dependency, no config, no test scripts. The CLAUDE.md documents the intended setup (`electron-playwright`). Worth setting up once the artifact viewers are in place so there are meaningful user flows to test.
