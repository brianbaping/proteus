import { describe, it, expect } from "vitest";
import { generateExecuteLeadPrompt } from "../../prompts/execute.js";
import type { ExecuteContext } from "../../prompts/execute.js";

function makeTestContext(): ExecuteContext {
  const trackDetails = new Map();
  trackDetails.set("track-backend", {
    trackId: "track-backend",
    discipline: "backend",
    tasks: ["task-003", "task-004"],
    context: {
      targetStack: "Node.js 22, TypeScript, Express",
      services: ["svc-auth", "svc-products"],
      sharedPatterns: "Repository pattern",
      fileOwnershipMap: {
        "task-003": ["server/src/auth/"],
        "task-004": ["server/src/products/"],
      },
    },
  });
  trackDetails.set("track-frontend", {
    trackId: "track-frontend",
    discipline: "frontend",
    tasks: ["task-005"],
    context: {
      targetStack: "React 19, Vite, Tailwind",
      services: [],
      sharedPatterns: "Feature-based structure",
      fileOwnershipMap: {
        "task-005": ["client/src/"],
      },
    },
  });
  trackDetails.set("track-shared", {
    trackId: "track-shared",
    discipline: "shared",
    tasks: ["task-001"],
    context: {
      targetStack: "TypeScript 5",
      services: [],
      sharedPatterns: "",
      fileOwnershipMap: {
        "task-001": ["package.json", "tsconfig.json", "shared/"],
      },
    },
  });

  return {
    tracks: [
      { id: "track-shared", discipline: "shared", taskCount: 1, file: "04-tracks/shared.json" },
      { id: "track-backend", discipline: "backend", taskCount: 2, file: "04-tracks/backend.json" },
      { id: "track-frontend", discipline: "frontend", taskCount: 1, file: "04-tracks/frontend.json" },
    ],
    trackDetails,
    tasks: [
      {
        id: "task-001",
        title: "Scaffold project",
        description: "Create directory structure",
        discipline: "shared",
        dependsOn: [],
        acceptanceCriteria: ["package.json exists"],
        fileOwnership: ["package.json", "tsconfig.json"],
        testingExpectation: "none",
      },
      {
        id: "task-003",
        title: "Implement auth service",
        description: "JWT auth with refresh tokens",
        discipline: "backend",
        dependsOn: ["task-001"],
        acceptanceCriteria: ["Login returns tokens"],
        fileOwnership: ["server/src/auth/"],
        testingExpectation: "unit",
        testScope: "server/src/auth/__tests__/",
      },
      {
        id: "task-004",
        title: "Implement products service",
        description: "CRUD with pagination",
        discipline: "backend",
        dependsOn: ["task-001"],
        acceptanceCriteria: ["GET /products returns paginated list"],
        fileOwnership: ["server/src/products/"],
        testingExpectation: "unit",
        testScope: "server/src/products/__tests__/",
      },
      {
        id: "task-005",
        title: "Build frontend",
        description: "React app with auth",
        discipline: "frontend",
        dependsOn: ["task-003"],
        acceptanceCriteria: ["Login page works"],
        fileOwnership: ["client/src/"],
        testingExpectation: "unit",
      },
    ],
    waveCount: 3,
  };
}

describe("execute prompt", () => {
  const sourcePath = "/home/user/projects/my-poc";
  const targetPath = "/home/user/projects/my-poc-prod";
  const ctx = makeTestContext();

  it("generates a non-empty prompt", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("includes source and target paths", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain(sourcePath);
    expect(prompt).toContain(targetPath);
  });

  it("marks source as read-only", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt.toLowerCase()).toContain("read-only");
  });

  it("includes all task IDs in summary", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("task-001");
    expect(prompt).toContain("task-003");
    expect(prompt).toContain("task-004");
    expect(prompt).toContain("task-005");
  });

  it("includes task dependency information", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("depends on:");
  });

  it("includes teammate definitions for non-shared tracks", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("track-backend");
    expect(prompt).toContain("backend engineer");
    expect(prompt).toContain("track-frontend");
    expect(prompt).toContain("frontend engineer");
  });

  it("handles shared track as Lead-managed", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("track-shared");
    expect(prompt.toLowerCase()).toContain("lead");
  });

  it("includes file ownership per track", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("server/src/auth/");
    expect(prompt).toContain("server/src/products/");
    expect(prompt).toContain("client/src/");
  });

  it("includes task and wave counts", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("4 tasks");
    expect(prompt).toContain("3 waves");
  });

  it("references design.md for architecture context", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("02-design/design.md");
  });

  it("references plan.json for task details", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("03-plan/plan.json");
  });

  it("instructs not to copy POC code", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt.toLowerCase()).toContain("do not copy");
    expect(prompt.toLowerCase()).toContain("reimplement");
  });

  it("mentions unit test expectations", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("testingExpectation");
    expect(prompt).toContain("unit");
  });

  it("includes session.json output schema", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt).toContain("05-execute/session.json");
    expect(prompt).toContain("totalTasks");
  });

  it("instructs to enforce file ownership boundaries", () => {
    const prompt = generateExecuteLeadPrompt(sourcePath, targetPath, ctx);
    expect(prompt.toLowerCase()).toContain("must not modify files outside");
  });
});
