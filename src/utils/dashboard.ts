import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { AGENT_COLORS, RESET, DIM, SHOW_CURSOR } from "./ansi.js";

interface AgentInfo {
  id: string;
  name: string;
  color: string;
  status: "spawning" | "working" | "idle" | "done";
  currentTool: string | null;
  lastProgressPrint: number;
  spawnedAt: number;
}

function extractAgentName(input: unknown): string {
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (typeof obj.name === "string" && obj.name.length > 0) {
      return obj.name.length > 20 ? obj.name.slice(0, 20) : obj.name;
    }
    if (typeof obj.description === "string" && obj.description.length > 0) {
      return obj.description.length > 20
        ? obj.description.slice(0, 17) + "..."
        : obj.description;
    }
  }
  return "agent";
}

const NOISE_PATTERNS = [
  /TaskOutput/i,
  /TaskCreate/i,
  /TaskUpdate/i,
  /TaskList/i,
  /TaskGet/i,
  /TaskStop/i,
  /SendMessage/i,
  /ExitPlanMode/i,
  /EnterPlanMode/i,
  /^I('ll| will| need to| should| want to) (use|call|invoke|run|check|now)/i,
  /^Let me (use|call|invoke|run|check)/i,
  /^Now (let me|I('ll| will))/i,
  /^Calling /i,
  /^Invoking /i,
  /\busing\s+(the\s+)?(Task|Read|Write|Edit|Bash|Grep|Glob|SendMessage)\b/i,
];

function isInternalNoise(text: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(text));
}

function summarizeText(text: string): string | null {
  // Try first sentence
  const sentenceMatch = text.match(/^(.+?[.!?])\s/);
  if (sentenceMatch && sentenceMatch[1].length <= 180) {
    return sentenceMatch[1];
  }

  // Try first line
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 180) {
    return firstLine;
  }

  // Truncate first line or full text
  const base = firstLine.length > 0 ? firstLine : text;
  return base.slice(0, 177) + "...";
}

function describeToolUse(toolName: string, input: unknown): string | null {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : null;

  switch (toolName) {
    case "Read":
      return obj?.file_path ? `Reading ${shortPath(String(obj.file_path))}` : "Reading file";
    case "Edit":
      return obj?.file_path ? `Editing ${shortPath(String(obj.file_path))}` : "Editing file";
    case "Write":
      return obj?.file_path ? `Writing ${shortPath(String(obj.file_path))}` : "Writing file";
    case "Bash":
      if (obj?.command) {
        const cmd = String(obj.command).split("\n")[0];
        return `Running: ${cmd.length > 50 ? cmd.slice(0, 47) + "..." : cmd}`;
      }
      return "Running command";
    case "Grep":
      return obj?.pattern ? `Searching for "${shortStr(String(obj.pattern), 30)}"` : "Searching";
    case "Glob":
      return obj?.pattern ? `Finding ${shortStr(String(obj.pattern), 40)}` : "Finding files";
    case "NotebookEdit":
      return obj?.notebook_path ? `Editing notebook ${shortPath(String(obj.notebook_path))}` : null;
    case "Task":
      return null; // handled separately as agent spawning
    case "TaskCreate":
    case "TaskUpdate":
    case "TaskList":
    case "TaskGet":
      return null; // internal coordination, too noisy
    case "SendMessage":
      return obj?.recipient ? `Messaging ${shortStr(String(obj.recipient), 20)}` : null;
    default:
      return `Using ${toolName}`;
  }
}

function shortPath(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 3) return filePath;
  return ".../" + parts.slice(-3).join("/");
}

function shortStr(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
}

/**
 * Real-time agent dashboard that processes SDK messages and displays
 * color-coded, per-agent activity in the terminal.
 */
export class AgentDashboard {
  private leadAgent: AgentInfo;
  private agents = new Map<string, AgentInfo>();
  private nextColorIndex = 1;
  private maxNameLen = 4; // "Lead"
  private isTTY: boolean;
  private agentCount = 0;

  constructor(private stageName: string) {
    this.isTTY = process.stdout.isTTY ?? false;
    this.leadAgent = {
      id: "lead",
      name: "Lead",
      color: AGENT_COLORS[0],
      status: "idle",
      currentTool: null,
      lastProgressPrint: 0,
      spawnedAt: Date.now(),
    };
  }

  onMessage(message: SDKMessage): void {
    // System init
    if (
      message.type === "system" &&
      "subtype" in message &&
      message.subtype === "init"
    ) {
      this.printLine(this.leadAgent, `Session started (${this.stageName})`);
      return;
    }

    // Assistant messages — detect spawning and activity
    if (message.type === "assistant" && "message" in message) {
      const agent = this.resolveAgent(message.parent_tool_use_id);
      const content = message.message.content;
      if (!Array.isArray(content)) return;

      for (const block of content) {
        if (!block || typeof block !== "object" || !("type" in block)) continue;

        // Detect agent spawning via Task tool
        if (
          block.type === "tool_use" &&
          "name" in block &&
          block.name === "Task"
        ) {
          const name = extractAgentName(
            "input" in block ? block.input : undefined
          );
          const id = "id" in block ? String(block.id) : `task-${this.agentCount}`;
          const newAgent = this.registerAgent(id, name);
          this.printLine(agent, `Spawning teammate: ${newAgent.name}`);
          this.printLine(newAgent, "Started");
          continue;
        }

        // Other tool use — show what the agent is doing
        if (block.type === "tool_use" && "name" in block) {
          const toolName = String(block.name);
          agent.currentTool = toolName;
          agent.status = "working";
          const desc = describeToolUse(toolName, "input" in block ? block.input : undefined);
          if (desc) {
            this.printLine(agent, desc);
          }
          continue;
        }

        // Text output
        if (
          block.type === "text" &&
          "text" in block &&
          typeof block.text === "string"
        ) {
          const text = block.text.trim();
          if (text.length > 0 && !isInternalNoise(text)) {
            const preview = text.length <= 200 ? text : summarizeText(text);
            if (preview) {
              this.printLine(agent, preview);
            }
          }
        }
      }
      return;
    }

    // Tool progress — throttled
    if (message.type === "tool_progress") {
      const agent = this.resolveAgent(message.parent_tool_use_id);
      agent.currentTool = message.tool_name;
      agent.status = "working";

      const now = Date.now();
      const elapsed = message.elapsed_time_seconds;
      if (elapsed >= 3 && now - agent.lastProgressPrint >= 5000) {
        agent.lastProgressPrint = now;
        this.printLine(
          agent,
          `\u23f3 ${message.tool_name} (${Math.round(elapsed)}s)`
        );
      }
      return;
    }

    // User message with tool result — possible agent completion
    if (
      message.type === "user" &&
      "tool_use_result" in message &&
      message.tool_use_result != null
    ) {
      // Check if this completes a tracked agent
      if (message.parent_tool_use_id) {
        const agent = this.agents.get(message.parent_tool_use_id);
        if (agent && agent.status !== "done") {
          agent.status = "done";
          agent.currentTool = null;
          this.printLine(agent, "Done \u2713");
        }
      }
      return;
    }

    // Session result — print summary
    if (message.type === "result") {
      this.printSummary();
    }
  }

  cleanup(): void {
    if (this.isTTY) {
      process.stdout.write(SHOW_CURSOR);
    }
  }

  private registerAgent(toolUseId: string, name: string): AgentInfo {
    this.agentCount++;
    // Deduplicate names
    const displayName =
      this.hasName(name) ? `${name}-${this.agentCount}` : name;

    if (displayName.length > this.maxNameLen) {
      this.maxNameLen = Math.min(displayName.length, 20);
    }

    const agent: AgentInfo = {
      id: toolUseId,
      name: displayName,
      color: AGENT_COLORS[this.nextColorIndex % AGENT_COLORS.length],
      status: "spawning",
      currentTool: null,
      lastProgressPrint: 0,
      spawnedAt: Date.now(),
    };
    this.nextColorIndex++;
    this.agents.set(toolUseId, agent);
    return agent;
  }

  private hasName(name: string): boolean {
    if (this.leadAgent.name === name) return true;
    for (const a of this.agents.values()) {
      if (a.name === name) return true;
    }
    return false;
  }

  private resolveAgent(parentToolUseId: string | null): AgentInfo {
    if (!parentToolUseId) return this.leadAgent;
    return this.agents.get(parentToolUseId) ?? this.leadAgent;
  }

  private printLine(agent: AgentInfo, text: string): void {
    const truncated =
      text.length > 70 ? text.slice(0, 67) + "..." : text;

    if (this.isTTY) {
      const prefix = `${agent.color}  \u25cf ${agent.name.padEnd(this.maxNameLen)}${RESET}`;
      process.stdout.write(`${prefix} ${truncated}\n`);
    } else {
      process.stdout.write(`  [${agent.name}] ${truncated}\n`);
    }
  }

  private printSummary(): void {
    if (this.agents.size === 0) return;

    const teammates = [...this.agents.values()];
    process.stdout.write(
      `\n  ${this.isTTY ? DIM : ""}Agent Team (${teammates.length} teammate${teammates.length === 1 ? "" : "s"}):${this.isTTY ? RESET : ""}\n`
    );
    for (const a of teammates) {
      const elapsed = Math.round((Date.now() - a.spawnedAt) / 1000);
      const elapsedStr =
        elapsed >= 60
          ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
          : `${elapsed}s`;

      if (this.isTTY) {
        process.stdout.write(
          `${a.color}    \u2022 ${a.name.padEnd(24)} ${a.status.padEnd(8)}${RESET} (${elapsedStr})\n`
        );
      } else {
        process.stdout.write(
          `    - ${a.name.padEnd(24)} ${a.status.padEnd(8)} (${elapsedStr})\n`
        );
      }
    }
  }
}
