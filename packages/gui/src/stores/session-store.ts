import { create } from "zustand";
import type { StageName } from "@proteus-forge/shared";

interface SessionState {
  isRunning: boolean;
  currentStage: StageName | null;
  logs: string[];
  errors: string[];
  cost: number;
  duration: string;
  sessionId: string;

  startStage(stage: StageName): void;
  addLog(message: string): void;
  addError(message: string): void;
  endSession(success: boolean, cost: number, duration: string, sessionId: string): void;
  reset(): void;
}

export const useSessionStore = create<SessionState>((set) => ({
  isRunning: false,
  currentStage: null,
  logs: [],
  errors: [],
  cost: 0,
  duration: "",
  sessionId: "",

  startStage: (stage) => set({
    isRunning: true,
    currentStage: stage,
    logs: [],
    errors: [],
    cost: 0,
    duration: "",
    sessionId: "",
  }),

  addLog: (message) => set((state) => ({
    logs: [...state.logs, message],
  })),

  addError: (message) => set((state) => ({
    errors: [...state.errors, message],
  })),

  endSession: (_success, cost, duration, sessionId) => set({
    isRunning: false,
    cost,
    duration,
    sessionId,
  }),

  reset: () => set({
    isRunning: false,
    currentStage: null,
    logs: [],
    errors: [],
    cost: 0,
    duration: "",
    sessionId: "",
  }),
}));
