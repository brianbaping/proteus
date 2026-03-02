import { describe, it, expect } from "vitest";
import { generateVerifyFixPrompt } from "../../prompts/verify-fix.js";
import type { VerifyStep } from "../../utils/verify.js";

describe("verify-fix prompt", () => {
  const targetPath = "/home/user/projects/my-app";
  const packageManager = "npm";

  const steps: VerifyStep[] = [
    { name: "install", command: "npm", args: ["install"], passed: true, skipped: false, durationMs: 100 },
    { name: "build", command: "npm", args: ["run", "build"], passed: false, skipped: false, durationMs: 200, output: "error TS2345: Argument of type 'string'" },
    { name: "test", command: "npm", args: ["run", "test"], passed: false, skipped: false, durationMs: 300, output: "FAIL src/app.test.ts\nExpected 2 but received 3" },
    { name: "lint", command: "npm", args: ["run", "lint"], passed: false, skipped: true, durationMs: 0 },
  ];

  it("includes the target path", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt).toContain(targetPath);
  });

  it("includes the package manager", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt).toContain("npm");
  });

  it("includes only failed (non-skipped) steps", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt).toContain("### build");
    expect(prompt).toContain("### test");
    expect(prompt).not.toContain("### install");
    expect(prompt).not.toContain("### lint");
  });

  it("includes error output from failed steps", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt).toContain("error TS2345");
    expect(prompt).toContain("Expected 2 but received 3");
  });

  it("includes the commands to re-run", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt).toContain("`npm run build`");
    expect(prompt).toContain("`npm run test`");
  });

  it("truncates long output to last 200 lines", () => {
    const longOutput = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`).join("\n");
    const stepsWithLongOutput: VerifyStep[] = [
      { name: "build", command: "npm", args: ["run", "build"], passed: false, skipped: false, durationMs: 200, output: longOutput },
    ];

    const prompt = generateVerifyFixPrompt(targetPath, stepsWithLongOutput, packageManager);
    expect(prompt).toContain("300 lines truncated");
    expect(prompt).toContain("line 301");
    expect(prompt).toContain("line 500");
    expect(prompt).not.toContain("line 1\n");
  });

  it("handles missing output gracefully", () => {
    const stepsNoOutput: VerifyStep[] = [
      { name: "build", command: "npm", args: ["run", "build"], passed: false, skipped: false, durationMs: 200 },
    ];

    const prompt = generateVerifyFixPrompt(targetPath, stepsNoOutput, packageManager);
    expect(prompt).toContain("no output captured");
  });

  it("includes constraint about not removing tests", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt.toLowerCase()).toContain("not remove");
    expect(prompt.toLowerCase()).toContain("test");
  });

  it("includes constraint about not weakening lint rules", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt.toLowerCase()).toContain("lint rules");
  });

  it("includes constraint about not casting to any", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt).toContain("`any`");
  });

  it("includes constraint about not changing architecture", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, packageManager);
    expect(prompt.toLowerCase()).toContain("architecture");
  });

  it("works with different package managers", () => {
    const prompt = generateVerifyFixPrompt(targetPath, steps, "pnpm");
    expect(prompt).toContain("pnpm");
  });
});
