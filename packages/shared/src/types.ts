// Provider configuration
export interface ProviderConfig {
  type: string;
  apiKey: string;
}

// Model tier mapping
export interface TierConfig {
  provider: string;
  model: string;
}

// Phase-to-tier or phase-to-specific-model mapping
export type PhaseMapping = string | TierConfig;

// Notification configuration
export interface NotificationConfig {
  provider: string;
  webhook: string;
  events: string[];
}

// Global config (~/.proteus-forge/config.json)
export interface GlobalConfig {
  forgeVersion: string;
  providers: Record<string, ProviderConfig>;
  tiers: Record<string, TierConfig>;
  phases: Record<string, PhaseMapping>;
  notifications?: NotificationConfig;
  /** Max output tokens per Claude Code response (sets CLAUDE_CODE_MAX_OUTPUT_TOKENS). */
  maxOutputTokens?: number;
  /** Electron zoom level (-3 to 5). Persisted across restarts. */
  zoomLevel?: number;
  /** GUI color theme. Defaults to "dark". */
  theme?: string;
}

// Project entry in the registry
export interface ProjectEntry {
  source: string;
  target: string;
  createdAt: string;
  lastCompletedStage: string;
}

// Project registry (~/.proteus-forge/projects.json)
export interface ProjectRegistry {
  activeProject: string | null;
  projects: Record<string, ProjectEntry>;
}

// Project-level config ({target}/.proteus-forge/config.json)
export interface ProjectConfig {
  forgeVersion: string;
  projectName: string;
  source: {
    path: string;
    readonly: true;
  };
  overrides?: {
    phases?: Record<string, PhaseMapping>;
  };
  hooks?: Record<string, string>;
}

// Pipeline stage names
export type StageName =
  | "inspect"
  | "design"
  | "plan"
  | "split"
  | "execute";

// Stage status for display
export interface StageStatus {
  stage: StageName;
  complete: boolean;
  artifactPath: string;
  modifiedAt?: Date;
}

// Cost tracking entry
export interface StageCost {
  timestamp: string;
  teammates: number;
  tier: string;
  duration: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  sessionId?: string;
}

export interface CostTracking {
  stages: Record<string, StageCost>;
  totalCost: number;
}

// Log entry
export interface LogEntry {
  action: string;
  status: string;
  duration?: string;
  cost?: number;
  teammates?: number;
  details?: string;
}
