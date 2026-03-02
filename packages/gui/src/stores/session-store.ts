import { create } from "zustand";
import type { StageName } from "@proteus-forge/shared";

interface SessionState {
  isRunning: boolean;
  currentStage: StageName | null;
  logs: string[];
  errors: string[];
  cost: number;
  duration: string;

  startStage(stage: StageName): void;
  addLog(message: string): void;
  addError(message: string): void;
  endSession(success: boolean, cost: number, duration: string): void;
  reset(): void;
}

export const useSessionStore = create<SessionState>((set) => ({
  isRunning: false,
  currentStage: null,
  logs: [],
  errors: [],
  cost: 0,
  duration: "",

  startStage: (stage) => set({
    isRunning: true,
    currentStage: stage,
    logs: [],
    errors: [],
    cost: 0,
    duration: "",
  }),

  addLog: (message) => set((state) => ({
    logs: [...state.logs, message],
  })),

  addError: (message) => set((state) => ({
    errors: [...state.errors, message],
  })),

  endSession: (success, cost, duration) => set({
    isRunning: false,
    cost,
    duration,
  }),

  reset: () => set({
    isRunning: false,
    currentStage: null,
    logs: [],
    errors: [],
    cost: 0,
    duration: "",
  }),
}));
