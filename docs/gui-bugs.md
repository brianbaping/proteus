# GUI Bug Tracker

Bug log for GUI manual validation. See [`docs/gui-testing-guide.md`](gui-testing-guide.md) for process.

## Summary

| Severity | Open | Fixed | Won't Fix |
|----------|------|-------|-----------|
| Blocker  | 0    | 2     | 0         |
| Bug      | 0    | 0     | 0         |
| Cosmetic | 0    | 0     | 0         |

## Bugs

### BUG-001: Artifacts not displayed for completed project stages

- **Layer:** Build config
- **Severity:** Blocker
- **Status:** Fixed
- **Screenshot:** `docs/screenshots/BUG-001-a.png`, `BUG-001-b.png`
- **Steps to reproduce:**
  1. Open the app via `npm run dev -w @proteus-forge/gui`
  2. Select a previously completed project (stages run via CLI)
  3. Tabs indicate stage completion, but no artifacts appear in the artifact canvas
  4. Expected: artifacts (features.json, design.md, etc.) should render in the canvas
- **Root cause:** `VITE_DEV_SERVER_URL` was never injected into the Electron main process during dev mode. `electron/main.ts` checks this env var to decide whether to load from Vite dev server or static build. Without it, Electron loaded the stale static build from `dist/renderer/`, which didn't reflect current code.
- **Fix:** Added `env` option to `tsup.electron.ts` that sets `VITE_DEV_SERVER_URL=http://localhost:5173` when running in watch/dev mode.

### BUG-002: Renderer crash when knownIssues contains objects instead of strings

- **Layer:** UI
- **Severity:** Blocker
- **Status:** Fixed
- **Steps to reproduce:**
  1. Switch to packer project (which has object-shaped knownIssues in features.json)
  2. Click Inspection tab
  3. Renderer crashes — blank screen, React error about objects not valid as React children
- **Root cause:** `featuresJsonToInspectionData` assumes `knownIssues` is `string[]`, but agent output varies — some projects produce `{severity, category, description}` objects.
- **Fix:** Handle both shapes in the transform function.

<!-- Next ID: BUG-003 -->

