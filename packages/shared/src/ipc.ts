import type { StageName } from "./types.js";

/** Structured event emitted during agent sessions for GUI rendering. */
export interface SessionEvent {
  type: "agent-spawned" | "agent-activity" | "agent-done" | "session-start" | "session-end" | "progress" | "error";
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  message?: string;
  tool?: string;
  timestamp: number;
}

/** Type-safe IPC channel names. */
export type IpcChannel =
  | "project:list"
  | "project:get-active"
  | "project:set-active"
  | "project:create"
  | "project:destroy"
  | "project:status"
  | "config:read-global"
  | "config:write-global"
  | "stage:run"
  | "stage:abort"
  | "stage:revert"
  | "session:send-message"
  | "session:event"
  | "costs:read"
  | "project:read-artifacts"
  | "dialog:open-directory"
  | "dialog:open-file"
  | "dialog:save-file"
  | "project:update"
  | "project:clone-repo"
  | "project:open-artifact"
  | "project:extract-archive"
  | "reporter:log"
  | "reporter:warn"
  | "reporter:error";

/** Options for running a pipeline stage via IPC. */
export interface StageRunOptions {
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
