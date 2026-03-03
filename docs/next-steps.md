# Next Steps

Status as of 2026-03-03.

## Current Phase: Real-World Validation

The CLI and GUI are feature-complete for the core pipeline. The next phase is running real POC-to-production conversions and iterating based on results.

### What's built
- **CLI**: 30 commands, full 5-stage pipeline (inspect → design → plan → split → execute), Agent Team integration via `query()`, in-place TTY dashboard, wave checkpoints, resume/abort, verify with `--fix`
- **GUI**: Electron desktop app, all 5 phases with artifact viewers, session event streaming, abort buttons, staleness warnings, revert/destroy, archive upload, settings dialog, cost/duration/session-ID display
- **Test coverage**: 284 CLI tests, 231 GUI tests, 80%+ coverage enforced per package

### What to do next
1. **Run the CLI pipeline on a real POC** — `proteus-forge new → inspect → design → plan → split → execute`. Evaluate prompt quality, agent coordination, and output fidelity.
2. **Open the GUI** (`npm run dev -w @proteus-forge/gui`) — smoke-test the full flow. Note UX issues, broken interactions, or missing polish.
3. **Iterate on prompts** — the prompt generators in `src/prompts/*.ts` are the highest-leverage files. Tune them based on real pipeline output.
4. **File issues** — report bugs and gaps found during real-world usage for the next development cycle.

---

## Deferred

### E2E Tests

`packages/gui/e2e/` exists but is empty. No Playwright dependency, no config, no test scripts. Worth setting up after manual GUI validation confirms the happy paths work — E2E tests are a regression safety net, not a discovery tool.
