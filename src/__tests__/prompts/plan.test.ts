import { describe, it, expect } from "vitest";
import { generatePlanLeadPrompt } from "../../prompts/plan.js";

describe("plan prompt", () => {
  const sourcePath = "/home/user/projects/my-poc";
  const targetPath = "/home/user/projects/my-poc-prod";

  it("generates a non-empty prompt", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("includes the source and target paths", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(sourcePath);
    expect(prompt).toContain(targetPath);
  });

  it("references design.md as primary input", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("02-design/design.md");
  });

  it("references design-meta.json as secondary input", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("02-design/design-meta.json");
  });

  it("references features.json for coverage checking", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("01-inspect/features.json");
  });

  it("includes output paths for plan artifacts", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("03-plan/plan.json");
    expect(prompt).toContain("03-plan/plan.md");
  });

  it("includes the task schema with required fields", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("dependsOn");
    expect(prompt).toContain("fileOwnership");
    expect(prompt).toContain("acceptanceCriteria");
    expect(prompt).toContain("testingExpectation");
    expect(prompt).toContain("estimatedComplexity");
    expect(prompt).toContain("discipline");
  });

  it("includes execution wave schema", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("executionWaves");
    expect(prompt).toContain("criticalPath");
  });

  it("specifies the wave ordering rule", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("No task in wave N may depend on a task in wave N or later");
  });

  it("specifies the two-tier testing model", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain('"unit"');
    expect(prompt).toContain('"integration"');
  });

  it("instructs that user edits to design.md take priority", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("edited");
    expect(prompt.toLowerCase()).toContain("priority");
  });

  it("specifies no overlapping file ownership", () => {
    const prompt = generatePlanLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("ownership");
    expect(prompt.toLowerCase()).toContain("overlap");
  });
});
