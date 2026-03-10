import type { BrowserWindow } from "electron";
import type { SessionEvent } from "@proteus-forge/shared";

const GUI_COLORS = [
  "#00ff88", "#ffb830", "#00ddcc", "#ff4466",
  "#8b5cf6", "#f97316", "#06b6d4", "#ec4899",
];

const NOISE_PATTERNS = [
  /TaskOutput/i, /TaskCreate/i, /TaskUpdate/i, /TaskList/i,
  /TaskGet/i, /TaskStop/i, /SendMessage/i, /ExitPlanMode/i,
  /EnterPlanMode/i,
  /^I('ll| will| need to| should| want to) (use|call|invoke|run|check|now)/i,
  /^Let me (use|call|invoke|run|check)/i,
  /^Now (let me|I('ll| will))/i,
  /^Calling /i, /^Invoking /i,
  /\busing\s+(the\s+)?(Task|Read|Write|Edit|Bash|Grep|Glob|SendMessage|TodoWrite|TodoRead|TaskOutput|TaskStop|TeamCreate|TeamDelete|AskUserQuestion|EnterPlanMode|ExitPlanMode)\b/i,
  /TodoWrite/i, /TodoRead/i,
];

function isInternalNoise(text: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(text));
}

function summarizeText(text: string): string | null {
  const sentenceMatch = text.match(/^(.+?[.!?])\s/);
  if (sentenceMatch && sentenceMatch[1].length <= 180) return sentenceMatch[1];
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 180) return firstLine;
  const base = firstLine.length > 0 ? firstLine : text;
  return base.slice(0, 177) + "...";
}

function extractAgentName(input: unknown): string {
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (typeof obj.name === "string" && obj.name.length > 0) {
      return obj.name.length > 20 ? obj.name.slice(0, 20) : obj.name;
    }
    if (typeof obj.description === "string" && obj.description.length > 0) {
      return obj.description.length > 20 ? obj.description.slice(0, 17) + "..." : obj.description;
    }
  }
  return "agent";
}

function describeToolUse(toolName: string, input: unknown): string | null {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  const shortPath = (p: string) => { const parts = p.split("/"); return parts.length <= 3 ? p : ".../" + parts.slice(-3).join("/"); };
  const shortStr = (s: string, max: number) => s.length > max ? s.slice(0, max - 3) + "..." : s;

  switch (toolName) {
    case "Read": return obj?.file_path ? `Reading ${shortPath(String(obj.file_path))}` : "Reading file";
    case "Edit": return obj?.file_path ? `Editing ${shortPath(String(obj.file_path))}` : "Editing file";
    case "Write": return obj?.file_path ? `Writing ${shortPath(String(obj.file_path))}` : "Writing file";
    case "Bash": return obj?.command ? `Running: ${shortStr(String(obj.command).split("\n")[0], 50)}` : "Running command";
    case "Grep": return obj?.pattern ? `Searching for "${shortStr(String(obj.pattern), 30)}"` : "Searching";
    case "Glob": return obj?.pattern ? `Finding ${shortStr(String(obj.pattern), 40)}` : "Finding files";
    case "Task": case "TaskCreate": case "TaskUpdate": case "TaskList":
    case "TaskGet": case "TaskOutput": case "TaskStop": case "TodoWrite":
    case "TodoRead": case "TeamCreate": case "TeamDelete":
    case "AskUserQuestion": case "EnterPlanMode": case "ExitPlanMode":
      return null;
    case "SendMessage": return obj?.recipient ? `Messaging ${shortStr(String(obj.recipient), 20)}` : null;
    default: return null;
  }
}

interface AgentInfo {
  id: string;
  name: string;
  color: string;
  status: "spawning" | "working" | "idle" | "done";
  lastProgressPrint: number;
}

/**
 * GUI-oriented dashboard that emits SessionEvent objects to the renderer
 * instead of writing to stdout.
 */
export class GuiDashboard {
  private agents = new Map<string, AgentInfo>();
  private agentCount = 0;
  private nextColorIndex = 1;
  private leadAgent: AgentInfo = {
    id: "lead",
    name: "Lead",
    color: GUI_COLORS[0],
    status: "idle",
    lastProgressPrint: 0,
  };

  constructor(private getWindow: () => BrowserWindow | null) {}

  onMessage = (message: unknown): void => {
    const msg = message as Record<string, unknown>;
    if (!msg || typeof msg !== "object") return;

    // System init
    if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
      this.emit({ type: "session-start", message: "Session started", timestamp: Date.now() });
      return;
    }

    // Assistant messages
    if (msg.type === "assistant" && "message" in msg) {
      const assistantMsg = msg.message as Record<string, unknown>;
      const content = assistantMsg?.content;
      if (!Array.isArray(content)) return;
      const agent = this.resolveAgent(msg.parent_tool_use_id as string | null);

      for (const block of content) {
        if (!block || typeof block !== "object" || !("type" in block)) continue;
        const b = block as Record<string, unknown>;

        if (b.type === "tool_use" && b.name === "Task") {
          const name = extractAgentName(b.input);
          const id = typeof b.id === "string" ? b.id : `task-${this.agentCount}`;
          const newAgent = this.registerAgent(id, name);
          this.emit({
            type: "agent-spawned",
            agentId: newAgent.id,
            agentName: newAgent.name,
            agentColor: newAgent.color,
            parentAgentId: agent.id,
            message: `Spawning teammate: ${newAgent.name}`,
            timestamp: Date.now(),
          });
          // Immediately emit activity so agent transitions to "active"
          this.emit({
            type: "agent-activity",
            agentId: newAgent.id,
            agentName: newAgent.name,
            agentColor: newAgent.color,
            message: `Working on: ${name}`,
            timestamp: Date.now(),
          });
          continue;
        }

        if (b.type === "tool_use" && typeof b.name === "string") {
          agent.status = "working";

          // TaskOutput: relay activity to the target agent
          if (b.name === "TaskOutput") {
            const inp = b.input as Record<string, unknown> | null;
            const taskId = inp?.task_id ?? inp?.taskId;
            if (typeof taskId === "string") {
              const target = this.agents.get(taskId);
              if (target && target.status !== "done") {
                target.status = "working";
                this.emit({
                  type: "agent-activity",
                  agentId: target.id,
                  agentName: target.name,
                  agentColor: target.color,
                  message: "Processing...",
                  timestamp: Date.now(),
                });
              }
            }
            continue;
          }

          const desc = describeToolUse(b.name, b.input);
          if (desc) {
            this.emit({
              type: "agent-activity",
              agentId: agent.id,
              agentName: agent.name,
              agentColor: agent.color,
              message: desc,
              tool: b.name,
              timestamp: Date.now(),
            });
          }
          continue;
        }

        if (b.type === "text" && typeof b.text === "string") {
          const text = (b.text as string).trim();
          if (text.length > 0 && !isInternalNoise(text)) {
            // Emit full text as agent-text for chat panel
            this.emit({
              type: "agent-text",
              agentId: agent.id,
              agentName: agent.name,
              agentColor: agent.color,
              message: text,
              timestamp: Date.now(),
            });
          }
        }
      }
      return;
    }

    // Tool progress — throttled
    if (msg.type === "tool_progress") {
      const agent = this.resolveAgent(msg.parent_tool_use_id as string | null);
      const elapsed = msg.elapsed_time_seconds as number;
      const now = Date.now();
      if (elapsed >= 3 && now - agent.lastProgressPrint >= 5000) {
        agent.lastProgressPrint = now;
        this.emit({
          type: "progress",
          agentId: agent.id,
          agentName: agent.name,
          message: `${msg.tool_name} (${Math.round(elapsed)}s)`,
          timestamp: now,
        });
      }
      return;
    }

    // Agent completion — detect from tool_result blocks in user messages
    if (msg.type === "user" && "message" in msg) {
      const userMsg = msg.message as Record<string, unknown> | null;
      const content = userMsg?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== "object") continue;
          const rb = block as Record<string, unknown>;
          if (rb.type === "tool_result" && typeof rb.tool_use_id === "string") {
            const agent = this.agents.get(rb.tool_use_id);
            if (agent && agent.status !== "done") {
              agent.status = "done";
              this.emit({
                type: "agent-done",
                agentId: agent.id,
                agentName: agent.name,
                agentColor: agent.color,
                message: "Done",
                timestamp: Date.now(),
              });
            }
          }
        }
      }
      // Also check via parent_tool_use_id (subagent messages forwarded by SDK)
      if (msg.parent_tool_use_id && "tool_use_result" in msg && msg.tool_use_result != null) {
        const agent = this.agents.get(msg.parent_tool_use_id as string);
        if (agent && agent.status !== "done") {
          agent.status = "done";
          this.emit({
            type: "agent-done",
            agentId: agent.id,
            agentName: agent.name,
            agentColor: agent.color,
            message: "Done",
            timestamp: Date.now(),
          });
        }
      }
      return;
    }

    // Result
    if (msg.type === "result") {
      this.emit({ type: "session-end", message: "Session ended", timestamp: Date.now() });
    }
  };

  private emit(event: SessionEvent): void {
    this.getWindow()?.webContents.send("session:event", event);
  }

  private registerAgent(toolUseId: string, name: string): AgentInfo {
    this.agentCount++;
    const displayName = this.hasName(name) ? `${name}-${this.agentCount}` : name;
    const agent: AgentInfo = {
      id: toolUseId,
      name: displayName,
      color: GUI_COLORS[this.nextColorIndex % GUI_COLORS.length],
      status: "spawning",
      lastProgressPrint: 0,
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
}
