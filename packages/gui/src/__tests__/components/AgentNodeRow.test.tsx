import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentNodeRow } from "../../components/shared/AgentNodeRow.js";
import type { AgentNode } from "../../stores/agent-store.js";

function makeNode(overrides: Partial<AgentNode> = {}): AgentNode {
  return {
    id: "test-agent",
    name: "TestAgent",
    color: "#ff6b6b",
    status: "active",
    parentId: null,
    messages: [],
    startTime: Date.now() - 5000,
    ...overrides,
  };
}

describe("AgentNodeRow", () => {
  it("renders agent name with color", () => {
    const node = makeNode();
    render(<AgentNodeRow node={node} />);

    const nameEl = screen.getByText("TestAgent");
    expect(nameEl).toBeDefined();
    expect(nameEl.style.color).toBe("rgb(255, 107, 107)");
  });

  it("renders status badge", () => {
    const node = makeNode({ status: "active" });
    render(<AgentNodeRow node={node} />);
    expect(screen.getByText("active")).toBeDefined();
  });

  it("renders spawned badge for spawned status", () => {
    const node = makeNode({ status: "spawned" });
    render(<AgentNodeRow node={node} />);
    expect(screen.getByText("spawned")).toBeDefined();
  });

  it("renders done badge for done status", () => {
    const node = makeNode({ status: "done", endTime: Date.now() });
    render(<AgentNodeRow node={node} />);
    expect(screen.getByText("done")).toBeDefined();
  });

  it("shows messages when expanded", () => {
    const node = makeNode({
      messages: [
        { text: "Reading file.ts", tool: "Read", timestamp: Date.now() },
        { text: "All done", timestamp: Date.now() },
      ],
    });
    render(<AgentNodeRow node={node} />);

    expect(screen.getByText("Reading file.ts")).toBeDefined();
    expect(screen.getByText("Read")).toBeDefined();
    expect(screen.getByText("All done")).toBeDefined();
  });

  it("collapses messages on click", () => {
    const node = makeNode({
      messages: [{ text: "msg1", timestamp: Date.now() }],
    });
    render(<AgentNodeRow node={node} />);

    // active agent starts expanded
    expect(screen.getByText("msg1")).toBeDefined();

    fireEvent.click(screen.getByTestId("agent-row-test-agent"));
    expect(screen.queryByText("msg1")).toBeNull();
  });

  it("starts collapsed for done agents", () => {
    const node = makeNode({
      status: "done",
      endTime: Date.now(),
      messages: [{ text: "hidden msg", timestamp: Date.now() }],
    });
    render(<AgentNodeRow node={node} />);

    expect(screen.queryByText("hidden msg")).toBeNull();
  });

  it("shows expand chevron even with no messages", () => {
    const node = makeNode({ status: "spawned", messages: [] });
    const { container } = render(<AgentNodeRow node={node} />);

    // chevron is always rendered
    const chevron = container.querySelector(".w-3");
    expect(chevron).not.toBeNull();
  });

  it("renders error messages with red styling", () => {
    const node = makeNode({
      messages: [{ text: "Something failed", timestamp: Date.now(), type: "error" }],
    });
    const { container } = render(<AgentNodeRow node={node} />);

    const errorEl = container.querySelector(".text-red");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toBe("Something failed");
  });

  it("renders warn messages with amber styling", () => {
    const node = makeNode({
      messages: [{ text: "Careful", timestamp: Date.now(), type: "warn" }],
    });
    const { container } = render(<AgentNodeRow node={node} />);

    const warnEl = container.querySelector(".text-amber");
    expect(warnEl).not.toBeNull();
  });
});
