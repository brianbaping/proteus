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

// Role-to-tier or role-to-specific-model mapping
export type RoleMapping = string | TierConfig;

// Notification configuration
export interface NotificationConfig {
  provider: string;
  webhook: string;
  events: string[];
}

// Global config (~/.proteus/config.json)
export interface GlobalConfig {
  proteusVersion: string;
  providers: Record<string, ProviderConfig>;
  tiers: Record<string, TierConfig>;
  roles: Record<string, RoleMapping>;
  notifications?: NotificationConfig;
}

// Project entry in the registry
export interface ProjectEntry {
  source: string;
  target: string;
  createdAt: string;
  currentStage: string;
}

// Project registry (~/.proteus/projects.json)
export interface ProjectRegistry {
  activeProject: string | null;
  projects: Record<string, ProjectEntry>;
}

// Project-level config ({target}/.proteus/config.json)
export interface ProjectConfig {
  proteusVersion: string;
  projectName: string;
  source: {
    path: string;
    readonly: true;
  };
  overrides?: {
    roles?: Record<string, RoleMapping>;
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
}

export interface CostTracking {
  stages: Record<string, StageCost>;
  totalCost: number;
}
