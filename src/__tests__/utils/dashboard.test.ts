import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AgentDashboard } from "../../utils/dashboard.js";

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

  it("suppresses text blocks >= 200 characters", () => {
    dashboard.onMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [{ type: "text", text: "x".repeat(200) }],
      },
      uuid: "u8",
      session_id: "s1",
    } as never);

    expect(writeSpy).not.toHaveBeenCalled();
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

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("specialist");
    expect(output).toContain("specialist-2");
  });
});
