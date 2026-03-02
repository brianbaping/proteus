import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Check whether the optional style guide artifacts exist for a project.
 * Used by downstream prompt generators to conditionally include style references.
 */
export function hasStyleGuide(targetPath: string): boolean {
  return existsSync(
    join(targetPath, ".proteus-forge", "02-style", "style-guide.json")
  );
}
