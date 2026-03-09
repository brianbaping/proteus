import { create } from "zustand";

interface ChatMessage {
  role: "ai" | "user";
  text: string;
  timestamp: number;
  agentName?: string;
  agentColor?: string;
}

interface ChatState {
  messages: ChatMessage[];
  inputValue: string;

  addMessage(role: "ai" | "user", text: string, agent?: { name: string; color: string }): void;
  setInput(value: string): void;
  clearMessages(): void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  inputValue: "",

  addMessage: (role, text, agent) => set((state) => ({
    messages: [...state.messages, { role, text, timestamp: Date.now(), agentName: agent?.name, agentColor: agent?.color }],
  })),

  setInput: (value) => set({ inputValue: value }),

  clearMessages: () => set({ messages: [] }),
}));
