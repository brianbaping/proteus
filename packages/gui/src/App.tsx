import React from "react";
import { useEffect, useState, useCallback } from "react";
import type { StageName, SessionEvent } from "@proteus-forge/shared";
import { STAGE_ORDER } from "@proteus-forge/shared";
import { TopBar } from "./components/chrome/TopBar.js";
import { ProgressBar } from "./components/chrome/ProgressBar.js";
import { PhaseTabStrip } from "./components/chrome/PhaseTabStrip.js";
import { CompleteBar } from "./components/chrome/CompleteBar.js";
import { AIChatPanel } from "./components/chrome/AIChatPanel.js";
import { NewProjectDialog } from "./components/dialogs/NewProjectDialog.js";
import { InspectionPhase } from "./components/inspection/InspectionPhase.js";
import { DesignPhase } from "./components/design/DesignPhase.js";
import { PlanningPhase } from "./components/planning/PlanningPhase.js";
import { BreakdownPhase } from "./components/breakdown/BreakdownPhase.js";
import { ExecutionPhase } from "./components/execution/ExecutionPhase.js";
import { useProjectStore } from "./stores/project-store.js";
import { useSessionStore } from "./stores/session-store.js";
import { useChatStore } from "./stores/chat-store.js";

function PhaseContent({ phase }: { phase: StageName }): React.JSX.Element {
  switch (phase) {
    case "inspect": return <InspectionPhase />;
    case "design": return <DesignPhase />;
    case "plan": return <PlanningPhase />;
    case "split": return <BreakdownPhase />;
    case "execute": return <ExecutionPhase />;
  }
}

export function App(): React.JSX.Element {
  const { loadRegistry, stageStatuses, activeProjectName } = useProjectStore();
  const _isRunning = useSessionStore((s) => s.isRunning);
  const { addMessage } = useChatStore();
  const [activePhase, setActivePhase] = useState<StageName>("inspect");
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Load projects on mount
  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  // Determine initial phase from stage statuses
  useEffect(() => {
    if (stageStatuses.length === 0) return;
    const lastComplete = [...stageStatuses].reverse().find((s) => s.complete);
    if (lastComplete) {
      const idx = STAGE_ORDER.indexOf(lastComplete.stage);
      if (idx < STAGE_ORDER.length - 1) {
        setActivePhase(STAGE_ORDER[idx + 1]);
      } else {
        setActivePhase(lastComplete.stage);
      }
    }
  }, [stageStatuses]);

  // Subscribe to IPC events
  useEffect(() => {
    const unsubLog = window.electronAPI.onReporterLog((msg) => {
      const trimmed = msg.trim();
      if (trimmed) {
        addMessage("ai", trimmed);
        useSessionStore.getState().addLog(trimmed);
      }
    });
    const unsubWarn = window.electronAPI.onReporterWarn((msg) => {
      const trimmed = msg.trim();
      if (trimmed) addMessage("ai", `[warn] ${trimmed}`);
    });
    const unsubErr = window.electronAPI.onReporterError((msg) => {
      const trimmed = msg.trim();
      if (trimmed) {
        addMessage("ai", `[error] ${trimmed}`);
        useSessionStore.getState().addError(trimmed);
      }
    });
    const unsubEvent = window.electronAPI.onSessionEvent((raw) => {
      const event = raw as SessionEvent;
      switch (event.type) {
        case "agent-spawned":
          addMessage("ai", `Spawning teammate: ${event.agentName ?? event.agentId}`);
          break;
        case "agent-activity":
          addMessage("ai", `[${event.agentName ?? "agent"}] ${event.message ?? ""}`);
          break;
        case "agent-done":
          addMessage("ai", `${event.agentName ?? "agent"} done`);
          break;
        case "session-start":
        case "session-end":
          if (event.message) addMessage("ai", event.message);
          break;
        // "progress" and "error" are handled by reporter channels
      }
    });

    return () => {
      unsubLog();
      unsubWarn();
      unsubErr();
      unsubEvent();
    };
  }, [addMessage]);

  const handleComplete = useCallback(() => {
    const idx = STAGE_ORDER.indexOf(activePhase);
    if (idx < STAGE_ORDER.length - 1) {
      setActivePhase(STAGE_ORDER[idx + 1]);
    }
    useProjectStore.getState().refreshStatus();
  }, [activePhase]);

  const handleDestroy = useCallback(async () => {
    const confirmed = window.confirm(
      `Destroy ${activePhase} artifacts and all downstream stages?`
    );
    if (!confirmed) return;

    try {
      await window.electronAPI.revertStage(activePhase);
    } catch {
      // Revert failed — still navigate back so UI is consistent
    }

    const idx = STAGE_ORDER.indexOf(activePhase);
    if (idx > 0) {
      setActivePhase(STAGE_ORDER[idx - 1]);
    }
    useProjectStore.getState().refreshStatus();
  }, [activePhase]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar onStartNew={() => setShowNewDialog(true)} />
      <ProgressBar />
      <PhaseTabStrip activePhase={activePhase} onPhaseClick={setActivePhase} />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {activeProjectName ? (
          <PhaseContent phase={activePhase} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="font-display text-3xl text-fg-dim">
                <span className="text-green">Proteus-</span>
                <span className="text-amber">Forge</span>
              </div>
              <div className="text-fg-muted text-sm">
                Click "+ Start New" to create a project
              </div>
            </div>
          </div>
        )}
      </div>

      <CompleteBar
        currentPhase={activePhase}
        onDestroy={handleDestroy}
        onComplete={handleComplete}
      />
      <AIChatPanel />

      <NewProjectDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
      />
    </div>
  );
}
