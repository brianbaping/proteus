import type { ProgressReporter } from "@proteus-forge/shared";

export const terminalReporter: ProgressReporter = {
  log: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
};
