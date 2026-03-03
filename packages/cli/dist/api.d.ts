import { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { StageCost, ProjectEntry, ProjectRegistry, GlobalConfig, ProjectConfig, StageName, StageStatus, CostTracking, ProgressReporter, LogEntry } from '@proteus-forge/shared';

interface LaunchOptions {
    prompt: string;
    cwd: string;
    additionalDirectories?: string[];
    model?: string;
    maxBudgetUsd?: number;
    permissionMode?: Options["permissionMode"];
    onMessage?: (message: SDKMessage) => void;
    /** Directory to watch for incoming user messages (file-based inbox). */
    inboxDir?: string;
}
interface SessionResult {
    success: boolean;
    sessionId: string;
    cost: StageCost;
    result?: string;
    errors?: string[];
}
/**
 * Launch a Claude Code session via the Agent SDK.
 * This is the core interface between Proteus Forge and Claude Code.
 */
declare function launchSession(options: LaunchOptions): Promise<SessionResult>;

declare function readRegistry(): Promise<ProjectRegistry>;
declare function writeRegistry(registry: ProjectRegistry): Promise<void>;
declare function registerProject(name: string, entry: ProjectEntry): Promise<void>;
declare function unregisterProject(name: string): Promise<void>;
declare function setActiveProject(name: string): Promise<void>;
declare function getActiveProject(): Promise<{
    name: string;
    entry: ProjectEntry;
} | null>;
declare function getProject(name: string): Promise<ProjectEntry | null>;
declare function updateProject(name: string, updates: Partial<ProjectEntry>): Promise<void>;

declare function getForgeDir(): string;
declare function getGlobalConfigPath(): string;
declare function getDefaultGlobalConfig(): GlobalConfig;
declare function readGlobalConfig(): Promise<GlobalConfig | null>;
declare function writeGlobalConfig(config: GlobalConfig): Promise<void>;
declare function globalConfigExists(): boolean;

declare function getProjectForgeDir(targetPath: string): string;
declare function ensureProjectDir(targetPath: string): Promise<void>;
declare function readProjectConfig(targetPath: string): Promise<ProjectConfig | null>;
declare function writeProjectConfig(targetPath: string, config: ProjectConfig): Promise<void>;
declare function createProjectConfig(name: string, sourcePath: string): ProjectConfig;

declare function getStageStatuses(targetPath: string): StageStatus[];
declare function getCurrentStage(targetPath: string): string;
declare function checkStaleness(targetPath: string): Array<{
    stage: StageName;
    staleReason: string;
}>;

declare function readCosts(targetPath: string): Promise<CostTracking>;
declare function appendCostEntry(targetPath: string, stage: string, cost: StageCost): Promise<void>;

/**
 * Get the inbox directory path for the active execute session.
 */
declare function getInboxDir(targetPath: string): string;
/**
 * Write a message to the inbox. Called by `proteus-forge inform`.
 */
declare function writeInboxMessage(targetPath: string, targetAgent: string, message: string): Promise<string>;
/**
 * Check if an execute session has an active inbox.
 */
declare function isInboxActive(targetPath: string): boolean;

/**
 * Run the inspect stage. Returns true on success, false on failure.
 * Exported for use by `proteus-forge run`.
 */
declare function runInspect(name: string | undefined, options: {
    dryRun?: boolean;
    budget?: number;
    excludeStyle?: boolean;
    tier?: string;
    model?: string;
}, reporter?: ProgressReporter, onMessage?: (msg: SDKMessage) => void): Promise<boolean>;

declare function runDesign(name: string | undefined, options: {
    dryRun?: boolean;
    budget?: number;
    brief?: string;
    briefFile?: string;
    tier?: string;
    model?: string;
}, reporter?: ProgressReporter, onMessage?: (msg: SDKMessage) => void): Promise<boolean>;

declare function runPlan(name: string | undefined, options: {
    dryRun?: boolean;
    budget?: number;
    tier?: string;
    model?: string;
}, reporter?: ProgressReporter, onMessage?: (msg: SDKMessage) => void): Promise<boolean>;

declare function runSplit(name: string | undefined, options: {
    dryRun?: boolean;
    budget?: number;
    tier?: string;
    model?: string;
}, reporter?: ProgressReporter, onMessage?: (msg: SDKMessage) => void): Promise<boolean>;

declare function runExecute(name: string | undefined, options: {
    dryRun?: boolean;
    budget?: number;
    tier?: string;
    model?: string;
    skipVerify?: boolean;
}, reporter?: ProgressReporter, onMessage?: (msg: SDKMessage) => void): Promise<boolean>;

/**
 * Run the style stage. Returns true on success, false on failure.
 * Exported for use by `proteus-forge run`.
 */
declare function runStyle(name: string | undefined, options: {
    dryRun?: boolean;
    budget?: number;
    tier?: string;
    model?: string;
}, reporter?: ProgressReporter, onMessage?: (msg: SDKMessage) => void): Promise<boolean>;

/**
 * Generates the Lead (scout) prompt for the inspect stage.
 * This prompt tells the Lead to:
 * 1. Scout the source repo to identify domains
 * 2. Create an Agent Team with specialist teammates
 * 3. Create tasks on the shared task list
 * 4. Wait for specialists to complete, then synthesize
 */
declare function generateInspectLeadPrompt(sourcePath: string, targetPath: string): string;

/**
 * Generates the Lead (architect) prompt for the design stage.
 * This prompt tells the Lead to:
 * 1. Read the inspect output (features.json)
 * 2. Scope the design domains
 * 3. Create an Agent Team with design specialists
 * 4. Wait for specialists to complete, then synthesize
 */
declare function generateDesignLeadPrompt(sourcePath: string, targetPath: string, brief?: string): string;

/**
 * Generates the Lead prompt for the plan stage.
 * Single agent, no teammates — reads design artifacts and produces a task DAG.
 */
declare function generatePlanLeadPrompt(sourcePath: string, targetPath: string): string;

/**
 * Generates the Lead prompt for the split stage.
 * Single agent, no teammates — reads the plan and partitions tasks into discipline tracks.
 */
declare function generateSplitLeadPrompt(targetPath: string): string;

interface Track {
    id: string;
    discipline: string;
    taskCount: number;
    file: string;
}
interface TrackDetail {
    trackId: string;
    discipline: string;
    tasks: string[];
    context: {
        targetStack: string;
        services: string[];
        sharedPatterns: string;
        fileOwnershipMap: Record<string, string[]>;
    };
}
interface PlanTask {
    id: string;
    title: string;
    description: string;
    discipline: string;
    dependsOn: string[];
    acceptanceCriteria: string[];
    fileOwnership: string[];
    testingExpectation: string;
    testScope?: string;
}
interface ExecuteContext {
    tracks: Track[];
    trackDetails: Map<string, TrackDetail>;
    tasks: PlanTask[];
    waveCount: number;
}
/**
 * Read track and plan artifacts to build context for the execute prompt.
 */
declare function loadExecuteContext(targetPath: string): Promise<ExecuteContext>;
/**
 * Generates the Lead (orchestrator) prompt for the execute stage.
 */
declare function generateExecuteLeadPrompt(sourcePath: string, targetPath: string, ctx: ExecuteContext): string;

/**
 * Generates the Lead prompt for the style stage.
 * Single agent, no teammates — reads source CSS/style files and produces a style guide.
 */
declare function generateStyleLeadPrompt(sourcePath: string, targetPath: string): string;

declare const terminalReporter: ProgressReporter;

/**
 * Real-time agent dashboard that processes SDK messages and displays
 * color-coded, per-agent activity in the terminal.
 */
declare class AgentDashboard {
    private stageName;
    private leadAgent;
    private agents;
    private nextColorIndex;
    private maxNameLen;
    private isTTY;
    private agentCount;
    constructor(stageName: string);
    onMessage(message: SDKMessage): void;
    cleanup(): void;
    private registerAgent;
    private hasName;
    private resolveAgent;
    private printLine;
    private printSummary;
}

/**
 * Create a real-time agent dashboard for a pipeline stage.
 * Shows color-coded, per-agent activity as the session runs.
 */
declare function createDashboard(stageName: string): AgentDashboard;

declare function revertStage(targetPath: string, stage: StageName): Promise<{
    removed: StageName[];
}>;

declare function appendLogEntry(targetPath: string, entry: LogEntry): Promise<void>;

export { AgentDashboard, type LaunchOptions, type SessionResult, appendCostEntry, appendLogEntry, checkStaleness, createDashboard, createProjectConfig, ensureProjectDir, generateDesignLeadPrompt, generateExecuteLeadPrompt, generateInspectLeadPrompt, generatePlanLeadPrompt, generateSplitLeadPrompt, generateStyleLeadPrompt, getActiveProject, getCurrentStage, getDefaultGlobalConfig, getForgeDir, getGlobalConfigPath, getInboxDir, getProject, getProjectForgeDir, getStageStatuses, globalConfigExists, isInboxActive, launchSession, loadExecuteContext, readCosts, readGlobalConfig, readProjectConfig, readRegistry, registerProject, revertStage, runDesign, runExecute, runInspect, runPlan, runSplit, runStyle, setActiveProject, terminalReporter, unregisterProject, updateProject, writeGlobalConfig, writeInboxMessage, writeProjectConfig, writeRegistry };
