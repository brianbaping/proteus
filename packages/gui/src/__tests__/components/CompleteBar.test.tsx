import React from "react";
import { render, screen } from "@testing-library/react";
import { useSessionStore } from "../../stores/session-store.js";
import { useProjectStore } from "../../stores/project-store.js";
import { CompleteBar } from "../../components/chrome/CompleteBar.js";

describe("CompleteBar", () => {
  const defaults = {
    currentPhase: "inspect" as const,
    onDestroy: vi.fn(),
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useProjectStore.setState({ costs: null });
  });

  it("renders hint text and both buttons", () => {
    render(<CompleteBar {...defaults} />);

    expect(screen.getByText(/Review findings before proceeding to design/)).toBeDefined();
    expect(screen.getByText(/Destroy Phase/)).toBeDefined();
    expect(screen.getByText(/Complete Phase/)).toBeDefined();
  });

  it("renders cost and duration when session store has non-zero values", () => {
    useSessionStore.setState({ cost: 0.5, duration: "1m 30s" });

    render(<CompleteBar {...defaults} />);

    const costDuration = screen.getByTestId("cost-duration");
    expect(costDuration.textContent).toContain("$0.50");
    expect(costDuration.textContent).toContain("1m 30s");
  });

  it("does not render cost section when cost is 0 and no duration", () => {
    useSessionStore.setState({ cost: 0, duration: "" });

    render(<CompleteBar {...defaults} />);

    expect(screen.queryByTestId("cost-duration")).toBeNull();
  });

  it("renders duration alone when cost is 0 but duration exists", () => {
    useSessionStore.setState({ cost: 0, duration: "12m 18s" });

    render(<CompleteBar {...defaults} />);

    const costDuration = screen.getByTestId("cost-duration");
    expect(costDuration.textContent).toContain("12m 18s");
    expect(costDuration.textContent).not.toContain("$");
  });

  it("formats dollar amount correctly", () => {
    useSessionStore.setState({ cost: 12.3, duration: "5m 12s" });

    render(<CompleteBar {...defaults} />);

    const costDuration = screen.getByTestId("cost-duration");
    expect(costDuration.textContent).toContain("$12.30");
  });

  it("shows cost without duration when duration is empty", () => {
    useSessionStore.setState({ cost: 1.5, duration: "" });

    render(<CompleteBar {...defaults} />);

    const costDuration = screen.getByTestId("cost-duration");
    expect(costDuration.textContent).toContain("$1.50");
    expect(costDuration.textContent).not.toContain("·");
  });

  it("shows correct hint for each phase", () => {
    const { rerender } = render(<CompleteBar {...defaults} currentPhase="design" />);
    expect(screen.getByText(/Review architecture before generating the plan/)).toBeDefined();

    rerender(<CompleteBar {...defaults} currentPhase="execute" />);
    expect(screen.getByText(/Review generated code and verify output/)).toBeDefined();
  });

  it("displays session ID when present", () => {
    useSessionStore.setState({ cost: 1.0, duration: "2m", sessionId: "sess-abc-123-def" });

    render(<CompleteBar {...defaults} />);

    const sessionIdEl = screen.getByTestId("session-id");
    expect(sessionIdEl.textContent).toBe("sess-abc-123-def");
    expect(sessionIdEl.title).toBe("sess-abc-123-def");
  });

  it("does not display session ID when empty", () => {
    useSessionStore.setState({ cost: 1.0, duration: "2m", sessionId: "" });

    render(<CompleteBar {...defaults} />);

    expect(screen.queryByTestId("session-id")).toBeNull();
  });

  it("shows historical cost from costs.json when session store is empty", () => {
    useProjectStore.setState({
      costs: {
        stages: {
          inspect: {
            timestamp: "2026-02-25T17:10:14.955Z",
            teammates: 0,
            tier: "claude-haiku-4-5",
            duration: "12m 18s",
            inputTokens: 0,
            outputTokens: 0,
            estimatedCost: 1.25,
            sessionId: "sess-hist-001",
          },
        },
        totalCost: 1.25,
      },
    });

    render(<CompleteBar {...defaults} currentPhase="inspect" />);

    const costDuration = screen.getByTestId("cost-duration");
    expect(costDuration.textContent).toContain("$1.25");
    expect(costDuration.textContent).toContain("12m 18s");

    const sessionIdEl = screen.getByTestId("session-id");
    expect(sessionIdEl.textContent).toBe("sess-hist-001");
  });

  it("prefers session store values over historical costs", () => {
    useSessionStore.setState({ cost: 2.50, duration: "5m", sessionId: "sess-live" });
    useProjectStore.setState({
      costs: {
        stages: {
          inspect: {
            timestamp: "2026-02-25T17:10:14.955Z",
            teammates: 0,
            tier: "claude-haiku-4-5",
            duration: "12m 18s",
            inputTokens: 0,
            outputTokens: 0,
            estimatedCost: 1.25,
            sessionId: "sess-hist-001",
          },
        },
        totalCost: 1.25,
      },
    });

    render(<CompleteBar {...defaults} currentPhase="inspect" />);

    const costDuration = screen.getByTestId("cost-duration");
    expect(costDuration.textContent).toContain("$2.50");
    expect(costDuration.textContent).toContain("5m");

    const sessionIdEl = screen.getByTestId("session-id");
    expect(sessionIdEl.textContent).toBe("sess-live");
  });

  it("disables Complete button when session is running", () => {
    useSessionStore.setState({ isRunning: true });
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    render(<CompleteBar {...defaults} />);

    const btn = screen.getByText(/Complete Phase/).closest("button");
    expect(btn?.disabled).toBe(true);
    expect(btn?.className).toContain("opacity-50");
  });

  it("disables Complete button when phase is not complete on disk", () => {
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: false, artifactPath: "" }] as never,
    });

    render(<CompleteBar {...defaults} />);

    const btn = screen.getByText(/Complete Phase/).closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("disables Complete button when phase is already user-completed", () => {
    useSessionStore.setState({ completedStages: ["inspect"] });
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    render(<CompleteBar {...defaults} />);

    const btn = screen.getByText(/Complete Phase/).closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("enables Complete button when phase is disk-complete, not running, not user-completed", () => {
    useSessionStore.setState({ isRunning: false, completedStages: [] });
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    render(<CompleteBar {...defaults} />);

    const btn = screen.getByText(/Complete Phase/).closest("button");
    expect(btn?.disabled).toBe(false);
    expect(btn?.className).not.toContain("opacity-50");
  });

  it("shows no cost when phase has no historical entry and session is empty", () => {
    useProjectStore.setState({
      costs: {
        stages: {
          design: {
            timestamp: "2026-02-25T17:43:55.991Z",
            teammates: 0,
            tier: "claude-opus-4-6",
            duration: "18m 33s",
            inputTokens: 0,
            outputTokens: 0,
            estimatedCost: 3.00,
          },
        },
        totalCost: 3.00,
      },
    });

    render(<CompleteBar {...defaults} currentPhase="inspect" />);

    expect(screen.queryByTestId("cost-duration")).toBeNull();
  });
});
