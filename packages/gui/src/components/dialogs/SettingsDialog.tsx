import React, { useState, useEffect, useCallback } from "react";
import type { GlobalConfig, ProviderConfig, TierConfig, PhaseMapping } from "@proteus-forge/shared";

interface SettingsDialogProps {
  open: boolean;
  onClose(): void;
}

type TabName = "general" | "providers" | "tiers" | "phases";

const TABS: { key: TabName; label: string }[] = [
  { key: "general", label: "General" },
  { key: "providers", label: "Providers" },
  { key: "tiers", label: "Tiers" },
  { key: "phases", label: "Phases" },
];

const TIER_NAMES = ["fast", "standard", "advanced"];

export function SettingsDialog({ open, onClose }: SettingsDialogProps): React.JSX.Element | null {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("general");

  // Draft config state
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [tiers, setTiers] = useState<Record<string, TierConfig>>({});
  const [phases, setPhases] = useState<Record<string, PhaseMapping>>({});
  const [forgeVersion, setForgeVersion] = useState("1.0.0");
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | undefined>(undefined);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await window.electronAPI.readGlobalConfig();
      if (config) {
        setProviders(config.providers ?? {});
        setTiers(config.tiers ?? {});
        setPhases(config.phases ?? {});
        setForgeVersion(config.forgeVersion ?? "1.0.0");
        setMaxOutputTokens(config.maxOutputTokens);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadConfig();
      setActiveTab("general");
    }
  }, [open, loadConfig]);

  if (!open) return null;

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const config: GlobalConfig = { forgeVersion, providers, tiers, phases, maxOutputTokens };
      await window.electronAPI.writeGlobalConfig(config);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  // --- Provider helpers ---
  function updateProvider(name: string, field: keyof ProviderConfig, value: string): void {
    setProviders((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  }

  function renameProvider(oldName: string, newName: string): void {
    if (!newName.trim() || newName === oldName) return;
    setProviders((prev) => {
      const { [oldName]: entry, ...rest } = prev;
      return { ...rest, [newName]: entry };
    });
    // Update tier references
    setTiers((prev) => {
      const updated = { ...prev };
      for (const [k, v] of Object.entries(updated)) {
        if (v.provider === oldName) {
          updated[k] = { ...v, provider: newName };
        }
      }
      return updated;
    });
  }

  function addProvider(): void {
    const baseName = "new-provider";
    let name = baseName;
    let i = 1;
    while (providers[name]) {
      name = `${baseName}-${i++}`;
    }
    setProviders((prev) => ({ ...prev, [name]: { type: "anthropic", apiKey: "" } }));
  }

  function removeProvider(name: string): void {
    setProviders((prev) => {
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  }

  // --- Tier helpers ---
  function updateTier(name: string, field: keyof TierConfig, value: string): void {
    setTiers((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  }

  // --- Phase helpers ---
  function updatePhaseToTier(name: string, tierName: string): void {
    setPhases((prev) => ({ ...prev, [name]: tierName }));
  }

  function updatePhaseToCustom(name: string, field: keyof TierConfig, value: string): void {
    setPhases((prev) => {
      const existing = prev[name];
      const base: TierConfig = typeof existing === "object" ? existing : { provider: "", model: "" };
      return { ...prev, [name]: { ...base, [field]: value } };
    });
  }

  function togglePhaseCustom(name: string, isCustom: boolean): void {
    if (isCustom) {
      setPhases((prev) => ({ ...prev, [name]: { provider: "", model: "" } }));
    } else {
      const firstTier = Object.keys(tiers)[0] ?? "fast";
      setPhases((prev) => ({ ...prev, [name]: firstTier }));
    }
  }


  const providerNames = Object.keys(providers);
  const tierNames = Object.keys(tiers);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[600px] bg-bg-2 border border-border rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-display text-lg text-fg">Settings</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg text-lg">&times;</button>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-border px-5 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-green text-fg"
                  : "border-transparent text-fg-muted hover:text-fg-dim"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 px-3 py-2 text-sm text-red bg-red/10 border border-red/20 rounded" data-testid="settings-error">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8" data-testid="settings-loading">
              <span className="text-fg-muted text-sm">Loading config...</span>
            </div>
          ) : (
            <>
              {activeTab === "general" && (
                <div className="space-y-4" data-testid="tab-general">
                  <div className="space-y-2">
                    <label className="block text-sm text-fg-dim">
                      Max Output Tokens
                    </label>
                    <input
                      type="number"
                      value={maxOutputTokens ?? ""}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setMaxOutputTokens(val ? parseInt(val, 10) : undefined);
                      }}
                      className="w-48 bg-bg text-fg text-sm font-mono px-3 py-1.5 rounded border border-border-2 outline-none focus:border-green/50"
                      placeholder="Default (32000)"
                      min={16000}
                      max={128000}
                      step={16000}
                      data-testid="max-output-tokens"
                    />
                    <p className="text-2xs text-fg-muted">
                      Maximum tokens per Claude Code response. Leave blank for the default (32000).
                      Sets <code className="text-fg-dim">CLAUDE_CODE_MAX_OUTPUT_TOKENS</code>.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "providers" && (
                <div className="space-y-3" data-testid="tab-providers">
                  {Object.entries(providers).map(([name, config]) => (
                    <ProviderRow
                      key={name}
                      name={name}
                      config={config}
                      onUpdate={(field, value) => updateProvider(name, field, value)}
                      onRename={(newName) => renameProvider(name, newName)}
                      onRemove={() => removeProvider(name)}
                    />
                  ))}
                  <button
                    onClick={addProvider}
                    className="text-sm text-green hover:text-green-dim transition-colors"
                    data-testid="add-provider"
                  >
                    + Add Provider
                  </button>
                </div>
              )}

              {activeTab === "tiers" && (
                <div className="space-y-3" data-testid="tab-tiers">
                  {TIER_NAMES.map((name) => {
                    const tier = tiers[name] ?? { provider: "", model: "" };
                    return (
                      <div key={name} className="flex items-center gap-3 p-3 bg-bg rounded border border-border-2">
                        <span className="text-sm font-mono text-fg w-20 shrink-0">{name}</span>
                        <select
                          value={tier.provider}
                          onChange={(e) => updateTier(name, "provider", e.target.value)}
                          className="bg-bg text-fg text-sm px-2 py-1.5 rounded border border-border-2 outline-none"
                          data-testid={`tier-provider-${name}`}
                        >
                          <option value="">Select provider</option>
                          {providerNames.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={tier.model}
                          onChange={(e) => updateTier(name, "model", e.target.value)}
                          className="flex-1 bg-bg text-fg text-sm font-mono px-3 py-1.5 rounded border border-border-2 outline-none focus:border-green/50"
                          placeholder="model name"
                          data-testid={`tier-model-${name}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "phases" && (
                <div className="space-y-3" data-testid="tab-phases">
                  {Object.entries(phases).map(([name, mapping]) => (
                    <PhaseRow
                      key={name}
                      name={name}
                      mapping={mapping}
                      tierNames={tierNames}
                      providerNames={providerNames}
                      onSetTier={(tier) => updatePhaseToTier(name, tier)}
                      onSetCustomField={(field, value) => updatePhaseToCustom(name, field, value)}
                      onToggleCustom={(isCustom) => togglePhaseCustom(name, isCustom)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-border-2 text-fg-dim rounded hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className={`px-4 py-1.5 text-sm font-bold rounded transition-colors ${
              loading || saving
                ? "bg-bg-3 text-fg-muted cursor-not-allowed"
                : "bg-green text-bg hover:bg-green-dim"
            }`}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

interface ProviderRowProps {
  name: string;
  config: ProviderConfig;
  onUpdate(field: keyof ProviderConfig, value: string): void;
  onRename(newName: string): void;
  onRemove(): void;
}

function ProviderRow({ name, config, onUpdate, onRename, onRemove }: ProviderRowProps): React.JSX.Element {
  const [showKey, setShowKey] = useState(false);
  const [editName, setEditName] = useState(name);

  return (
    <div className="p-3 bg-bg rounded border border-border-2 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => onRename(editName)}
          className="bg-bg text-fg text-sm font-mono px-2 py-1 rounded border border-border-2 outline-none focus:border-green/50 w-40"
          data-testid={`provider-name-${name}`}
        />
        <input
          type="text"
          value={config.type}
          onChange={(e) => onUpdate("type", e.target.value)}
          className="bg-bg text-fg text-sm px-2 py-1 rounded border border-border-2 outline-none w-28"
          placeholder="type"
          data-testid={`provider-type-${name}`}
        />
        <button
          onClick={onRemove}
          className="ml-auto text-fg-muted hover:text-red text-sm transition-colors"
          data-testid={`remove-provider-${name}`}
        >
          Remove
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type={showKey ? "text" : "password"}
          value={config.apiKey}
          onChange={(e) => onUpdate("apiKey", e.target.value)}
          className="flex-1 bg-bg text-fg text-sm font-mono px-2 py-1 rounded border border-border-2 outline-none focus:border-green/50"
          placeholder="API key or $ENV_VAR"
          data-testid={`provider-apikey-${name}`}
        />
        <button
          onClick={() => setShowKey((v) => !v)}
          className="text-xs text-fg-muted hover:text-fg transition-colors"
          data-testid={`toggle-key-${name}`}
        >
          {showKey ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

interface PhaseRowProps {
  name: string;
  mapping: PhaseMapping;
  tierNames: string[];
  providerNames: string[];
  onSetTier(tier: string): void;
  onSetCustomField(field: keyof TierConfig, value: string): void;
  onToggleCustom(isCustom: boolean): void;
}

function PhaseRow({
  name,
  mapping,
  tierNames,
  providerNames,
  onSetTier,
  onSetCustomField,
  onToggleCustom,
}: PhaseRowProps): React.JSX.Element {
  const isCustom = typeof mapping === "object";

  return (
    <div className="p-3 bg-bg rounded border border-border-2 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="text-fg text-sm font-mono px-2 py-1 w-36"
          data-testid={`phase-name-${name}`}
        >
          {name}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-fg-muted ml-auto">
          <input
            type="checkbox"
            checked={isCustom}
            onChange={(e) => onToggleCustom(e.target.checked)}
            data-testid={`phase-custom-toggle-${name}`}
          />
          Custom
        </label>
      </div>

      {isCustom ? (
        <div className="flex items-center gap-2">
          <select
            value={(mapping as TierConfig).provider}
            onChange={(e) => onSetCustomField("provider", e.target.value)}
            className="bg-bg text-fg text-sm px-2 py-1.5 rounded border border-border-2 outline-none"
            data-testid={`phase-provider-${name}`}
          >
            <option value="">Select provider</option>
            {providerNames.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            type="text"
            value={(mapping as TierConfig).model}
            onChange={(e) => onSetCustomField("model", e.target.value)}
            className="flex-1 bg-bg text-fg text-sm font-mono px-2 py-1.5 rounded border border-border-2 outline-none focus:border-green/50"
            placeholder="model name"
            data-testid={`phase-model-${name}`}
          />
        </div>
      ) : (
        <select
          value={mapping as string}
          onChange={(e) => onSetTier(e.target.value)}
          className="bg-bg text-fg text-sm px-2 py-1.5 rounded border border-border-2 outline-none w-full"
          data-testid={`phase-tier-${name}`}
        >
          {tierNames.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}
    </div>
  );
}
