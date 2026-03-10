# GUI Bug Tracker

Bug log for GUI manual validation. See [`docs/gui-testing-guide.md`](gui-testing-guide.md) for process.

## Summary

| Severity | Open | Fixed | Closed | Won't Fix |
|----------|------|-------|--------|-----------|
| Blocker  | 0    | 3     | 0      | 0         |
| Bug      | 0    | 4     | 1      | 1         |
| Cosmetic | 4    | 5     | 0      | 0         |

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

### BUG-003: New project stuck on Execution tab with no way to navigate back

- **Layer:** UI
- **Severity:** Blocker
- **Status:** Fixed
- **Steps to reproduce:**
  1. View a fully completed project (lands on Execution tab)
  2. Create or switch to a new project with no completed stages
  3. App stays on Execution tab, tabs are not clickable
- **Root cause:** Two issues: (1) App.tsx auto-navigation useEffect didn't reset to inspect when no stages were complete, retaining the previous project's tab. (2) PhaseTabStrip locked all tabs that weren't complete, with no way to reach the first runnable stage.
- **Fix:** Added `else { setActivePhase("inspect") }` in App.tsx. PhaseTabStrip now unlocks the first stage whose prerequisites are all complete (the "next to run" stage).

### BUG-004: New project creates wrong target folder name

- **Layer:** IPC
- **Severity:** Bug
- **Status:** Won't Fix — could not reproduce, likely stale data from earlier test
- **Steps to reproduce:**
  1. Create a new project via the GUI dialog
  2. Target folder is created as `is-gui-test` instead of `<project-name>-prod`
- **Root cause:** TBD
- **Fix:** TBD

### BUG-005: Browse button in IngestSidebar opens at root instead of project path

- **Layer:** UI
- **Severity:** Cosmetic
- **Status:** Fixed — verify on Windows
- **Steps to reproduce:**
  1. Open a project on the Inspection tab
  2. Click Browse for POC or Candidate path
  3. Dialog opens at filesystem root instead of near the current path value
- **Root cause:** `dialog:open-directory` IPC handler doesn't accept or pass a `defaultPath` to Electron's `showOpenDialog`.
- **Fix:** Pass current path value to IPC, use as `defaultPath` in dialog options. Verify behavior on native Windows.

### BUG-006: Agent names in AI Chat panel not color-coded

- **Layer:** UI
- **Severity:** Cosmetic
- **Status:** Fixed
- **Steps to reproduce:**
  1. Run a pipeline stage (e.g., inspect) from the GUI
  2. Observe agent activity messages in the AI Chat panel
  3. All agent names appear in plain text — no color differentiation
  4. Expected: agent names should be color-coded like the CLI's AgentDashboard output
- **Root cause:** `ChatMessage` only stored `role` and `text`. `App.tsx` discarded `agentName`/`agentColor` from `SessionEvent` when calling `addMessage`. `AIChatPanel` rendered a generic green "AI" label for all AI messages.
- **Fix:** Extended `ChatMessage` with optional `agentName`/`agentColor`. `App.tsx` passes agent metadata from `SessionEvent` for agent-spawned/activity/done events. `AIChatPanel` displays the agent name with inline color styling, falling back to green "AI" for reporter messages.

### BUG-007: AI Chat panel truncates message text

- **Layer:** UI
- **Severity:** Cosmetic
- **Status:** Fixed
- **Steps to reproduce:**
  1. Run a pipeline stage from the GUI
  2. Observe messages in the AI Chat panel
  3. Long messages are truncated at a character limit
  4. Expected: full message text should be visible (with scrolling if needed)
- **Root cause:** Chat message rendering applies a character length truncation.
- **Fix:** Replaced flat AIChatPanel with per-agent AgentActivityTree rendered in the phase canvas. Messages are fully visible in the scrollable canvas area with no truncation.

### BUG-008: AI Chat panel is not resizable

- **Layer:** UI
- **Severity:** Cosmetic
- **Status:** Fixed
- **Steps to reproduce:**
  1. Open the app
  2. AI Chat panel is fixed at 220px height
  3. No way to drag or resize the panel
  4. Expected: user should be able to resize the chat panel height
- **Root cause:** AIChatPanel height is hardcoded to `h-[220px]` with no resize handle.
- **Fix:** Replaced 220px AIChatPanel with a thin ~40px MessageStrip for sending messages. Agent activity now renders in the scrollable phase canvas via AgentActivityTree, so resizing is no longer needed.

### BUG-009: Phase progression state machine missing

- **Layer:** UI / Store
- **Severity:** Bug
- **Status:** Fixed
- **Steps to reproduce:**
  1. Run inspect stage from the GUI
  2. Stage completes successfully
  3. App automatically navigates to the Design tab instead of staying on Inspection
  4. Run/Complete buttons don't follow the correct enabled/disabled states
  5. Next tab unlocks without user clicking "Complete Phase & Unlock Next"
- **Expected state machine:**
  - **Not started**: Run button enabled, Complete button disabled, next tab locked
  - **Running**: Run replaced by Stop/Abort button (enabled), Complete disabled, next tab locked
  - **Finished**: Run disabled, Complete button enabled, next tab locked
  - **User clicks Complete**: Run disabled, Complete disabled, next tab unlocked
- **Root cause:** Three issues: (1) App.tsx auto-navigation `useEffect` fired on every `stageStatuses` change, advancing tabs on stage completion. (2) No state machine governed button enablement or user-controlled tab unlocking. (3) `loadRegistry` updated `activeProjectName` without clearing stale `stageStatuses`, causing the project-switch effect to navigate using the previous project's data.
- **Fix:** Added `completedStages` to session store tracking user-explicit phase completion. Replaced auto-advance effect with project-switch effect guarded by a ref. `loadRegistry` now atomically clears `stageStatuses`, `staleness`, `costs`, and `completedStages` when setting a new project. PhaseTabStrip uses `completedStages` for tab state. CompleteBar and all 5 phase Run buttons disabled when phase is user-completed. `handleComplete` calls `completeStage()` and updates `lastCompletedStage` in the registry. CLI pipeline commands also update `lastCompletedStage` on success.

### BUG-010: No model selector for pipeline phases

- **Layer:** UI
- **Severity:** Cosmetic
- **Status:** Fixed
- **Steps to reproduce:**
  1. Open any pipeline phase
  2. No way to select which model to use for the stage
  3. Expected: a way to configure which model runs for each phase
- **Root cause:** Settings had a "Roles" tab mapping agent names (scout, design-specialist, etc.) to tiers, but these roles don't map to anything meaningful — all agents in a session share one model. The real unit of model selection is the pipeline phase.
- **Fix:** Replaced Roles with Phases tab in Settings. Each phase (inspect, style, design, plan, split, execute) maps to a tier or custom model. `resolveModel()` now takes a phase name. Legacy `roles` configs are auto-migrated on read.

### BUG-011: No way to capture or select AI Chat log content

- **Layer:** UI
- **Severity:** Cosmetic
- **Status:** Open
- **Steps to reproduce:**
  1. Run a pipeline stage
  2. Agent activity populates the AI Chat panel
  3. No way to select all text or export/save the chat log
  4. Expected: either a log file toggle to persist the chat log, or a select-all ability in the chat window
- **Root cause:** AIChatPanel has no export/copy mechanism and text selection may be limited.
- **Fix:** Add either a "Save Log" toggle/button that writes chat content to a file, or enable select-all (Ctrl+A) within the chat panel.

### BUG-012: No way to increase or decrease GUI font size

- **Layer:** UI
- **Severity:** Cosmetic
- **Status:** Open
- **Steps to reproduce:**
  1. Open the app
  2. No way to increase or decrease the font size of the GUI
  3. Expected: user should be able to adjust font size (e.g., Ctrl+/Ctrl- or a settings control)
- **Root cause:** No font size scaling mechanism is implemented.
- **Fix:** Add font size controls — either keyboard shortcuts (Ctrl+Plus/Ctrl+Minus/Ctrl+0) that adjust a base font scale, a View menu option, or a setting in the Settings dialog.

### BUG-013: GitHub clone not available from Create dialog and Ingest card clone does nothing

- **Layer:** UI / IPC
- **Severity:** Bug
- **Status:** Fixed
- **Steps to reproduce:**
  1. Click New Project — no option to provide a GitHub repo URL for cloning
  2. Create a project with a local path instead
  3. On the Ingest card, enter a GitHub repo URL and click clone
  4. Nothing happens — no clone, no error, no feedback
- **Expected:** Create dialog should support GitHub URL as a source option. Ingest card clone button should trigger a git clone and update the source path.
- **Root cause:** Electron main process may not inherit the full shell PATH when launched from a desktop shortcut, so `git` isn't found by `execFileAsync`. The `handleCloneRepo` in IngestSidebar already had try/catch wiring but the IPC handler silently failed.
- **Fix:** Added `shell: true` and `env: { ...process.env }` to `execFileAsync` calls in the IPC handler. Added a descriptive error message when git is not found.

### BUG-014: Archive upload not available from Create dialog and Ingest card archive does nothing

- **Layer:** UI / IPC
- **Severity:** Bug
- **Status:** Fixed
- **Steps to reproduce:**
  1. Click New Project — no option to upload an archive (.zip/.tar.gz)
  2. Create a project with a local path instead
  3. On the Ingest card, click the archive button
  4. Nothing happens — no file picker, no extraction, no feedback
- **Expected:** Create dialog should support archive upload as a source option. Ingest card archive button should open a file picker, extract the archive, and set the source path.
- **Root cause:** FileDropZone's `handleClick` called `openFile()` without file filters and without try/catch, so errors were swallowed silently. Archive extraction also failed due to PATH issues (same as BUG-013).
- **Fix:** Added `filters` prop to FileDropZone, passed archive-specific filters from IngestSidebar. Added try/catch with console.error in handleClick. Added `shell: true` to tar/unzip execFileAsync calls.

### BUG-015: Settings dialog has no way to change models

- **Layer:** UI
- **Severity:** Bug
- **Status:** Closed — works as designed
- **Steps to reproduce:**
  1. Open Settings dialog
  2. No model configuration or tier-to-model mapping controls are present
  3. Expected: ability to view and change model assignments for each tier (fast/standard/advanced)
- **Root cause:** The Settings dialog's Tiers tab already provides model editing for each tier. The reporter missed the Tiers tab.
- **Note:** A future enhancement could populate the model input with a dropdown fed by `list-models --available` for better discoverability.

### BUG-016: No way to destroy a project from the GUI

- **Layer:** UI
- **Severity:** Bug
- **Status:** Fixed
- **Steps to reproduce:**
  1. Select a project in the project selector
  2. No delete/destroy button or menu option exists
  3. Expected: a way to destroy a project (e.g., context menu, button, or menu option) with a confirmation dialog
- **Root cause:** No UI existed for the destroy action despite full backend wiring (preload, IPC handler, CLI api).
- **Fix:** Added destroy button (x icon) to ProjectSelector with `window.confirm()` dialog. Added `destroyProject` method to project store. Fixed IPC handler to also delete the target directory (matching CLI `destroy` behavior).

### BUG-017: Destroy project should offer option to also remove POC source folder

- **Layer:** UI
- **Severity:** Cosmetic
- **Status:** Open
- **Steps to reproduce:**
  1. Select a project and click the destroy button
  2. Confirmation dialog only mentions removing the target directory
  3. The POC source folder remains on disk after destroy
  4. Expected: an option (e.g., checkbox in confirm dialog or "Deep Destroy") to also delete the POC source folder
- **Root cause:** Destroy handler only removes the target directory and unregisters the project. No option to clean up the source folder.
- **Fix:** Add a "deep destroy" option that also removes `entry.source` when selected.

### BUG-018: Drag-and-drop does not work in WSL2

- **Layer:** Platform
- **Severity:** Cosmetic
- **Status:** Open — verify on Windows
- **Steps to reproduce:**
  1. Run the GUI in WSL2 (`npm run dev -w @proteus-forge/gui`)
  2. Drag a file from Windows Explorer onto the FileDropZone
  3. Cursor shows circle-with-slash, drop is not accepted
  4. `dragover` events do not fire in the renderer at all
- **Root cause:** WSL2 limitation — the drag-and-drop protocol does not cross the WSL2/Windows boundary. Electron in WSL2 cannot receive drag events from Windows Explorer.
- **Fix:** Expected to work on native Windows and native Linux. Verify during Windows rollout testing. Click-to-browse is the workaround in WSL2.

<!-- Next ID: BUG-019 -->

