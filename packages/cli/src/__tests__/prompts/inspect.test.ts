import { describe, it, expect } from "vitest";
import { generateInspectLeadPrompt } from "../../prompts/inspect.js";

describe("inspect prompt", () => {
  const sourcePath = "/home/user/projects/my-poc";
  const targetPath = "/home/user/projects/my-poc-prod";

  it("generates a non-empty prompt", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("includes the source path", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(sourcePath);
  });

  it("includes the target path", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(targetPath);
  });

  it("marks source as read-only", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("read-only");
  });

  it("includes the output path for features.json", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(".proteus-forge/01-inspect/features.json");
  });

  it("includes the output path for partials", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(".proteus-forge/01-inspect/partials/");
  });

  it("includes the scout.json output path", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(".proteus-forge/01-inspect/scout.json");
  });

  it("includes the features.json schema structure", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("forgeVersion");
    expect(prompt).toContain("features");
    expect(prompt).toContain("dataModel");
    expect(prompt).toContain("integrations");
    expect(prompt).toContain("knownIssues");
  });

  it("includes the partial schema structure", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("crossDomainDependencies");
    expect(prompt).toContain("patterns");
    expect(prompt).toContain("risks");
  });

  it("instructs to create an agent team", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("agent team");
  });

  it("instructs to spawn teammates", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("spawn");
    expect(prompt.toLowerCase()).toContain("teammate");
  });

  it("references TeamCreate tool explicitly", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("TeamCreate");
  });

  it("prohibits sequential solo work", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("DO NOT attempt to do all the analysis yourself sequentially");
  });

  it("includes totalLines in scout.json schema", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain('"totalLines"');
  });

  it("includes fileTree in scout.json schema", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain('"fileTree"');
  });

  it("includes totalLines in features.json schema", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    // features.json schema has totalLines in the source block
    const featuresSchemaStart = prompt.indexOf("The features.json schema:");
    const afterSchema = prompt.slice(featuresSchemaStart);
    expect(afterSchema).toContain('"totalLines"');
  });

  it("includes fileTree in features.json schema", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    const featuresSchemaStart = prompt.indexOf("The features.json schema:");
    const afterSchema = prompt.slice(featuresSchemaStart);
    expect(afterSchema).toContain('"fileTree"');
  });

  it("instructs to carry forward totalLines and fileTree from scout.json", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("Carry forward");
    expect(prompt).toContain("totalLines");
    expect(prompt).toContain("fileTree");
    expect(prompt).toContain("scout.json");
  });

  it("instructs to count total lines of source code", () => {
    const prompt = generateInspectLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("Count total lines of source code");
  });
});
