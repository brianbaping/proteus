import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAgentStore } from "../../stores/agent-store.js";

vi.mock("../../components/shared/AgentNodeRow.js", () => ({
  AgentNodeRow: ({ node }: { node: { id: string; name: string } }) => (
    <div data-testid={`agent-row-${node.id}`}>{node.name}</div>
  ),
}));

describe("AgentActivityTree", () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
  });

  it("renders nothing when no tree exists", async () => {
    const { AgentActivityTree } = await import("../../components/shared/AgentActivityTree.js");
    const { container } = render(<AgentActivityTree stage="inspect" />);
    expect(container.querySelector("[data-testid='agent-activity-tree']")).toBeNull();
  });

  it("renders agent tree during active run", async () => {
    useAgentStore.getState().startRun("inspect");

    const { AgentActivityTree } = await import("../../components/shared/AgentActivityTree.js");
    render(<AgentActivityTree stage="inspect" />);

    expect(screen.getByTestId("agent-activity-tree")).toBeDefined();
    expect(screen.getByText("Lead")).toBeDefined();
  });

  it("renders from phaseHistory after run completes", async () => {
    useAgentStore.getState().startRun("inspect");
    useAgentStore.getState().endRun();

    const { AgentActivityTree } = await import("../../components/shared/AgentActivityTree.js");
    render(<AgentActivityTree stage="inspect" />);

    expect(screen.getByText("Lead")).toBeDefined();
  });

  it("renders as collapsible section when collapsed prop is true", async () => {
    useAgentStore.getState().startRun("inspect");
    useAgentStore.getState().endRun();

    const { AgentActivityTree } = await import("../../components/shared/AgentActivityTree.js");
    render(<AgentActivityTree stage="inspect" collapsed />);

    expect(screen.getByText("Session Log")).toBeDefined();
    expect(screen.getByTestId("session-log-toggle")).toBeDefined();
  });

  it("toggles collapsed section on click", async () => {
    useAgentStore.getState().startRun("inspect");
    useAgentStore.getState().endRun();

    const { AgentActivityTree } = await import("../../components/shared/AgentActivityTree.js");
    render(<AgentActivityTree stage="inspect" collapsed />);

    // starts collapsed
    expect(screen.queryByText("Lead")).toBeNull();

    // expand
    fireEvent.click(screen.getByTestId("session-log-toggle"));
    expect(screen.getByText("Lead")).toBeDefined();

    // collapse
    fireEvent.click(screen.getByTestId("session-log-toggle"));
    expect(screen.queryByText("Lead")).toBeNull();
  });

  it("does not show tree for different stage", async () => {
    useAgentStore.getState().startRun("design");

    const { AgentActivityTree } = await import("../../components/shared/AgentActivityTree.js");
    const { container } = render(<AgentActivityTree stage="inspect" />);

    expect(container.querySelector("[data-testid='agent-activity-tree']")).toBeNull();
  });

  it("shows agent count in collapsed header", async () => {
    useAgentStore.getState().startRun("inspect");
    useAgentStore.getState().handleSessionEvent({
      type: "agent-spawned",
      agentId: "task-1",
      agentName: "scout",
      agentColor: "#ff0000",
      parentAgentId: "lead",
      timestamp: Date.now(),
    });
    useAgentStore.getState().endRun();

    const { AgentActivityTree } = await import("../../components/shared/AgentActivityTree.js");
    render(<AgentActivityTree stage="inspect" collapsed />);

    expect(screen.getByText("2 agents")).toBeDefined();
  });
});
