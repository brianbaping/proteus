import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * Log meaningful progress updates from assistant messages.
 * Used as the onMessage handler for launchSession.
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
