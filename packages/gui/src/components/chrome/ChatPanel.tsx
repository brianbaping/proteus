import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSessionStore } from "../../stores/session-store.js";
import { useChatStore } from "../../stores/chat-store.js";
import { useAgentStore } from "../../stores/agent-store.js";

const MIN_HEIGHT = 80;
const DEFAULT_HEIGHT = 200;
const MAX_VH_FRACTION = 0.5;

export function ChatPanel(): React.JSX.Element {
  const isRunning = useSessionStore((s) => s.isRunning);
  const messages = useChatStore((s) => s.messages);
  const panelOpen = useChatStore((s) => s.panelOpen);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const togglePanel = useChatStore((s) => s.togglePanel);

  const [inputValue, setInputValue] = useState("");
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Auto-open when a run starts
  const prevRunning = useRef(false);
  useEffect(() => {
    if (isRunning && !prevRunning.current && !panelOpen) {
      togglePanel();
    }
    prevRunning.current = isRunning;
  }, [isRunning, panelOpen, togglePanel]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend(): void {
    const text = inputValue.trim();
    if (!text || !isRunning) return;
    window.electronAPI.sendMessage("lead", text);
    addUserMessage(text);
    useAgentStore.getState().handleReporterMessage("log", `[you] ${text}`);
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: height };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const maxHeight = window.innerHeight * MAX_VH_FRACTION;
      const delta = dragRef.current.startY - ev.clientY;
      const next = Math.min(maxHeight, Math.max(MIN_HEIGHT, dragRef.current.startHeight + delta));
      setHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height]);

  // Collapsed: just show input bar
  if (!panelOpen) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-bg-2 border-t border-border" data-testid="chat-panel">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isRunning ? "bg-green animate-pulse" : "bg-fg-muted"
          }`}
        />
        <input
          type="text"
          className="flex-1 bg-bg text-fg text-xs font-mono px-3 py-1.5 rounded border border-border-2 outline-none focus:border-green/50 placeholder:text-fg-muted disabled:opacity-50"
          placeholder={isRunning ? "Send a message to the lead agent..." : "Run a stage to chat..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isRunning}
        />
        <button
          onClick={handleSend}
          disabled={!isRunning}
          className="px-3 py-1.5 text-2xs font-bold bg-green text-bg rounded hover:bg-green-dim transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
        {messages.length > 0 && (
          <button
            onClick={togglePanel}
            className="px-2 py-1 text-2xs text-fg-muted hover:text-fg transition-colors"
            data-testid="chat-toggle"
          >
            &#9650; Chat ({messages.length})
          </button>
        )}
      </div>
    );
  }

  // Expanded panel
  return (
    <div
      className="flex flex-col bg-bg-2 border-t border-border"
      style={{ height }}
      data-testid="chat-panel"
    >
      {/* Drag handle */}
      <div
        className="h-1.5 cursor-ns-resize bg-bg-3 hover:bg-border transition-colors shrink-0"
        onMouseDown={handleDragStart}
        data-testid="chat-drag-handle"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isRunning ? "bg-green animate-pulse" : "bg-fg-muted"
            }`}
          />
          <span className="text-2xs uppercase tracking-wider text-fg-muted">Chat</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => window.electronAPI.exportChat(messages)}
              className="px-2 py-0.5 text-2xs text-fg-muted hover:text-fg transition-colors"
              data-testid="chat-export"
            >
              Export
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => useChatStore.getState().clear()}
              className="px-2 py-0.5 text-2xs text-fg-muted hover:text-fg transition-colors"
              data-testid="chat-clear"
            >
              Clear
            </button>
          )}
          <button
            onClick={togglePanel}
            className="px-2 py-0.5 text-2xs text-fg-muted hover:text-fg transition-colors"
            data-testid="chat-toggle"
          >
            &#9660;
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3 py-1.5 rounded text-xs font-mono ${
                msg.sender === "user"
                  ? "bg-green/20 text-green"
                  : "bg-bg-3 text-fg"
              }`}
            >
              {msg.sender === "agent" && msg.agentName && (
                <span
                  className="text-2xs font-bold mr-1"
                  style={{ color: msg.agentColor ?? "#888" }}
                >
                  [{msg.agentName}]
                </span>
              )}
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0 border-t border-border">
        <input
          type="text"
          className="flex-1 bg-bg text-fg text-xs font-mono px-3 py-1.5 rounded border border-border-2 outline-none focus:border-green/50 placeholder:text-fg-muted disabled:opacity-50"
          placeholder={isRunning ? "Send a message to the lead agent..." : "Run a stage to chat..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isRunning}
        />
        <button
          onClick={handleSend}
          disabled={!isRunning}
          className="px-3 py-1.5 text-2xs font-bold bg-green text-bg rounded hover:bg-green-dim transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
