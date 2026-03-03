# Future Considerations

Ideas and improvements for future versions. Not committed to — just tracked.

## Dashboard

- ~~**In-place agent status display**~~: Implemented. The `AgentDashboard` now pins agent status lines to the bottom of the terminal in TTY mode, updating in-place via ANSI cursor-up and line-clear sequences. Non-TTY falls back to scrolling.
