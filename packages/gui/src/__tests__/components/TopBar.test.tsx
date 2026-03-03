import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../components/chrome/Logo.js", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock("../../components/chrome/ProjectSelector.js", () => ({
  ProjectSelector: () => <div data-testid="project-selector">ProjectSelector</div>,
}));

vi.mock("../../components/chrome/SessionBadge.js", () => ({
  SessionBadge: () => <div data-testid="session-badge">SessionBadge</div>,
}));

describe("TopBar", () => {
  let onStartNew: () => void;
  let onOpenSettings: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    onStartNew = vi.fn<() => void>();
    onOpenSettings = vi.fn<() => void>();
  });

  async function renderTopBar() {
    const { TopBar } = await import("../../components/chrome/TopBar.js");
    return render(<TopBar onStartNew={onStartNew} onOpenSettings={onOpenSettings} />);
  }

  it("renders logo, project selector, and session badge", async () => {
    await renderTopBar();

    expect(screen.getByTestId("logo")).toBeTruthy();
    expect(screen.getByTestId("project-selector")).toBeTruthy();
    expect(screen.getByTestId("session-badge")).toBeTruthy();
  });

  it("calls onStartNew when Start New button is clicked", async () => {
    await renderTopBar();

    fireEvent.click(screen.getByText("+ Start New"));
    expect(onStartNew).toHaveBeenCalledOnce();
  });

  it("calls onOpenSettings when settings button is clicked", async () => {
    await renderTopBar();

    fireEvent.click(screen.getByTestId("settings-button"));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("settings button has correct aria-label", async () => {
    await renderTopBar();

    const btn = screen.getByTestId("settings-button");
    expect(btn.getAttribute("aria-label")).toBe("Settings");
  });
});
