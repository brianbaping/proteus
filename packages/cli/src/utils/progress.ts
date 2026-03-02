import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { AgentDashboard } from "./dashboard.js";

/**
 * Create a real-time agent dashboard for a pipeline stage.
 * Shows color-coded, per-agent activity as the session runs.
 */
export function createDashboard(stageName: string): AgentDashboard {
  return new AgentDashboard(stageName);
}

/**
 * Simple progress logger (no agent tracking, no colors).
 * Kept for backward compatibility.
 */
export function logProgress(message: SDKMessage): void {
  if (message.type === "assistant" && "message" in message) {
    const content = message.message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if ("text" in block && typeof block.text === "string") {
          const text = block.text.trim();
          if (text.length > 0 && text.length < 200) {
            process.stdout.write(`  ${text}\n`);
          }
        }
      }
    }
  }
}
