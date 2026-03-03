interface ProviderConfig {
    type: string;
    apiKey: string;
}
interface TierConfig {
    provider: string;
    model: string;
}
type RoleMapping = string | TierConfig;
interface NotificationConfig {
    provider: string;
    webhook: string;
    events: string[];
}
interface GlobalConfig {
    forgeVersion: string;
    providers: Record<string, ProviderConfig>;
    tiers: Record<string, TierConfig>;
    roles: Record<string, RoleMapping>;
    notifications?: NotificationConfig;
}
interface ProjectEntry {
    source: string;
    target: string;
    createdAt: string;
    currentStage: string;
}
interface ProjectRegistry {
    activeProject: string | null;
    projects: Record<string, ProjectEntry>;
}
interface ProjectConfig {
    forgeVersion: string;
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
type StageName = "inspect" | "design" | "plan" | "split" | "execute";
interface StageStatus {
    stage: StageName;
    complete: boolean;
    artifactPath: string;
    modifiedAt?: Date;
}
interface StageCost {
    timestamp: string;
    teammates: number;
    tier: string;
    duration: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
}
interface CostTracking {
    stages: Record<string, StageCost>;
    totalCost: number;
}
interface LogEntry {
    action: string;
    status: string;
    duration?: string;
    cost?: number;
    teammates?: number;
    details?: string;
}

declare const STAGE_ARTIFACTS: Record<StageName, string>;
declare const STAGE_DIRS: Record<StageName, string>;
declare const STAGE_ORDER: StageName[];
declare function getStageDir(stage: StageName): string;
declare function getStagesAfter(stage: StageName): StageName[];
declare function isValidStage(name: string): name is StageName;
declare function getStageOrder(): StageName[];

interface ProgressReporter {
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

/** Structured event emitted during agent sessions for GUI rendering. */
interface SessionEvent {
    type: "agent-spawned" | "agent-activity" | "agent-done" | "session-start" | "session-end" | "progress" | "error";
    agentId?: string;
    agentName?: string;
    agentColor?: string;
    message?: string;
    tool?: string;
    timestamp: number;
}
/** Type-safe IPC channel names. */
type IpcChannel = "project:list" | "project:get-active" | "project:set-active" | "project:create" | "project:destroy" | "project:status" | "config:read-global" | "stage:run" | "stage:abort" | "stage:revert" | "session:send-message" | "session:event" | "costs:read" | "project:read-artifacts" | "dialog:open-directory" | "dialog:open-file" | "dialog:save-file" | "project:update" | "project:clone-repo" | "project:extract-archive" | "reporter:log" | "reporter:warn" | "reporter:error";
/** Options for running a pipeline stage via IPC. */
interface StageRunOptions {
    projectName?: string;
    stage: StageName;
    options?: {
        dryRun?: boolean;
        budget?: number;
        brief?: string;
        briefFile?: string;
        excludeStyle?: boolean;
        tier?: string;
        model?: string;
    };
}

export { type CostTracking, type GlobalConfig, type IpcChannel, type LogEntry, type NotificationConfig, type ProgressReporter, type ProjectConfig, type ProjectEntry, type ProjectRegistry, type ProviderConfig, type RoleMapping, STAGE_ARTIFACTS, STAGE_DIRS, STAGE_ORDER, type SessionEvent, type StageCost, type StageName, type StageRunOptions, type StageStatus, type TierConfig, getStageDir, getStageOrder, getStagesAfter, isValidStage };
