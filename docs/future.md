# Future Considerations

Ideas and improvements for future versions. Not committed to — just tracked.

## Dashboard

- **In-place agent status display**: Replace the current scrolling dashboard (`src/utils/dashboard.ts`) with an in-place multi-line display where each agent has a fixed terminal line that gets overwritten with updated status. Would require ANSI cursor-up (`\x1b[A`) and line-clear (`\x1b[2K`) sequences. Fall back to scrolling mode when `!process.stdout.isTTY`.
