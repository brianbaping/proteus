import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/style-context.js", () => ({
  hasStyleGuide: vi.fn().mockReturnValue(false),
}));

import { generateSplitLeadPrompt } from "../../prompts/split.js";
import { hasStyleGuide } from "../../utils/style-context.js";

describe("split prompt", () => {
  const targetPath = "/home/user/projects/my-poc-prod";

  beforeEach(() => {
    vi.mocked(hasStyleGuide).mockReturnValue(false);
  });

  it("generates a non-empty prompt", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("includes the target path", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain(targetPath);
  });

  it("references plan.json as input", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain("03-plan/plan.json");
  });

  it("references design-meta.json as input", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain("02-design/design-meta.json");
  });

  it("includes output path for manifest.json", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain("04-tracks/");
    expect(prompt).toContain("manifest.json");
  });

  it("lists all expected discipline tracks", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain("track-backend");
    expect(prompt).toContain("track-frontend");
    expect(prompt).toContain("track-data");
    expect(prompt).toContain("track-devops");
    expect(prompt).toContain("track-qa");
    expect(prompt).toContain("track-shared");
  });

  it("specifies no overlapping file ownership", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt.toLowerCase()).toContain("no file ownership overlap");
  });

  it("specifies every task must be in exactly one track", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain("exactly one track");
  });

  it("specifies track dependency must be a DAG", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain("DAG");
  });

  it("includes the manifest schema with dependsOnTracks", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain("dependsOnTracks");
    expect(prompt).toContain("requiredByTracks");
  });

  it("includes the track file schema with fileOwnershipMap", () => {
    const prompt = generateSplitLeadPrompt(targetPath);
    expect(prompt).toContain("fileOwnershipMap");
    expect(prompt).toContain("sharedPatterns");
  });

  describe("conditional style guide", () => {
    it("does not include style guide references when no style guide exists", () => {
      const prompt = generateSplitLeadPrompt(targetPath);
      expect(prompt).not.toContain("02-style/style-guide.json");
    });

    it("includes style guide references when style guide exists", () => {
      vi.mocked(hasStyleGuide).mockReturnValue(true);
      const prompt = generateSplitLeadPrompt(targetPath);
      expect(prompt).toContain("02-style/style-guide.json");
    });
  });
});
