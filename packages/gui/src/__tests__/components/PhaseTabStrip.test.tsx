import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useProjectStore } from "../../stores/project-store.js";
import { useSessionStore } from "../../stores/session-store.js";
import { PhaseTabStrip } from "../../components/chrome/PhaseTabStrip.js";

describe("PhaseTabStrip", () => {
  const defaults = {
    activePhase: "inspect" as const,
    onPhaseClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useProjectStore.setState({
      stageStatuses: [],
    });
  });

  it("renders all five phase tabs", () => {
    render(<PhaseTabStrip {...defaults} />);

    expect(screen.getByText("Inspection")).toBeDefined();
    expect(screen.getByText("Design")).toBeDefined();
    expect(screen.getByText("Planning")).toBeDefined();
    expect(screen.getByText("Breakdown")).toBeDefined();
    expect(screen.getByText("Execution")).toBeDefined();
  });

  it("marks active phase tab as active", () => {
    render(<PhaseTabStrip {...defaults} activePhase="design" />);

    const designBtn = screen.getByText("Design").closest("button");
    expect(designBtn?.className).toContain("text-green");
  });

  it("marks user-completed stages as completed", () => {
    useSessionStore.setState({ completedStages: ["inspect"] });
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    render(<PhaseTabStrip {...defaults} activePhase="design" />);

    const inspectBtn = screen.getByText("Inspection").closest("button");
    expect(inspectBtn?.className).toContain("text-green-dim");
  });

  it("locks tabs when prior stages are not user-completed", () => {
    // inspect is disk-complete but NOT user-completed
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    render(<PhaseTabStrip {...defaults} activePhase="inspect" />);

    const designBtn = screen.getByText("Design").closest("button");
    // Design should be locked because inspect is not in completedStages
    expect(designBtn?.disabled).toBe(true);
  });

  it("unlocks tab when all prior stages are user-completed and disk-complete", () => {
    useSessionStore.setState({ completedStages: ["inspect"] });
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    render(<PhaseTabStrip {...defaults} activePhase="inspect" />);

    const designBtn = screen.getByText("Design").closest("button");
    expect(designBtn?.disabled).toBe(false);
  });

  it("does not call onPhaseClick for locked tabs", () => {
    render(<PhaseTabStrip {...defaults} />);

    const designBtn = screen.getByText("Design").closest("button")!;
    fireEvent.click(designBtn);

    expect(defaults.onPhaseClick).not.toHaveBeenCalled();
  });

  it("calls onPhaseClick for unlocked tabs", () => {
    useSessionStore.setState({ completedStages: ["inspect"] });
    useProjectStore.setState({
      stageStatuses: [{ stage: "inspect", complete: true, artifactPath: "/p" }] as never,
    });

    render(<PhaseTabStrip {...defaults} activePhase="inspect" />);

    const designBtn = screen.getByText("Design").closest("button")!;
    fireEvent.click(designBtn);

    expect(defaults.onPhaseClick).toHaveBeenCalledWith("design");
  });

  it("first tab is always unlocked when not active", () => {
    render(<PhaseTabStrip {...defaults} activePhase="design" />);

    const inspectBtn = screen.getByText("Inspection").closest("button");
    expect(inspectBtn?.disabled).toBe(false);
  });
});
