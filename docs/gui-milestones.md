# GUI Testing Milestones

Tracks progress through manual validation of the Proteus Forge GUI. See [`gui-testing-guide.md`](gui-testing-guide.md) for process and [`gui-bugs.md`](gui-bugs.md) for bug log.

## Milestone 1: Data Display (read-only) — COMPLETE

Verify that the GUI correctly reads and renders existing project data.

- [x] Project listing loads on startup
- [x] Project selection populates status and paths
- [x] Project switching updates status (no stale data)
- [x] Stage tabs show correct completion state
- [x] Artifact loading works across all 5 phases
- [x] Dynamic artifact file list (all files in stage directory)
- [x] Staleness warnings appear when upstream changes invalidate downstream
- [x] Cost data displays correctly (CompleteBar, costs:read)
- [x] Empty states render correctly for projects with no completed stages (covered by unit tests, no empty project available to test manually)

## Milestone 2: Pipeline Operations (write) — NOT STARTED

Verify running stages, streaming, and abort from the GUI. Costs real API dollars.

- [ ] Run inspect stage from the GUI
- [ ] Session streaming — agent activity appears in AI Chat panel
- [ ] Progress indicators update during execution
- [ ] Abort a running stage
- [ ] Stage completion triggers status refresh and artifact load
- [ ] Run design stage with brief text
- [ ] Run design stage with uploaded brief file
- [ ] Complete Phase & Unlock Next advances to next tab

## Milestone 3: Project Management — NOT STARTED

Verify create, destroy, settings, and revert workflows.

- [ ] Create new project via dialog (local path)
- [ ] Create new project via GitHub clone
- [ ] Create new project via archive upload
- [ ] Destroy a project
- [ ] Destroy Phase & Revert removes artifacts and navigates back
- [ ] Settings dialog loads global config
- [ ] Settings dialog saves config changes
- [ ] Project selector dropdown works with multiple projects

## Milestone 4: Windows Sanity Check — NOT STARTED

Native Windows testing at milestone completion. Items accumulate during Milestones 1-3.

- [ ] Double-click artifact opens in system default editor (`shell.openPath()`)
- [ ] Packaged `.exe` launches and functions (`npm run dist`)
- [ ] General visual/rendering check on native Windows
- [ ] File paths resolve correctly (no `/` vs `\` issues)
