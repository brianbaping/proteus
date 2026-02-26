import { describe, it, expect } from "vitest";
import { generateStyleLeadPrompt } from "../../prompts/style.js";

describe("style prompt", () => {
  const sourcePath = "/home/user/projects/my-poc";
  const targetPath = "/home/user/projects/my-poc-prod";

  it("generates a non-empty prompt", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("includes the source path", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(sourcePath);
  });

  it("includes the target path", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain(targetPath);
  });

  it("references features.json as input", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("01-inspect/features.json");
  });

  it("includes output paths for style artifacts", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("02-style/style-guide.json");
    expect(prompt).toContain("02-style/style.md");
  });

  it("marks source as read-only", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("read-only");
  });

  it("includes style-guide.json schema fields", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("stylingTechnology");
    expect(prompt).toContain("componentLibrary");
    expect(prompt).toContain("iconSet");
    expect(prompt).toContain("colorPalette");
    expect(prompt).toContain("typography");
    expect(prompt).toContain("spacing");
    expect(prompt).toContain("layout");
    expect(prompt).toContain("componentPatterns");
    expect(prompt).toContain("designTokens");
    expect(prompt).toContain("darkMode");
  });

  it("handles backend-only projects gracefully", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain('"none"');
    expect(prompt.toLowerCase()).toContain("no frontend");
  });

  it("instructs to extract actual values", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt.toLowerCase()).toContain("hex codes");
    expect(prompt.toLowerCase()).toContain("font names");
  });

  it("includes markdown style guide sections", () => {
    const prompt = generateStyleLeadPrompt(sourcePath, targetPath);
    expect(prompt).toContain("Visual Overview");
    expect(prompt).toContain("Color Palette");
    expect(prompt).toContain("Typography");
    expect(prompt).toContain("Layout System");
    expect(prompt).toContain("Component Patterns");
    expect(prompt).toContain("Recommendations for Production");
  });
});
