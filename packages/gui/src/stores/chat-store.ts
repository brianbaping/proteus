import { create } from "zustand";

export interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  agentName?: string;
  agentColor?: string;
  text: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  panelOpen: boolean;

  addUserMessage(text: string): void;
  addAgentMessage(agentName: string, agentColor: string, text: string): void;
  togglePanel(): void;
  clear(): void;
  reset(): void;
}

let nextId = 0;
function genId(): string {
  return `chat-${++nextId}`;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  panelOpen: false,

  addUserMessage: (text) => set((state) => ({
    messages: [
      ...state.messages,
      { id: genId(), sender: "user", text, timestamp: Date.now() },
    ],
    panelOpen: true,
  })),

  addAgentMessage: (agentName, agentColor, text) => set((state) => ({
    messages: [
      ...state.messages,
      { id: genId(), sender: "agent", agentName, agentColor, text, timestamp: Date.now() },
    ],
    panelOpen: true,
  })),

  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

  clear: () => set({ messages: [] }),

  reset: () => set({ messages: [], panelOpen: false }),
}));
