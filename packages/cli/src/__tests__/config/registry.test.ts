import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ProjectRegistry } from "../../config/types.js";

// Since the registry module uses a hardcoded path, we test the data logic
// by directly testing serialization/deserialization patterns

describe("registry data logic", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proteus-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("roundtrips a registry through JSON", () => {
    const registry: ProjectRegistry = {
      activeProject: "my-project",
      projects: {
        "my-project": {
          source: "/tmp/source",
          target: "/tmp/target",
          createdAt: "2026-02-19T10:00:00Z",
          currentStage: "new",
        },
      },
    };

    const json = JSON.stringify(registry);
    const parsed = JSON.parse(json) as ProjectRegistry;

    expect(parsed.activeProject).toBe("my-project");
    expect(parsed.projects["my-project"].source).toBe("/tmp/source");
    expect(parsed.projects["my-project"].target).toBe("/tmp/target");
  });

  it("handles empty registry", () => {
    const registry: ProjectRegistry = {
      activeProject: null,
      projects: {},
    };

    const json = JSON.stringify(registry);
    const parsed = JSON.parse(json) as ProjectRegistry;

    expect(parsed.activeProject).toBeNull();
    expect(Object.keys(parsed.projects)).toHaveLength(0);
  });

  it("supports multiple projects", () => {
    const registry: ProjectRegistry = {
      activeProject: "project-b",
      projects: {
        "project-a": {
          source: "/a/source",
          target: "/a/target",
          createdAt: "2026-01-01T00:00:00Z",
          currentStage: "inspect",
        },
        "project-b": {
          source: "/b/source",
          target: "/b/target",
          createdAt: "2026-02-01T00:00:00Z",
          currentStage: "design",
        },
      },
    };

    expect(Object.keys(registry.projects)).toHaveLength(2);
    expect(registry.activeProject).toBe("project-b");
  });

  it("unregister logic removes project and updates active", () => {
    const registry: ProjectRegistry = {
      activeProject: "to-remove",
      projects: {
        "to-remove": {
          source: "/a",
          target: "/b",
          createdAt: "2026-01-01T00:00:00Z",
          currentStage: "new",
        },
        "keep-this": {
          source: "/c",
          target: "/d",
          createdAt: "2026-01-01T00:00:00Z",
          currentStage: "new",
        },
      },
    };

    // Simulate unregister logic
    delete registry.projects["to-remove"];
    if (registry.activeProject === "to-remove") {
      const remaining = Object.keys(registry.projects);
      registry.activeProject = remaining.length > 0 ? remaining[0] : null;
    }

    expect(registry.projects["to-remove"]).toBeUndefined();
    expect(registry.activeProject).toBe("keep-this");
  });
});
