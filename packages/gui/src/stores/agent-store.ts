import { create } from "zustand";
import type { StageName, SessionEvent } from "@proteus-forge/shared";

export interface AgentMessage {
  text: string;
  tool?: string;
  timestamp: number;
  type?: "log" | "warn" | "error";
}

export interface AgentNode {
  id: string;
  name: string;
  color: string;
  status: "spawned" | "active" | "done";
  parentId: string | null;
  messages: AgentMessage[];
  startTime: number;
  endTime?: number;
}

export interface AgentTree {
  agents: Map<string, AgentNode>;
  rootIds: string[];
  startTime: number;
  endTime?: number;
}

/** JSON-safe shape for persisting an AgentTree to disk. */
export interface SerializedAgentTree {
  agents: Array<[string, AgentNode]>;
  rootIds: string[];
  startTime: number;
  endTime?: number;
}

export function serializeTree(tree: AgentTree): SerializedAgentTree {
  return {
    agents: Array.from(tree.agents.entries()),
    rootIds: [...tree.rootIds],
    startTime: tree.startTime,
    endTime: tree.endTime,
  };
}

export function deserializeTree(data: SerializedAgentTree): AgentTree {
  return {
    agents: new Map(data.agents),
    rootIds: [...data.rootIds],
    startTime: data.startTime,
    endTime: data.endTime,
  };
}

interface AgentState {
  currentTree: AgentTree | null;
  currentStage: StageName | null;
  phaseHistory: Partial<Record<StageName, AgentTree>>;

  startRun(stage: StageName): void;
  handleSessionEvent(event: SessionEvent): void;
  handleReporterMessage(type: "log" | "warn" | "error", text: string): void;
  endRun(): void;
  loadPhaseHistory(stage: StageName, tree: AgentTree): void;
  clearHistory(): void;
  reset(): void;
}

function createTree(): AgentTree {
  const now = Date.now();
  const lead: AgentNode = {
    id: "lead",
    name: "Lead",
    color: "#00ff88",
    status: "active",
    parentId: null,
    messages: [],
    startTime: now,
  };
  const agents = new Map<string, AgentNode>();
  agents.set("lead", lead);
  return { agents, rootIds: ["lead"], startTime: now };
}

function cloneTree(tree: AgentTree): AgentTree {
  const agents = new Map<string, AgentNode>();
  for (const [id, node] of tree.agents) {
    agents.set(id, { ...node, messages: [...node.messages] });
  }
  return { agents, rootIds: [...tree.rootIds], startTime: tree.startTime, endTime: tree.endTime };
}

export const useAgentStore = create<AgentState>((set) => ({
  currentTree: null,
  currentStage: null,
  phaseHistory: {},

  startRun: (stage) => set({
    currentTree: createTree(),
    currentStage: stage,
  }),

  handleSessionEvent: (event) => set((state) => {
    if (!state.currentTree) return state;
    const tree = cloneTree(state.currentTree);

    switch (event.type) {
      case "agent-spawned": {
        const id = event.agentId ?? `agent-${tree.agents.size}`;
        const parentId = event.parentAgentId ?? null;
        const node: AgentNode = {
          id,
          name: event.agentName ?? "agent",
          color: event.agentColor ?? "#888888",
          status: "spawned",
          parentId,
          messages: [],
          startTime: event.timestamp,
        };
        tree.agents.set(id, node);
        tree.rootIds.push(id);
        break;
      }
      case "agent-activity":
      case "agent-text":
      case "progress": {
        const agentId = event.agentId ?? "lead";
        const agent = tree.agents.get(agentId);
        if (agent) {
          agent.status = "active";
          agent.messages.push({
            text: event.message ?? "",
            tool: event.tool,
            timestamp: event.timestamp,
          });
        }
        break;
      }
      case "agent-done": {
        const agentId = event.agentId ?? "lead";
        const agent = tree.agents.get(agentId);
        if (agent) {
          agent.status = "done";
          agent.endTime = event.timestamp;
        }
        break;
      }
      case "session-start":
      case "session-end": {
        const lead = tree.agents.get("lead");
        if (lead && event.message) {
          lead.messages.push({
            text: event.message,
            timestamp: event.timestamp,
          });
        }
        if (event.type === "session-end") {
          tree.endTime = event.timestamp;
        }
        break;
      }
    }

    return { currentTree: tree };
  }),

  handleReporterMessage: (type, text) => set((state) => {
    if (!state.currentTree) return state;
    const tree = cloneTree(state.currentTree);
    const lead = tree.agents.get("lead");
    if (lead) {
      lead.messages.push({
        text,
        timestamp: Date.now(),
        type,
      });
    }
    return { currentTree: tree };
  }),

  endRun: () => set((state) => {
    if (!state.currentTree || !state.currentStage) return state;
    const snapshot = cloneTree(state.currentTree);
    snapshot.endTime = snapshot.endTime ?? Date.now();
    return {
      currentTree: null,
      phaseHistory: {
        ...state.phaseHistory,
        [state.currentStage]: snapshot,
      },
      currentStage: null,
    };
  }),

  loadPhaseHistory: (stage, tree) => set((state) => ({
    phaseHistory: { ...state.phaseHistory, [stage]: tree },
  })),

  clearHistory: () => set({
    currentTree: null,
    currentStage: null,
    phaseHistory: {},
  }),

  reset: () => set({
    currentTree: null,
    currentStage: null,
    phaseHistory: {},
  }),
}));
