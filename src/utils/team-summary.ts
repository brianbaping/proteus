import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface InspectDomain {
  id: string;
  name: string;
  specialist: string;
  entryFiles: string[];
  rationale: string;
}

interface DesignDomain {
  id: string;
  name: string;
  specialist: string;
  implementsFeatures: string[];
  designFocus: string;
}

/**
 * Read scout.json and print the inspection team that was spawned.
 */
export async function printInspectTeamSummary(
  targetPath: string
): Promise<void> {
  const scoutPath = join(
    targetPath, ".proteus", "01-inspect", "scout.json"
  );
  if (!existsSync(scoutPath)) return;

  try {
    const content = await readFile(scoutPath, "utf-8");
    const scout = JSON.parse(content);
    const domains: InspectDomain[] = scout.domains ?? [];

    if (domains.length === 0) return;

    console.log(`\n  Agent Team (${domains.length} specialists):`);
    for (const d of domains) {
      console.log(`    \u2022 ${d.specialist.padEnd(28)} ${d.name}`);
    }
  } catch {
    // Non-critical — don't fail if we can't read scout.json
  }
}

/**
 * Read scope.json and print the design team that was spawned.
 */
export async function printDesignTeamSummary(
  targetPath: string
): Promise<void> {
  const scopePath = join(
    targetPath, ".proteus", "02-design", "scope.json"
  );
  if (!existsSync(scopePath)) return;

  try {
    const content = await readFile(scopePath, "utf-8");
    const scope = JSON.parse(content);
    const domains: DesignDomain[] = scope.designDomains ?? [];

    if (domains.length === 0) return;

    console.log(`\n  Agent Team (${domains.length} specialists):`);
    for (const d of domains) {
      console.log(`    \u2022 ${d.specialist.padEnd(28)} ${d.name}`);
    }
  } catch {
    // Non-critical
  }
}
