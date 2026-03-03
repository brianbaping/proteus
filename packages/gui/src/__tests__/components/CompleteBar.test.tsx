import React from "react";
import { render, screen } from "@testing-library/react";
import { useSessionStore } from "../../stores/session-store.js";
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

  it("does not render cost section when cost is 0", () => {
    useSessionStore.setState({ cost: 0, duration: "" });

    render(<CompleteBar {...defaults} />);

    expect(screen.queryByTestId("cost-duration")).toBeNull();
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
});
