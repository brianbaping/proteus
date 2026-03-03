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
  roles: {
    lead: "advanced",
    scout: "fast",
    architect: "advanced",
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

    // Should show Providers tab by default
    expect(screen.getByTestId("tab-providers")).toBeTruthy();
    // Provider name input should appear
    expect(screen.getByTestId("provider-name-anthropic")).toBeTruthy();
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

  it("switches between Providers, Tiers, and Roles tabs", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    // Switch to Tiers
    fireEvent.click(screen.getByText("Tiers"));
    expect(screen.getByTestId("tab-tiers")).toBeTruthy();

    // Switch to Roles
    fireEvent.click(screen.getByText("Roles"));
    expect(screen.getByTestId("tab-roles")).toBeTruthy();

    // Switch back to Providers
    fireEvent.click(screen.getByText("Providers"));
    expect(screen.getByTestId("tab-providers")).toBeTruthy();
  });

  it("edits a tier model and saves with updated config", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
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
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
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
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(mockWriteGlobalConfig).not.toHaveBeenCalled();
  });

  it("close button (x) closes dialog without saving", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    // Click the × button
    fireEvent.click(screen.getByText("\u00D7"));

    expect(onClose).toHaveBeenCalled();
    expect(mockWriteGlobalConfig).not.toHaveBeenCalled();
  });

  it("adds and removes a provider", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

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

  it("adds and removes a role", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Roles"));

    // Add role
    fireEvent.click(screen.getByTestId("add-role"));
    expect(screen.getByTestId("role-name-custom-role")).toBeTruthy();

    // Remove it
    fireEvent.click(screen.getByTestId("remove-role-custom-role"));

    // Save and verify the custom role is not present
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.roles).not.toHaveProperty("custom-role");
    });
  });

  it("toggles a role between tier and custom mode", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Roles"));

    // The "scout" role starts as tier string "fast"
    const tierSelect = screen.getByTestId("role-tier-scout");
    expect(tierSelect).toBeTruthy();

    // Toggle to custom
    fireEvent.click(screen.getByTestId("role-custom-toggle-scout"));

    // Now should show provider/model inputs
    expect(screen.getByTestId("role-provider-scout")).toBeTruthy();
    expect(screen.getByTestId("role-model-scout")).toBeTruthy();
  });

  it("toggles API key visibility", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

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
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

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
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

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
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
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

  it("changes a role tier selection", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Roles"));

    const tierSelect = screen.getByTestId("role-tier-scout");
    fireEvent.change(tierSelect, { target: { value: "advanced" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.roles.scout).toBe("advanced");
    });
  });

  it("edits custom role provider and model fields", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Roles"));

    // Toggle scout to custom
    fireEvent.click(screen.getByTestId("role-custom-toggle-scout"));

    // Edit custom fields
    fireEvent.change(screen.getByTestId("role-provider-scout"), { target: { value: "anthropic" } });
    fireEvent.change(screen.getByTestId("role-model-scout"), { target: { value: "custom-model" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.roles.scout).toEqual({ provider: "anthropic", model: "custom-model" });
    });
  });

  it("toggles a custom role back to tier mode", async () => {
    // Start with a config that has a custom role
    const customConfig = structuredClone(mockConfig);
    customConfig.roles.scout = { provider: "anthropic", model: "custom" };
    mockReadGlobalConfig.mockResolvedValue(customConfig);

    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Roles"));

    // Scout should be in custom mode
    expect(screen.getByTestId("role-provider-scout")).toBeTruthy();

    // Toggle back to tier mode (uncheck custom)
    fireEvent.click(screen.getByTestId("role-custom-toggle-scout"));

    // Should now show tier dropdown
    expect(screen.getByTestId("role-tier-scout")).toBeTruthy();
  });

  it("renames a role on blur", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Roles"));

    const nameInput = screen.getByTestId("role-name-scout");
    fireEvent.change(nameInput, { target: { value: "my-scout" } });
    fireEvent.blur(nameInput);

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      const saved = mockWriteGlobalConfig.mock.calls[0][0] as GlobalConfig;
      expect(saved.roles).toHaveProperty("my-scout");
      expect(saved.roles).not.toHaveProperty("scout");
    });
  });

  it("closes on save success", async () => {
    await renderDialog();

    await waitFor(() => {
      expect(screen.getByTestId("tab-providers")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
