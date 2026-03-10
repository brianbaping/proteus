import type { SessionEvent } from "@proteus-forge/shared";
import { useAgentStore, serializeTree, deserializeTree } from "../../stores/agent-store.js";
import type { AgentTree } from "../../stores/agent-store.js";

describe("useAgentStore", () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
  });

  it("has correct initial state", () => {
    const state = useAgentStore.getState();
    expect(state.currentTree).toBeNull();
    expect(state.currentStage).toBeNull();
    expect(state.phaseHistory).toEqual({});
  });

  describe("startRun", () => {
    it("creates a tree with Lead agent", () => {
      useAgentStore.getState().startRun("inspect");

      const { currentTree, currentStage } = useAgentStore.getState();
      expect(currentStage).toBe("inspect");
      expect(currentTree).not.toBeNull();
      expect(currentTree!.agents.size).toBe(1);

      const lead = currentTree!.agents.get("lead")!;
      expect(lead.id).toBe("lead");
      expect(lead.name).toBe("Lead");
      expect(lead.color).toBe("#00ff88");
      expect(lead.status).toBe("active");
      expect(lead.parentId).toBeNull();
      expect(lead.messages).toEqual([]);
    });

    it("sets rootIds to contain lead", () => {
      useAgentStore.getState().startRun("design");
      const { currentTree } = useAgentStore.getState();
      expect(currentTree!.rootIds).toEqual(["lead"]);
    });
  });

  describe("handleSessionEvent", () => {
    beforeEach(() => {
      useAgentStore.getState().startRun("inspect");
    });

    it("agent-spawned adds to rootIds regardless of parent", () => {
      const event: SessionEvent = {
        type: "agent-spawned",
        agentId: "task-1",
        agentName: "researcher",
        agentColor: "#ff6b6b",
        parentAgentId: "lead",
        timestamp: Date.now(),
      };
      useAgentStore.getState().handleSessionEvent(event);

      const { currentTree } = useAgentStore.getState();
      expect(currentTree!.agents.size).toBe(2);

      const child = currentTree!.agents.get("task-1")!;
      expect(child.name).toBe("researcher");
      expect(child.color).toBe("#ff6b6b");
      expect(child.status).toBe("spawned");
      expect(child.parentId).toBe("lead");
      // all agents appear as top-level rows
      expect(currentTree!.rootIds).toEqual(["lead", "task-1"]);
    });

    it("agent-spawned without parent also adds to rootIds", () => {
      const event: SessionEvent = {
        type: "agent-spawned",
        agentId: "task-1",
        agentName: "orphan",
        agentColor: "#aaa",
        timestamp: Date.now(),
      };
      useAgentStore.getState().handleSessionEvent(event);

      const { currentTree } = useAgentStore.getState();
      expect(currentTree!.rootIds).toEqual(["lead", "task-1"]);
    });

    it("agent-activity appends message and updates status", () => {
      // Spawn first
      useAgentStore.getState().handleSessionEvent({
        type: "agent-spawned",
        agentId: "task-1",
        agentName: "scout",
        agentColor: "#00ddcc",
        parentAgentId: "lead",
        timestamp: Date.now(),
      });

      // Activity
      useAgentStore.getState().handleSessionEvent({
        type: "agent-activity",
        agentId: "task-1",
        agentName: "scout",
        message: "Reading package.json",
        tool: "Read",
        timestamp: Date.now(),
      });

      const agent = useAgentStore.getState().currentTree!.agents.get("task-1")!;
      expect(agent.status).toBe("active");
      expect(agent.messages).toHaveLength(1);
      expect(agent.messages[0].text).toBe("Reading package.json");
      expect(agent.messages[0].tool).toBe("Read");
    });

    it("progress event updates status and appends message", () => {
      useAgentStore.getState().handleSessionEvent({
        type: "agent-spawned",
        agentId: "task-1",
        agentName: "scout",
        agentColor: "#00ddcc",
        parentAgentId: "lead",
        timestamp: Date.now(),
      });

      useAgentStore.getState().handleSessionEvent({
        type: "progress",
        agentId: "task-1",
        agentName: "scout",
        message: "Bash (15s)",
        timestamp: Date.now(),
      });

      const agent = useAgentStore.getState().currentTree!.agents.get("task-1")!;
      expect(agent.status).toBe("active");
      expect(agent.messages).toHaveLength(1);
      expect(agent.messages[0].text).toBe("Bash (15s)");
    });

    it("agent-done sets status and endTime", () => {
      const now = Date.now();
      useAgentStore.getState().handleSessionEvent({
        type: "agent-spawned",
        agentId: "task-1",
        agentName: "scout",
        agentColor: "#00ddcc",
        parentAgentId: "lead",
        timestamp: now,
      });

      useAgentStore.getState().handleSessionEvent({
        type: "agent-done",
        agentId: "task-1",
        agentName: "scout",
        timestamp: now + 5000,
      });

      const agent = useAgentStore.getState().currentTree!.agents.get("task-1")!;
      expect(agent.status).toBe("done");
      expect(agent.endTime).toBe(now + 5000);
    });

    it("session-start appends message under Lead", () => {
      useAgentStore.getState().handleSessionEvent({
        type: "session-start",
        message: "Session started",
        timestamp: Date.now(),
      });

      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages).toHaveLength(1);
      expect(lead.messages[0].text).toBe("Session started");
    });

    it("session-end sets tree endTime", () => {
      const endTs = Date.now() + 10000;
      useAgentStore.getState().handleSessionEvent({
        type: "session-end",
        message: "Session ended",
        timestamp: endTs,
      });

      const { currentTree } = useAgentStore.getState();
      expect(currentTree!.endTime).toBe(endTs);
    });

    it("does nothing when no currentTree", () => {
      useAgentStore.getState().reset();
      useAgentStore.getState().handleSessionEvent({
        type: "agent-activity",
        agentId: "lead",
        message: "test",
        timestamp: Date.now(),
      });
      expect(useAgentStore.getState().currentTree).toBeNull();
    });
  });

  describe("handleReporterMessage", () => {
    it("appends under Lead with type tag", () => {
      useAgentStore.getState().startRun("inspect");
      useAgentStore.getState().handleReporterMessage("warn", "Stale artifact");

      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages).toHaveLength(1);
      expect(lead.messages[0].text).toBe("Stale artifact");
      expect(lead.messages[0].type).toBe("warn");
    });

    it("does nothing when no currentTree", () => {
      useAgentStore.getState().handleReporterMessage("log", "test");
      expect(useAgentStore.getState().currentTree).toBeNull();
    });
  });

  describe("endRun", () => {
    it("snapshots currentTree to phaseHistory and clears current", () => {
      useAgentStore.getState().startRun("inspect");
      useAgentStore.getState().handleSessionEvent({
        type: "session-start",
        message: "Session started",
        timestamp: Date.now(),
      });
      useAgentStore.getState().endRun();

      const state = useAgentStore.getState();
      expect(state.currentTree).toBeNull();
      expect(state.currentStage).toBeNull();
      expect(state.phaseHistory.inspect).toBeDefined();
      expect(state.phaseHistory.inspect!.agents.size).toBe(1);
      expect(state.phaseHistory.inspect!.endTime).toBeDefined();
    });

    it("does nothing when no currentTree", () => {
      useAgentStore.getState().endRun();
      expect(useAgentStore.getState().phaseHistory).toEqual({});
    });
  });

  describe("clearHistory", () => {
    it("resets all state", () => {
      useAgentStore.getState().startRun("inspect");
      useAgentStore.getState().endRun();

      useAgentStore.getState().clearHistory();

      const state = useAgentStore.getState();
      expect(state.currentTree).toBeNull();
      expect(state.currentStage).toBeNull();
      expect(state.phaseHistory).toEqual({});
    });
  });

  describe("loadPhaseHistory", () => {
    it("loads a tree into phaseHistory for a given stage", () => {
      const tree: AgentTree = {
        agents: new Map([["lead", {
          id: "lead", name: "Lead", color: "#00ff88",
          status: "done", parentId: null, messages: [{ text: "done", timestamp: 100 }],
          startTime: 100, endTime: 200,
        }]]),
        rootIds: ["lead"],
        startTime: 100,
        endTime: 200,
      };

      useAgentStore.getState().loadPhaseHistory("inspect", tree);
      expect(useAgentStore.getState().phaseHistory.inspect).toBe(tree);
    });

    it("does not clear other stages in phaseHistory", () => {
      const tree1: AgentTree = { agents: new Map(), rootIds: [], startTime: 1, endTime: 2 };
      const tree2: AgentTree = { agents: new Map(), rootIds: [], startTime: 3, endTime: 4 };

      useAgentStore.getState().loadPhaseHistory("inspect", tree1);
      useAgentStore.getState().loadPhaseHistory("design", tree2);

      expect(useAgentStore.getState().phaseHistory.inspect).toBe(tree1);
      expect(useAgentStore.getState().phaseHistory.design).toBe(tree2);
    });
  });

  describe("serializeTree / deserializeTree", () => {
    it("round-trips a tree through serialization", () => {
      useAgentStore.getState().startRun("inspect");
      useAgentStore.getState().handleSessionEvent({
        type: "agent-spawned",
        agentId: "task-1",
        agentName: "scout",
        agentColor: "#00ddcc",
        parentAgentId: "lead",
        timestamp: 1000,
      });
      useAgentStore.getState().handleSessionEvent({
        type: "agent-activity",
        agentId: "task-1",
        message: "Reading files",
        tool: "Read",
        timestamp: 1001,
      });
      useAgentStore.getState().endRun();

      const original = useAgentStore.getState().phaseHistory.inspect!;
      const serialized = serializeTree(original);
      const restored = deserializeTree(serialized);

      expect(restored.rootIds).toEqual(original.rootIds);
      expect(restored.startTime).toBe(original.startTime);
      expect(restored.endTime).toBe(original.endTime);
      expect(restored.agents.size).toBe(original.agents.size);

      const originalLead = original.agents.get("lead")!;
      const restoredLead = restored.agents.get("lead")!;
      expect(restoredLead.name).toBe(originalLead.name);
      expect(restoredLead.messages).toEqual(originalLead.messages);

      const originalAgent = original.agents.get("task-1")!;
      const restoredAgent = restored.agents.get("task-1")!;
      expect(restoredAgent.name).toBe(originalAgent.name);
      expect(restoredAgent.messages).toEqual(originalAgent.messages);
    });

    it("serialized form is JSON-safe (agents as tuples)", () => {
      useAgentStore.getState().startRun("inspect");
      useAgentStore.getState().endRun();

      const tree = useAgentStore.getState().phaseHistory.inspect!;
      const serialized = serializeTree(tree);

      expect(Array.isArray(serialized.agents)).toBe(true);
      const json = JSON.parse(JSON.stringify(serialized));
      const restored = deserializeTree(json);
      expect(restored.agents.size).toBe(tree.agents.size);
    });
  });

  describe("agent-text event", () => {
    it("falls through to agent-activity logic", () => {
      useAgentStore.getState().startRun("inspect");

      useAgentStore.getState().handleSessionEvent({
        type: "agent-text",
        agentId: "lead",
        agentName: "Lead",
        agentColor: "#00ff88",
        message: "I'll analyze the codebase",
        timestamp: Date.now(),
      });

      const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
      expect(lead.messages).toHaveLength(1);
      expect(lead.messages[0].text).toBe("I'll analyze the codebase");
      expect(lead.status).toBe("active");
    });
  });

  it("multiple runs on same stage overwrite history", () => {
    // First run
    useAgentStore.getState().startRun("inspect");
    useAgentStore.getState().handleReporterMessage("log", "first run");
    useAgentStore.getState().endRun();

    // Second run
    useAgentStore.getState().startRun("inspect");
    useAgentStore.getState().handleReporterMessage("log", "second run");
    useAgentStore.getState().endRun();

    const history = useAgentStore.getState().phaseHistory.inspect!;
    const lead = history.agents.get("lead")!;
    expect(lead.messages).toHaveLength(1);
    expect(lead.messages[0].text).toBe("second run");
  });
});
