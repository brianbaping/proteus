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
  completedStages: StageName[];

  startStage(stage: StageName): void;
  addLog(message: string): void;
  addError(message: string): void;
  endSession(success: boolean, cost: number, duration: string, sessionId: string): void;
  completeStage(stage: StageName): void;
  initCompletedStages(stages: StageName[]): void;
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
  completedStages: [],

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

  completeStage: (stage) => set((state) => ({
    completedStages: state.completedStages.includes(stage)
      ? state.completedStages
      : [...state.completedStages, stage],
  })),

  initCompletedStages: (stages) => set({ completedStages: stages }),

  reset: () => set({
    isRunning: false,
    currentStage: null,
    logs: [],
    errors: [],
    cost: 0,
    duration: "",
    sessionId: "",
    completedStages: [],
  }),
}));
