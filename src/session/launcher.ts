import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  SDKResultMessage,
  Options,
} from "@anthropic-ai/claude-agent-sdk";
import type { StageCost } from "../config/types.js";

export interface LaunchOptions {
  prompt: string;
  cwd: string;
  additionalDirectories?: string[];
  model?: string;
  maxBudgetUsd?: number;
  permissionMode?: Options["permissionMode"];
  onMessage?: (message: SDKMessage) => void;
}

export interface SessionResult {
  success: boolean;
  sessionId: string;
  cost: StageCost;
  result?: string;
  errors?: string[];
}

/**
 * Launch a Claude Code session via the Agent SDK.
 * This is the core interface between Proteus and Claude Code.
 */
export async function launchSession(
  options: LaunchOptions
): Promise<SessionResult> {
  const startTime = Date.now();
  let sessionId = "";

  const sdkOptions: Options = {
    cwd: options.cwd,
    additionalDirectories: options.additionalDirectories,
    model: options.model,
    maxBudgetUsd: options.maxBudgetUsd,
    permissionMode: options.permissionMode ?? "acceptEdits",
    settingSources: ["user", "project"],
    persistSession: false,
  };

  const session = query({ prompt: options.prompt, options: sdkOptions });

  let resultMessage: SDKResultMessage | undefined;

  for await (const message of session) {
    // Capture session ID from init message
    if (message.type === "system" && "subtype" in message && message.subtype === "init") {
      sessionId = message.session_id;
    }

    // Capture result
    if (message.type === "result") {
      resultMessage = message as SDKResultMessage;
    }

    // Forward to caller's message handler
    if (options.onMessage) {
      options.onMessage(message);
    }
  }

  const durationMs = Date.now() - startTime;
  const durationStr = formatDuration(durationMs);

  if (resultMessage && resultMessage.subtype === "success") {
    const totalInputTokens = Object.values(resultMessage.modelUsage).reduce(
      (sum, u) => sum + u.inputTokens,
      0
    );
    const totalOutputTokens = Object.values(resultMessage.modelUsage).reduce(
      (sum, u) => sum + u.outputTokens,
      0
    );

    return {
      success: true,
      sessionId,
      result: resultMessage.result,
      cost: {
        timestamp: new Date().toISOString(),
        teammates: 0, // Updated by the caller based on stage
        tier: options.model ?? "default",
        duration: durationStr,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCost: resultMessage.total_cost_usd,
      },
    };
  }

  // Error case
  const errors =
    resultMessage && "errors" in resultMessage ? resultMessage.errors : [];

  return {
    success: false,
    sessionId,
    errors,
    cost: {
      timestamp: new Date().toISOString(),
      teammates: 0,
      tier: options.model ?? "default",
      duration: durationStr,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: resultMessage?.total_cost_usd ?? 0,
    },
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
