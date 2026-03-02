// ANSI escape code constants for terminal output.
// No external dependencies — raw escape sequences only.

export const AGENT_COLORS = [
  "\x1b[36m", // cyan (lead)
  "\x1b[33m", // yellow
  "\x1b[35m", // magenta
  "\x1b[32m", // green
  "\x1b[34m", // blue
  "\x1b[91m", // bright red
  "\x1b[93m", // bright yellow
  "\x1b[95m", // bright magenta
] as const;

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const SHOW_CURSOR = "\x1b[?25h";
