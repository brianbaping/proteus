import { describe, it, expect } from "vitest";
import { generateDesignLeadPrompt } from "../../prompts/design.js";

describe("design prompt", () => {
  const sourcePath = "/home/user/projects/my-poc";
  const targetPath = "/home/user/projects/my-poc-prod";

  it("generates a non-empty prompt", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("includes the source path", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(sourcePath);
  });

  it("includes the target path", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(targetPath);
  });

  it("references features.json as input", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("01-inspect/features.json");
  });

  it("includes output paths for design artifacts", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("02-design/design.md");
    expect(prompt).toContain("02-design/design-meta.json");
    expect(prompt).toContain("02-design/scope.json");
    expect(prompt).toContain("02-design/partials/");
  });

  it("includes design-meta.json schema structure", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("architectureStyle");
    expect(prompt).toContain("targetStack");
    expect(prompt).toContain("featureToServiceMap");
  });

  it("includes the partial schema with services and decisions", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("exposedInterfaces");
    expect(prompt).toContain("ownedEntities");
    expect(prompt).toContain("decisions");
    expect(prompt).toContain("rationale");
  });

  it("instructs to create an agent team", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("agent team");
  });

  it("instructs specialists to negotiate cross-domain concerns", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("cross-domain");
    expect(prompt.toLowerCase()).toContain("message");
  });

  it("instructs to design for production quality", () => {
    const prompt = generateDesignLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("production");
    expect(prompt.toLowerCase()).toContain("known issues");
  });
});
