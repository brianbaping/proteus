import { defineConfig } from "tsup";

const isDev = process.env.npm_lifecycle_event === "dev:electron"
  || process.argv.includes("--watch");

export default defineConfig({
  entry: ["electron/main.ts", "electron/preload.ts"],
  format: ["cjs"],
  outDir: "dist/main",
  external: ["electron", "@anthropic-ai/claude-agent-sdk"],
  noExternal: ["@proteus-forge/cli", "@proteus-forge/shared"],
  env: isDev ? { VITE_DEV_SERVER_URL: "http://localhost:5173" } : {},
});
