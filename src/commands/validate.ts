import { Command } from "commander";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveProject } from "../utils/resolve-project.js";
import { getStageStatuses, checkStaleness } from "../utils/stages.js";

interface ValidationResult {
  rule: string;
  passed: boolean;
  message: string;
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

export const validateCommand = new Command("validate")
  .description("Run cross-stage artifact validation")
  .argument("[name]", "Project name (uses active project if omitted)")
  .action(async (name?: string) => {
    let project;
    try {
      project = await resolveProject(name);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const targetPath = project.entry.target;
    const forgeDir = join(targetPath, ".proteus-forge");
    const results: ValidationResult[] = [];

    console.log(`\n[${project.name}] Validating artifacts...\n`);

    // Check which stages are complete
    const statuses = getStageStatuses(targetPath);
    const completedStages = statuses.filter((s) => s.complete).map((s) => s.stage);

    if (completedStages.length === 0) {
      console.log("  No stages completed yet. Nothing to validate.\n");
      return;
    }

    // Validate inspect
    if (completedStages.includes("inspect")) {
      const features = await readJson(join(forgeDir, "01-inspect", "features.json"));
      if (features) {
        const featureArr = features.features as Array<{ id: string; dependencies?: string[] }> | undefined;

        results.push({
          rule: "Features array non-empty",
          passed: Array.isArray(featureArr) && featureArr.length > 0,
          message: featureArr ? `${featureArr.length} features found` : "Missing features array",
        });

        if (Array.isArray(featureArr)) {
          const ids = featureArr.map((f) => f.id);
          const uniqueIds = new Set(ids);
          results.push({
            rule: "Feature IDs unique",
            passed: ids.length === uniqueIds.size,
            message: ids.length === uniqueIds.size
              ? `${ids.length} unique IDs`
              : `${ids.length - uniqueIds.size} duplicate(s)`,
          });

          // Check for dangling dependency references
          let danglingCount = 0;
          for (const f of featureArr) {
            for (const dep of f.dependencies ?? []) {
              if (!uniqueIds.has(dep)) danglingCount++;
            }
          }
          results.push({
            rule: "No dangling feature dependencies",
            passed: danglingCount === 0,
            message: danglingCount === 0
              ? "All dependency references valid"
              : `${danglingCount} dangling reference(s)`,
          });
        }
      }
    }

    // Validate design
    if (completedStages.includes("design")) {
      const designMeta = await readJson(join(forgeDir, "02-design", "design-meta.json"));
      if (designMeta) {
        const featureMap = designMeta.featureToServiceMap as Record<string, string> | undefined;
        results.push({
          rule: "Feature-to-service map exists",
          passed: !!featureMap && Object.keys(featureMap).length > 0,
          message: featureMap ? `${Object.keys(featureMap).length} features mapped` : "Missing map",
        });
      }

      const designMd = join(forgeDir, "02-design", "design.md");
      results.push({
        rule: "design.md exists",
        passed: existsSync(designMd),
        message: existsSync(designMd) ? "Present" : "Missing",
      });
    }

    // Validate plan
    if (completedStages.includes("plan")) {
      const plan = await readJson(join(forgeDir, "03-plan", "plan.json"));
      if (plan) {
        const tasks = plan.tasks as Array<{ id: string; dependsOn?: string[]; fileOwnership?: string[] }> | undefined;
        const waves = plan.executionWaves as Array<{ wave: number; tasks: string[] }> | undefined;

        if (Array.isArray(tasks)) {
          const taskIds = new Set(tasks.map((t) => t.id));

          // Unique task IDs
          results.push({
            rule: "Task IDs unique",
            passed: tasks.length === taskIds.size,
            message: `${taskIds.size} unique task IDs`,
          });

          // All tasks have file ownership
          const noOwnership = tasks.filter((t) => !t.fileOwnership || t.fileOwnership.length === 0);
          results.push({
            rule: "All tasks have file ownership",
            passed: noOwnership.length === 0,
            message: noOwnership.length === 0
              ? "All tasks have ownership"
              : `${noOwnership.length} task(s) missing ownership`,
          });

          // Dependency references valid
          let invalidDeps = 0;
          for (const t of tasks) {
            for (const dep of t.dependsOn ?? []) {
              if (!taskIds.has(dep)) invalidDeps++;
            }
          }
          results.push({
            rule: "No dangling task dependencies",
            passed: invalidDeps === 0,
            message: invalidDeps === 0 ? "All valid" : `${invalidDeps} invalid reference(s)`,
          });
        }

        if (Array.isArray(waves)) {
          results.push({
            rule: "Execution waves defined",
            passed: waves.length > 0,
            message: `${waves.length} waves`,
          });
        }
      }
    }

    // Validate split
    if (completedStages.includes("split")) {
      const manifest = await readJson(join(forgeDir, "04-tracks", "manifest.json"));
      if (manifest) {
        const tracks = manifest.tracks as Array<{ id: string; taskCount: number }> | undefined;
        results.push({
          rule: "Track manifest has tracks",
          passed: Array.isArray(tracks) && tracks.length > 0,
          message: tracks ? `${tracks.length} tracks` : "No tracks",
        });
      }
    }

    // Staleness checks
    const staleWarnings = checkStaleness(targetPath);
    results.push({
      rule: "No stale artifacts",
      passed: staleWarnings.length === 0,
      message: staleWarnings.length === 0
        ? "All artifacts up to date"
        : staleWarnings.map((w) => w.staleReason).join("; "),
    });

    // Display results
    let passed = 0;
    let failed = 0;

    for (const r of results) {
      const icon = r.passed ? "\u2713" : "\u2717";
      console.log(`  ${icon} ${r.rule.padEnd(40)} ${r.message}`);
      if (r.passed) passed++;
      else failed++;
    }

    console.log(`\n  ${passed} passed, ${failed} failed\n`);

    if (failed > 0) process.exit(1);
  });
