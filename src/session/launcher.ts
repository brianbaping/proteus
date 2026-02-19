import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  SDKUserMessage,
  SDKResultMessage,
  Options,
} from "@anthropic-ai/claude-agent-sdk";
import type { StageCost } from "../config/types.js";
import { consumeInboxMessages } from "../utils/inbox.js";

export interface LaunchOptions {
  prompt: string;
  cwd: string;
  additionalDirectories?: string[];
  model?: string;
  maxBudgetUsd?: number;
  permissionMode?: Options["permissionMode"];
  onMessage?: (message: SDKMessage) => void;
  /** Directory to watch for incoming user messages (file-based inbox). */
  inboxDir?: string;
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
  let resultMessage: SDKResultMessage | undefined;

  const sdkOptions: Options = {
    cwd: options.cwd,
    additionalDirectories: options.additionalDirectories,
    model: options.model,
    maxBudgetUsd: options.maxBudgetUsd,
    permissionMode: options.permissionMode ?? "acceptEdits",
    settingSources: ["user", "project"],
    persistSession: false,
  };

  try {
    const session = query({ prompt: options.prompt, options: sdkOptions });

    // Start inbox watcher if configured — injects user messages via streamInput()
    let inboxCleanup: (() => void) | undefined;
    if (options.inboxDir) {
      const abortController = new AbortController();
      inboxCleanup = () => abortController.abort();

      const inboxStream = createInboxStream(
        options.inboxDir,
        abortController.signal
      );
      // streamInput runs in the background — don't await it
      session.streamInput(inboxStream).catch(() => {
        // Expected to error when session ends or abort fires
      });
    }

    for await (const message of session) {
      // Capture session ID from init message
      if (
        message.type === "system" &&
        "subtype" in message &&
        message.subtype === "init"
      ) {
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

    // Stop inbox watcher when session ends
    if (inboxCleanup) inboxCleanup();
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error during session";
    console.error(`\n  Session error: ${errorMsg}`);

    return {
      success: false,
      sessionId,
      errors: [errorMsg],
      cost: {
        timestamp: new Date().toISOString(),
        teammates: 0,
        tier: options.model ?? "default",
        duration: formatDuration(durationMs),
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: resultMessage?.total_cost_usd ?? 0,
      },
    };
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
        teammates: 0,
        tier: options.model ?? "default",
        duration: durationStr,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCost: resultMessage.total_cost_usd,
      },
    };
  }

  // Non-success result (max turns, max budget, execution error)
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

/**
 * Creates an async iterable of SDKUserMessages by polling an inbox directory.
 * Messages are consumed (deleted) after reading.
 * Stops when the abort signal fires.
 */
async function* createInboxStream(
  inboxDir: string,
  signal: AbortSignal,
  pollIntervalMs: number = 3000
): AsyncGenerator<SDKUserMessage> {
  // Derive the target path from inboxDir (strip .proteus/05-execute/inbox)
  const targetPath = inboxDir.replace(
    /\/.proteus\/05-execute\/inbox\/?$/,
    ""
  );

  while (!signal.aborted) {
    const messages = await consumeInboxMessages(targetPath);
    for (const msg of messages) {
      const text = `[USER MESSAGE for teammate "${msg.targetAgent}"] The user wants you to relay this to the "${msg.targetAgent}" teammate immediately: ${msg.message}`;
      yield {
        type: "user",
        message: { role: "user", content: text },
        parent_tool_use_id: null,
        session_id: "",
      } as unknown as SDKUserMessage;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pollIntervalMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
}
