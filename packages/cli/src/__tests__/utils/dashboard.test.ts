import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AgentDashboard } from "../../utils/dashboard.js";

// Helper to collect all stdout output as a single string
function collectOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c: unknown[]) => c[0]).join("");
}

describe("AgentDashboard", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let dashboard: AgentDashboard;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    dashboard = new AgentDashboard("inspect");
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("prints session start on init message", () => {
    dashboard.onMessage({
      type: "system",
      subtype: "init",
      session_id: "s1",
      uuid: "u1",
    } as never);

    expect(writeSpy).toHaveBeenCalled();
    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("Lead");
    expect(output).toContain("Session started (inspect)");
  });

  it("detects agent spawning from Task tool_use blocks", () => {
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          {
            type: "tool_use",
            id: "toolu_123",
            name: "Task",
            input: { name: "auth-specialist", prompt: "analyze auth" },
          },
        ],
      },
      uuid: "u2",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("Spawning teammate: auth-specialist");
    expect(output).toContain("Started");
  });

  it("extracts agent name from description when name is missing", () => {
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          {
            type: "tool_use",
            id: "toolu_456",
            name: "Task",
            input: { description: "data analysis", prompt: "analyze data" },
          },
        ],
      },
      uuid: "u3",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("data analysis");
  });

  it("falls back to 'agent' when no name or description", () => {
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          {
            type: "tool_use",
            id: "toolu_789",
            name: "Task",
            input: { prompt: "do something" },
          },
        ],
      },
      uuid: "u4",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("agent");
  });

  it("associates child messages with spawned agent via parent_tool_use_id", () => {
    // Spawn an agent
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          {
            type: "tool_use",
            id: "toolu_ABC",
            name: "Task",
            input: { name: "backend-eng" },
          },
        ],
      },
      uuid: "u5",
      session_id: "s1",
    } as never);

    writeSpy.mockClear();

    // Child message from the spawned agent
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: "toolu_ABC",
      message: {
        content: [{ type: "text", text: "Reading database schema" }],
      },
      uuid: "u6",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("backend-eng");
    expect(output).toContain("Reading database schema");
  });

  it("shows text from lead agent when parent_tool_use_id is null", () => {
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [{ type: "text", text: "Analyzing repository" }],
      },
      uuid: "u7",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("Lead");
    expect(output).toContain("Analyzing repository");
  });

  it("truncates text blocks >= 200 characters", () => {
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [{ type: "text", text: "x".repeat(300) }],
      },
      uuid: "u8",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("...");
  });

  it("shows tool progress after 3 seconds", () => {
    dashboard.onMessage({
      type: "tool_progress",
      tool_use_id: "tu1",
      tool_name: "Bash",
      parent_tool_use_id: null,
      elapsed_time_seconds: 5,
      uuid: "u9",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("Bash");
    expect(output).toContain("5s");
  });

  it("suppresses tool progress under 3 seconds", () => {
    dashboard.onMessage({
      type: "tool_progress",
      tool_use_id: "tu2",
      tool_name: "Read",
      parent_tool_use_id: null,
      elapsed_time_seconds: 1,
      uuid: "u10",
      session_id: "s1",
    } as never);

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("throttles tool progress to max one per 5 seconds per agent", () => {
    // First progress — should print
    dashboard.onMessage({
      type: "tool_progress",
      tool_use_id: "tu3",
      tool_name: "Bash",
      parent_tool_use_id: null,
      elapsed_time_seconds: 4,
      uuid: "u11",
      session_id: "s1",
    } as never);

    expect(writeSpy).toHaveBeenCalledTimes(1);
    writeSpy.mockClear();

    // Second progress immediately after — should be throttled
    dashboard.onMessage({
      type: "tool_progress",
      tool_use_id: "tu3",
      tool_name: "Bash",
      parent_tool_use_id: null,
      elapsed_time_seconds: 5,
      uuid: "u12",
      session_id: "s1",
    } as never);

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("marks agent as done on user message with tool_use_result", () => {
    // Spawn agent
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          {
            type: "tool_use",
            id: "toolu_DONE",
            name: "Task",
            input: { name: "qa-agent" },
          },
        ],
      },
      uuid: "u13",
      session_id: "s1",
    } as never);

    writeSpy.mockClear();

    // Agent completes
    dashboard.onMessage({
      type: "user",
      parent_tool_use_id: "toolu_DONE",
      tool_use_result: { success: true },
      message: { role: "user", content: "" },
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("qa-agent");
    expect(output).toContain("Done");
  });

  it("prints summary on result message when agents were spawned", () => {
    // Spawn an agent
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          {
            type: "tool_use",
            id: "toolu_SUM",
            name: "Task",
            input: { name: "test-agent" },
          },
        ],
      },
      uuid: "u14",
      session_id: "s1",
    } as never);

    writeSpy.mockClear();

    dashboard.onMessage({
      type: "result",
      subtype: "success",
      uuid: "u15",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("Agent Team (1 teammate)");
    expect(output).toContain("test-agent");
  });

  it("skips summary when no agents were spawned", () => {
    dashboard.onMessage({
      type: "result",
      subtype: "success",
      uuid: "u16",
      session_id: "s1",
    } as never);

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("suppresses TodoWrite and other internal tool use from output", () => {
    const internalTools = ["TodoWrite", "TodoRead", "TaskOutput", "TaskStop", "TeamCreate", "TeamDelete", "EnterPlanMode", "ExitPlanMode", "AskUserQuestion"];
    for (const toolName of internalTools) {
      writeSpy.mockClear();
      dashboard.onMessage({
        type: "assistant",
        parent_tool_use_id: null,
        message: {
          content: [
            { type: "tool_use", id: `tu-${toolName}`, name: toolName, input: {} },
          ],
        },
        uuid: `u-${toolName}`,
        session_id: "s1",
      } as never);

      const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
      expect(output).not.toContain(toolName);
    }
  });

  it("filters text containing TodoWrite from agent output", () => {
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [{ type: "text", text: "Using TodoWrite to update the task list" }],
      },
      uuid: "u-noise",
      session_id: "s1",
    } as never);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).not.toContain("TodoWrite");
  });

  it("deduplicates agent names by appending a count", () => {
    // Spawn two agents with the same name
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          { type: "tool_use", id: "t1", name: "Task", input: { name: "specialist" } },
          { type: "tool_use", id: "t2", name: "Task", input: { name: "specialist" } },
        ],
      },
      uuid: "u17",
      session_id: "s1",
    } as never);

    const output = collectOutput(writeSpy);
    expect(output).toContain("specialist");
    expect(output).toContain("specialist-2");
  });
});

describe("AgentDashboard (TTY mode)", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let dashboard: AgentDashboard;
  let originalIsTTY: boolean | undefined;
  let originalColumns: number | undefined;
  let exitListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    originalIsTTY = process.stdout.isTTY;
    originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, "isTTY", { value: true, writable: true, configurable: true });
    Object.defineProperty(process.stdout, "columns", { value: 80, writable: true, configurable: true });
    writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    exitListenerSpy = vi.spyOn(process, "on");
    removeListenerSpy = vi.spyOn(process, "removeListener");
    dashboard = new AgentDashboard("design");
  });

  afterEach(() => {
    dashboard.cleanup();
    writeSpy.mockRestore();
    exitListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
    Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, writable: true, configurable: true });
    Object.defineProperty(process.stdout, "columns", { value: originalColumns, writable: true, configurable: true });
    vi.useRealTimers();
  });

  function sendInit(): void {
    dashboard.onMessage({
      type: "system",
      subtype: "init",
      session_id: "s1",
      uuid: "u1",
    } as never);
  }

  function spawnAgent(id: string, name: string): void {
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          { type: "tool_use", id, name: "Task", input: { name } },
        ],
      },
      uuid: `u-spawn-${id}`,
      session_id: "s1",
    } as never);
  }

  it("draws status board with lead agent after init", () => {
    sendInit();
    const output = collectOutput(writeSpy);
    // Should contain the scrolling line and then a status board line for Lead
    expect(output).toContain("Session started (design)");
    // Status board should have the bullet character for Lead
    const lines = output.split("\n").filter((l: string) => l.includes("●") && l.includes("Lead"));
    // At least 2: one scrolling line + one status board line
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it("updates status line on tool_use without adding scrolling lines", () => {
    sendInit();
    writeSpy.mockClear();

    // Send a tool_use (Read) — in TTY mode this should only redraw the board, no scrolling
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          { type: "tool_use", id: "tu-read1", name: "Read", input: { file_path: "/src/index.ts" } },
        ],
      },
      uuid: "u-tool1",
      session_id: "s1",
    } as never);

    const output = collectOutput(writeSpy);
    // Should contain the activity in a status line, not a separate scrolling line
    expect(output).toContain("Reading");
    expect(output).toContain("index.ts");
    // The output should contain cursor-up sequences (redraw), not plain scrolling format
    expect(output).toContain("\x1b["); // ANSI escape present
  });

  it("prints scrolling line above status board for text messages", () => {
    sendInit();
    writeSpy.mockClear();

    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [{ type: "text", text: "Analyzing the codebase structure" }],
      },
      uuid: "u-text1",
      session_id: "s1",
    } as never);

    const output = collectOutput(writeSpy);
    // Text message should scroll (appear in output) AND board should be redrawn after
    expect(output).toContain("Analyzing the codebase structure");
    // Board should be redrawn (contains status line)
    expect(output).toContain("Lead");
  });

  it("adds new agent to status board on spawn", () => {
    sendInit();
    writeSpy.mockClear();

    spawnAgent("toolu_A1", "scout");

    const output = collectOutput(writeSpy);
    // Should see both Lead and scout in the status board
    expect(output).toContain("scout");
    expect(output).toContain("Spawning teammate: scout");
    // Count status board bullets — should have at least 2 agents (Lead + scout)
    const bulletLines = output.split("\n").filter((l: string) => l.includes("●"));
    expect(bulletLines.length).toBeGreaterThanOrEqual(2);
  });

  it("ticks elapsed time on 1s interval", () => {
    sendInit();
    writeSpy.mockClear();

    // Advance time by 2 seconds to trigger refresh timer
    vi.advanceTimersByTime(2000);

    // The refresh timer should have fired and redrawn
    expect(writeSpy).toHaveBeenCalled();
    const output = collectOutput(writeSpy);
    // Should see elapsed time in the status line
    expect(output).toContain("s");
  });

  it("cleanup erases board and shows cursor", () => {
    sendInit();
    writeSpy.mockClear();

    dashboard.cleanup();

    const output = collectOutput(writeSpy);
    // Should contain SHOW_CURSOR
    expect(output).toContain("\x1b[?25h");
    // Should contain CLEAR_LINE (erasing the board)
    expect(output).toContain("\x1b[2K");
  });

  it("cleanup clears refresh timer so no writes after cleanup", () => {
    sendInit();
    dashboard.cleanup();
    writeSpy.mockClear();

    // Advance timers — no writes should happen since timer was cleared
    vi.advanceTimersByTime(5000);

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("shows Done checkmark in status line when agent completes", () => {
    sendInit();
    spawnAgent("toolu_D1", "worker");
    writeSpy.mockClear();

    dashboard.onMessage({
      type: "user",
      parent_tool_use_id: "toolu_D1",
      tool_use_result: { success: true },
      message: { role: "user", content: "" },
      session_id: "s1",
    } as never);

    const output = collectOutput(writeSpy);
    // In TTY mode, done status updates the board in-place
    expect(output).toContain("Done");
    expect(output).toContain("✓");
  });

  it("truncates activity to fit terminal width", () => {
    Object.defineProperty(process.stdout, "columns", { value: 40, writable: true, configurable: true });
    sendInit();
    writeSpy.mockClear();

    // Send a tool_use with a very long description
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [
          { type: "tool_use", id: "tu-long", name: "Bash", input: { command: "a".repeat(100) } },
        ],
      },
      uuid: "u-long",
      session_id: "s1",
    } as never);

    const output = collectOutput(writeSpy);
    // Activity should be truncated with "..."
    expect(output).toContain("...");
  });

  it("hides cursor on first board draw", () => {
    sendInit();

    const output = collectOutput(writeSpy);
    // HIDE_CURSOR should be in the output
    expect(output).toContain("\x1b[?25l");
  });
});
