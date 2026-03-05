# GUI Testing Guide

Internal guide for manual validation of the Proteus Forge Electron GUI. Follow this process for each testing pass.

## Prerequisites

- CLI fully tested and passing (`npm run build -w @proteus-forge/cli`)
- Shared types built (`npm run build -w @proteus-forge/shared`)
- GUI launches without errors (`npm run dev -w @proteus-forge/gui`)

## Testing Order

Work inside-out. Fix each layer before moving to the next — downstream bugs are often symptoms of upstream problems.

### Layer 1: IPC Handlers

The GUI-CLI boundary. Verify data flows correctly through Electron IPC before testing any UI.

**What to test:**
- Each IPC channel sends and receives the expected shape
- Error states propagate correctly (CLI returns failure, handler surfaces it)
- Streaming events (session:event) arrive in order and contain expected fields
- Long-running operations (stage:run) can be aborted cleanly

**Where bugs live:** `packages/gui/electron/ipc/`, `packages/gui/electron/preload.ts`, `packages/shared/src/ipc.ts`

### Layer 2: State Management (Zustand Stores)

Stores consume IPC events and expose data to components. If a store drops or misformats data, the UI will look broken even though components are fine.

**What to test:**
- Store state updates correctly after IPC calls
- Session store handles streaming lifecycle: start, progress events, completion, error, abort
- Project store reflects correct active project after switching
- State resets properly between operations (no stale data from previous runs)

**Where bugs live:** `packages/gui/src/stores/`

### Layer 3: UI Components

Visual rendering, user interactions, navigation. Test last because most visual bugs trace back to Layer 1 or 2.

**What to test:**
- Each pipeline phase renders its artifacts correctly
- User actions (buttons, forms, dialogs) trigger the right IPC calls
- Loading, empty, and error states display appropriately
- Navigation between phases preserves state

**Where bugs live:** `packages/gui/src/components/`

## Bug Reporting Process

Log all bugs in [`docs/gui-bugs.md`](gui-bugs.md). One entry per bug with this format:

```markdown
### BUG-NNN: Short description

- **Layer:** IPC | Store | UI
- **Severity:** Blocker | Bug | Cosmetic
- **Status:** Open | Fixing | Fixed | Won't Fix
- **Steps to reproduce:**
  1. Step one
  2. Step two
  3. What happened vs what was expected
- **Screenshot:** `docs/screenshots/BUG-NNN.png` (if applicable)
- **Root cause:** (fill in during analysis)
- **Fix:** (fill in after resolution, include commit hash)
```

### Severity definitions

- **Blocker** — prevents testing from continuing (crash, data loss, can't proceed to next layer)
- **Bug** — incorrect behavior but testing can continue
- **Cosmetic** — visual or UX issue, no functional impact

## Workflow Per Testing Session

1. **Pull latest** and rebuild: shared, then CLI, then launch GUI dev
2. **Pick a layer** — start at the lowest untested/broken layer
3. **Test systematically** — work through the checklist for that layer
4. **Log bugs** in `gui-bugs.md` as you find them
5. **Triage** — review all bugs found in the session, prioritize blockers first
6. **Fix** — one bug at a time, write/update tests, verify the fix
7. **Retest** — confirm the fix didn't break anything in the same layer
8. **Advance** — once a layer is clean, move to the next

## Rules

- Never skip layers. Layer 1 must be clean before testing Layer 2.
- Log the bug before fixing it. No silent fixes.
- One fix per commit. Reference the bug number: `fix(gui): BUG-003 session store not clearing on abort`
- After fixing a blocker, retest the full layer before moving on.
- If a fix in Layer N reveals a bug in Layer N-1, stop and drop back down.

## Platform Strategy

**Primary testing: WSL2 (Linux)** — covers React rendering, IPC, stores, and all component behavior.

**Windows sanity check: at each major milestone** — run the packaged app on native Windows to verify OS-specific behavior.

### Windows-Only Test Items

Track features here that require native Windows testing. Test these during the milestone sanity check.

- [ ] Double-click artifact → opens in system default editor (`shell.openPath()`)
- [ ] Electron packaging produces working `.exe` (`npm run dist`)

### Windows Sanity Check Process

1. Copy latest build to `C:\repos\proteus` via robocopy (skip node_modules, .git, dist, coverage)
2. `npm install && npm run build -w @proteus-forge/shared && npm run dev -w @proteus-forge/gui`
3. Run through the Windows-Only Test Items above
4. Log any Windows-specific bugs with `[WIN]` prefix in bug number

## When Testing Is Complete

All three layers tested, all bugs resolved or marked Won't Fix, and:
- `npm run test -w @proteus-forge/gui` passes
- `npm run dev -w @proteus-forge/gui` runs clean
- Full pipeline exercised through the GUI at least once end-to-end
- Windows sanity check passed at final milestone
