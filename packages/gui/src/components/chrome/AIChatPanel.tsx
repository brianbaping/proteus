import React from "react";
import { useRef, useEffect } from "react";
import { useChatStore } from "../../stores/chat-store.js";
import { useSessionStore } from "../../stores/session-store.js";

export function AIChatPanel(): React.JSX.Element {
  const { messages, inputValue, setInput, addMessage } = useChatStore();
  const isRunning = useSessionStore((s) => s.isRunning);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend(): void {
    const text = inputValue.trim();
    if (!text) return;
    addMessage("user", text);
    setInput("");
    if (isRunning) {
      window.electronAPI.sendMessage("lead", text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="h-[220px] flex flex-col bg-bg-2 border-t border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span
          className={`w-2 h-2 rounded-full ${
            isRunning ? "bg-green animate-pulse" : "bg-fg-muted"
          }`}
        />
        <span className="text-2xs uppercase tracking-wider text-fg-dim">
          AI Chat
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {messages.map((msg, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span
              className={`font-bold shrink-0 ${
                msg.role === "ai" ? "text-green" : "text-amber"
              }`}
            >
              {msg.role === "ai" ? "AI" : "YOU"}
            </span>
            <span className="text-fg-dim">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
        <input
          type="text"
          className="flex-1 bg-bg text-fg text-xs font-mono px-3 py-1.5 rounded border border-border-2 outline-none focus:border-green/50 placeholder:text-fg-muted"
          placeholder="Ask about this phase's findings..."
          value={inputValue}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleSend}
          className="px-3 py-1.5 text-2xs font-bold bg-green text-bg rounded hover:bg-green-dim transition-colors uppercase tracking-wider"
        >
          Send
        </button>
      </div>
    </div>
  );
}
