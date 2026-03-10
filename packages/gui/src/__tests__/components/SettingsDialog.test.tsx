import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import type { GlobalConfig } from "@proteus-forge/shared";

const mockConfig: GlobalConfig = {
  forgeVersion: "1.0.0",
  providers: {
    anthropic: { type: "anthropic", apiKey: "$ANTHROPIC_API_KEY" },
  },
  tiers: {
    fast: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    standard: { provider: "anthropic", model: "claude-sonnet-4-6-20260320" },
    advanced: { provider: "anthropic", model: "claude-opus-4-6-20260320" },
  },
  phases: {
    inspect: "fast",
    style: "standard",
    design: "advanced",
    plan: "standard",
    split: "standard",
    execute: "advanced",
  },
};

describe("SettingsDialog", () => {
  let mockReadGlobalConfig: ReturnType<typeof vi.fn>;
  let mockWriteGlobalConfig: ReturnType<typeof vi.fn>;
  let onClose: () => void;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReadGlobalConfig = vi.fn().mockResolvedValue(structuredClone(mockConfig));
    mockWriteGlobalConfig = vi.fn().mockResolvedValue(undefined);
    onClose = vi.fn<() => void>();

    window.electronAPI = {
      readGlobalConfig: mockReadGlobalConfig,
      writeGlobalConfig: mockWriteGlobalConfig,
      runStage: vi.fn(),
      readArtifacts: vi.fn(),
      listProjects: vi.fn(),
      getActiveProject: vi.fn(),
      setActiveProject: vi.fn(),
      createProject: vi.fn(),
      destroyProject: vi.fn(),
      getProjectStatus: vi.fn(),
      abortStage: vi.fn(),
      revertStage: vi.fn(),
      onSessionEvent: vi.fn().mockReturnValue(() => {}),
      onReporterLog: vi.fn().mockReturnValue(() => {}),
      onReporterWarn: vi.fn().mockReturnValue(() => {}),
      onReporterError: vi.fn().mockReturnValue(() => {}),
      sendMessage: vi.fn(),
      readCosts: vi.fn(),
      openDirectory: vi.fn(),
      openFile: vi.fn(),
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
      updateProject: vi.fn(),
      extractArchive: vi.fn(),
      getZoomLevel: vi.fn().mockResolvedValue(0),
      setZoomLevel: vi.fn().mockResolvedValue(undefined),
    } as unknown as ElectronAPI;
  });

  async function renderDialog(open = true) {
    const { SettingsDialog } = await import("../../components/dialogs/SettingsDialog.js");
    return render(<SettingsDialog open={open} onClose={onClose} />);
  }

  it("renders nothing when open is false", async () => {
    const { container } = await renderDialog(false);
    expect(container.innerHTML).toBe("");
  });

  it("loads and displays config on open", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(mockReadGlobalConfig).toHaveBeenCalled();
    });

    // Should show General tab by default
    expect(screen.getByTestId("tab-general")).toBeTruthy();
    // Max output tokens input should appear
    expect(screen.getByTestId("max-output-tokens")).toBeTruthy();
  });

  it("shows loading state while config loads", async () => {
    mockReadGlobalConfig.mockImplementation(() => new Promise(() => {})); // never resolves
    await renderDialog();

    expect(screen.getByTestId("settings-loading")).toBeTruthy();
  });

  it("shows error when config load fails", async () => {
    mockReadGlobalConfig.mockRejectedValue(new Error("Config not found"));
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("settings-error")).toBeTruthy();
      expect(screen.getByText("Config not found")).toBeTruthy();
    });
  });

  it("switches between General, Providers, Tiers, and Phases tabs", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    // Switch to Providers
    fireEvent.click(screen.getByText("Providers"));
    expect(screen.getByTestId("tab-providers")).toBeTruthy();

    // Switch to Tiers
    fireEvent.click(screen.getByText("Tiers"));
    expect(screen.getByTestId("tab-tiers")).toBeTruthy();

    // Switch to Phases
    fireEvent.click(screen.getByText("Phases"));
    expect(screen.getByTestId("tab-phases")).toBeTruthy();

    // Switch back to General
    fireEvent.click(screen.getByText("General"));
    expect(screen.getByTestId("tab-general")).toBeTruthy();
  });

  it("edits a tier model and saves with updated config", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    // Switch to Tiers tab
    fireEvent.click(screen.getByText("Tiers"));

    const fastModelInput = screen.getByTestId("tier-model-fast");
    fireEvent.change(fastModelInput, { target: { value: "claude-haiku-4-5-latest" } });

    // Click Save
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      expect(mockWriteGlobalConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          tiers: expect.objectContaining({
            fast: { provider: "anthropic", model: "claude-haiku-4-5-latest" },
          }),
        }),
      );
    });
  });

  it("shows error on save failure", async () => {
    mockWriteGlobalConfig.mockRejectedValue(new Error("Permission denied"));
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("settings-error")).toBeTruthy();
      expect(screen.getByText("Permission denied")).toBeTruthy();
    });
  });

  it("cancel closes dialog without saving", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(mockWriteGlobalConfig).not.toHaveBeenCalled();
  });

  it("close button (x) closes dialog without saving", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    // Click the × button
    fireEvent.click(screen.getByText("\u00D7"));

    expect(onClose).toHaveBeenCalled();
    expect(mockWriteGlobalConfig).not.toHaveBeenCalled();
  });

  it("adds and removes a provider", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Providers"));

    // Add provider
    fireEvent.click(screen.getByTestId("add-provider"));
    expect(screen.getByTestId("provider-name-new-provider")).toBeTruthy();

    // Remove it
    fireEvent.click(screen.getByTestId("remove-provider-new-provider"));

    // Save and verify the new provider is not in the saved config
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      expect(mockWriteGlobalConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: { anthropic: { type: "anthropic", apiKey: "$ANTHROPIC_API_KEY" } },
        }),
      );
    });
  });

  it("displays phase names as read-only labels", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Phases"));

    // Phase names should be static text, not editable inputs
    const phaseName = screen.getByTestId("phase-name-inspect");
    expect(phaseName.tagName).toBe("SPAN");
    expect(phaseName.textContent).toBe("inspect");
  });

  it("toggles a phase between tier and custom mode", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Phases"));

    // The "inspect" phase starts as tier string "fast"
    const tierSelect = screen.getByTestId("phase-tier-inspect");
    expect(tierSelect).toBeTruthy();

    // Toggle to custom
    fireEvent.click(screen.getByTestId("phase-custom-toggle-inspect"));

    // Now should show provider/model inputs
    expect(screen.getByTestId("phase-provider-inspect")).toBeTruthy();
    expect(screen.getByTestId("phase-model-inspect")).toBeTruthy();
  });

  it("toggles API key visibility", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Providers"));

    const apiKeyInput = screen.getByTestId("provider-apikey-anthropic") as HTMLInputElement;
    expect(apiKeyInput.type).toBe("password");

    fireEvent.click(screen.getByTestId("toggle-key-anthropic"));
    expect(apiKeyInput.type).toBe("text");

    fireEvent.click(screen.getByTestId("toggle-key-anthropic"));
    expect(apiKeyInput.type).toBe("password");
  });

  it("edits provider type and API key", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Providers"));

    const typeInput = screen.getByTestId("provider-type-anthropic");
    fireEvent.change(typeInput, { target: { value: "openai" } });

    const apiKeyInput = screen.getByTestId("provider-apikey-anthropic");
    fireEvent.change(apiKeyInput, { target: { value: "$NEW_KEY" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.providers.anthropic).toEqual({ type: "openai", apiKey: "$NEW_KEY" });
    });
  });

  it("renames a provider on blur", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Providers"));

    const nameInput = screen.getByTestId("provider-name-anthropic");
    fireEvent.change(nameInput, { target: { value: "my-provider" } });
    fireEvent.blur(nameInput);

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.providers).toHaveProperty("my-provider");
      expect(saved.providers).not.toHaveProperty("anthropic");
    });
  });

  it("changes a tier provider dropdown", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Tiers"));

    const providerSelect = screen.getByTestId("tier-provider-fast");
    fireEvent.change(providerSelect, { target: { value: "anthropic" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.tiers.fast.provider).toBe("anthropic");
    });
  });

  it("changes a phase tier selection", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Phases"));

    const tierSelect = screen.getByTestId("phase-tier-inspect");
    fireEvent.change(tierSelect, { target: { value: "advanced" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.phases.inspect).toBe("advanced");
    });
  });

  it("edits custom phase provider and model fields", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Phases"));

    // Toggle inspect to custom
    fireEvent.click(screen.getByTestId("phase-custom-toggle-inspect"));

    // Edit custom fields
    fireEvent.change(screen.getByTestId("phase-provider-inspect"), { target: { value: "anthropic" } });
    fireEvent.change(screen.getByTestId("phase-model-inspect"), { target: { value: "custom-model" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.phases.inspect).toEqual({ provider: "anthropic", model: "custom-model" });
    });
  });

  it("toggles a custom phase back to tier mode", async () => {
    // Start with a config that has a custom phase
    const customConfig = structuredClone(mockConfig);
    customConfig.phases.inspect = { provider: "anthropic", model: "custom" };
    mockReadGlobalConfig.mockResolvedValue(customConfig);

    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Phases"));

    // Inspect should be in custom mode
    expect(screen.getByTestId("phase-provider-inspect")).toBeTruthy();

    // Toggle back to tier mode (uncheck custom)
    fireEvent.click(screen.getByTestId("phase-custom-toggle-inspect"));

    // Should now show tier dropdown
    expect(screen.getByTestId("phase-tier-inspect")).toBeTruthy();
  });


  it("loads and saves maxOutputTokens", async () => {
    const configWithTokens = structuredClone(mockConfig);
    configWithTokens.maxOutputTokens = 64000;
    mockReadGlobalConfig.mockResolvedValue(configWithTokens);

    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    const input = screen.getByTestId("max-output-tokens") as HTMLInputElement;
    expect(input.value).toBe("64000");

    // Change value
    fireEvent.change(input, { target: { value: "32000" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.maxOutputTokens).toBe(32000);
    });
  });

  it("saves undefined maxOutputTokens when cleared", async () => {
    const configWithTokens = structuredClone(mockConfig);
    configWithTokens.maxOutputTokens = 64000;
    mockReadGlobalConfig.mockResolvedValue(configWithTokens);

    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    const input = screen.getByTestId("max-output-tokens") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.maxOutputTokens).toBeUndefined();
    });
  });

  it("closes on save success", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows zoom control on General tab", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    expect(screen.getByTestId("zoom-select")).toBeTruthy();
    expect(screen.getByTestId("zoom-in")).toBeTruthy();
    expect(screen.getByTestId("zoom-out")).toBeTruthy();
  });

  it("zoom select reflects current level from getZoomLevel", async () => {
    (window.electronAPI.getZoomLevel as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    const select = screen.getByTestId("zoom-select") as HTMLSelectElement;
    expect(select.value).toBe("2");
  });

  it("A+ calls setZoomLevel with incremented value", async () => {
    (window.electronAPI.getZoomLevel as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("zoom-in"));

    expect(window.electronAPI.setZoomLevel).toHaveBeenCalledWith(2);
  });

  it("A- calls setZoomLevel with decremented value", async () => {
    (window.electronAPI.getZoomLevel as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("zoom-out"));

    expect(window.electronAPI.setZoomLevel).toHaveBeenCalledWith(0);
  });

  it("A+ disabled at max zoom level (5)", async () => {
    (window.electronAPI.getZoomLevel as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    const btn = screen.getByTestId("zoom-in") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("A- disabled at min zoom level (-3)", async () => {
    (window.electronAPI.getZoomLevel as ReturnType<typeof vi.fn>).mockResolvedValue(-3);
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    const btn = screen.getByTestId("zoom-out") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("cancel reverts zoom to initial level", async () => {
    (window.electronAPI.getZoomLevel as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    // Zoom in twice
    fireEvent.click(screen.getByTestId("zoom-in"));
    fireEvent.click(screen.getByTestId("zoom-in"));

    // Cancel
    fireEvent.click(screen.getByText("Cancel"));

    // Should revert to initial level (1)
    expect(window.electronAPI.setZoomLevel).toHaveBeenLastCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("close button reverts zoom to initial level", async () => {
    (window.electronAPI.getZoomLevel as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    // Zoom in
    fireEvent.click(screen.getByTestId("zoom-in"));

    // Click X
    fireEvent.click(screen.getByText("\u00D7"));

    expect(window.electronAPI.setZoomLevel).toHaveBeenLastCalledWith(0);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows theme selector on General tab", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    expect(screen.getByTestId("theme-select")).toBeTruthy();
  });

  it("defaults to dark theme when no theme in config", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    const select = screen.getByTestId("theme-select") as HTMLSelectElement;
    expect(select.value).toBe("dark");
  });

  it("selecting a theme sets data-theme attribute", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("theme-select"), { target: { value: "synthwave" } });

    expect(document.documentElement.getAttribute("data-theme")).toBe("synthwave");
  });

  it("cancel reverts theme to initial", async () => {
    const configWithTheme = structuredClone(mockConfig);
    (configWithTheme as GlobalConfig & { theme: string }).theme = "solarized";
    mockReadGlobalConfig.mockResolvedValue(configWithTheme);

    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    // Change theme
    fireEvent.change(screen.getByTestId("theme-select"), { target: { value: "forest" } });
    expect(document.documentElement.getAttribute("data-theme")).toBe("forest");

    // Cancel
    fireEvent.click(screen.getByText("Cancel"));

    // Should revert to solarized
    expect(document.documentElement.getAttribute("data-theme")).toBe("solarized");
    expect(onClose).toHaveBeenCalled();
  });

  it("save includes theme in config", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("theme-select"), { target: { value: "hotdog" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.theme).toBe("hotdog");
    });
  });

  it("save does not revert zoom", async () => {
    (window.electronAPI.getZoomLevel as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-general")).toBeTruthy();
    });

    // Zoom in
    fireEvent.click(screen.getByTestId("zoom-in"));
    (window.electronAPI.setZoomLevel as ReturnType<typeof vi.fn>).mockClear();

    // Save
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    // setZoomLevel should NOT have been called again (no revert)
    expect(window.electronAPI.setZoomLevel).not.toHaveBeenCalled();
  });
});
