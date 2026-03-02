import { create } from "zustand";

interface ChatMessage {
  role: "ai" | "user";
  text: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  inputValue: string;

  addMessage(role: "ai" | "user", text: string): void;
  setInput(value: string): void;
  clearMessages(): void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  inputValue: "",

  addMessage: (role, text) => set((state) => ({
    messages: [...state.messages, { role, text, timestamp: Date.now() }],
  })),

  setInput: (value) => set({ inputValue: value }),

  clearMessages: () => set({ messages: [] }),
}));
