import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["electron/main.ts", "electron/preload.ts"],
  format: ["cjs"],
  outDir: "dist/main",
  external: ["electron"],
  noExternal: ["@proteus-forge/cli", "@proteus-forge/shared"],
});
