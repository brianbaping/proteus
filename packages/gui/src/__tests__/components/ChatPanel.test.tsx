import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ElectronAPI } from "#electron/preload.js";
import { useSessionStore } from "../../stores/session-store.js";
import { useAgentStore } from "../../stores/agent-store.js";
import { useChatStore } from "../../stores/chat-store.js";

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().reset();
    useAgentStore.getState().reset();
    useChatStore.getState().reset();

    window.electronAPI = {
      sendMessage: vi.fn(),
      runStage: vi.fn(),
      readArtifacts: vi.fn(),
      listProjects: vi.fn(),
      getActiveProject: vi.fn(),
      setActiveProject: vi.fn(),
      createProject: vi.fn(),
      destroyProject: vi.fn(),
      getProjectStatus: vi.fn(),
      readGlobalConfig: vi.fn(),
      abortStage: vi.fn(),
      onSessionEvent: vi.fn().mockReturnValue(() => {}),
      onReporterLog: vi.fn().mockReturnValue(() => {}),
      onReporterWarn: vi.fn().mockReturnValue(() => {}),
      onReporterError: vi.fn().mockReturnValue(() => {}),
      readCosts: vi.fn(),
      openDirectory: vi.fn(),
      openFile: vi.fn(),
      saveFile: vi.fn(),
      cloneRepo: vi.fn(),
      updateProject: vi.fn(),
      exportChat: vi.fn().mockResolvedValue("/tmp/chat-log.txt"),
    } as unknown as ElectronAPI;
  });

  it("renders collapsed by default with input", async () => {
    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    expect(screen.getByTestId("chat-panel")).toBeDefined();
    expect(screen.getByPlaceholderText("Run a stage to chat...")).toBeDefined();
  });

  it("disables input when not running", async () => {
    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Run a stage to chat...") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("enables input when running", async () => {
    useSessionStore.setState({ isRunning: true });

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Send a message to the lead agent...") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("sends message on Enter key when running", async () => {
    useSessionStore.setState({ isRunning: true });
    useAgentStore.getState().startRun("inspect");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Send a message to the lead agent...");
    fireEvent.change(input, { target: { value: "hello agent" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(window.electronAPI.sendMessage).toHaveBeenCalledWith("lead", "hello agent");
  });

  it("sends message on Send button click", async () => {
    useSessionStore.setState({ isRunning: true });
    useAgentStore.getState().startRun("inspect");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Send a message to the lead agent...");
    fireEvent.change(input, { target: { value: "test message" } });
    fireEvent.click(screen.getByText("Send"));

    expect(window.electronAPI.sendMessage).toHaveBeenCalledWith("lead", "test message");
  });

  it("clears input after sending", async () => {
    useSessionStore.setState({ isRunning: true });
    useAgentStore.getState().startRun("inspect");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Send a message to the lead agent...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByText("Send"));

    expect(input.value).toBe("");
  });

  it("does not send empty messages", async () => {
    useSessionStore.setState({ isRunning: true });

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    fireEvent.click(screen.getByText("Send"));
    expect(window.electronAPI.sendMessage).not.toHaveBeenCalled();
  });

  it("does not send when not running", async () => {
    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Run a stage to chat...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("Send"));

    expect(window.electronAPI.sendMessage).not.toHaveBeenCalled();
  });

  it("adds user message to chat store when sending", async () => {
    useSessionStore.setState({ isRunning: true });
    useAgentStore.getState().startRun("inspect");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Send a message to the lead agent...");
    fireEvent.change(input, { target: { value: "my question" } });
    fireEvent.click(screen.getByText("Send"));

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].sender).toBe("user");
    expect(messages[0].text).toBe("my question");
  });

  it("also adds user message to agent store", async () => {
    useSessionStore.setState({ isRunning: true });
    useAgentStore.getState().startRun("inspect");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Send a message to the lead agent...");
    fireEvent.change(input, { target: { value: "my question" } });
    fireEvent.click(screen.getByText("Send"));

    const lead = useAgentStore.getState().currentTree!.agents.get("lead")!;
    expect(lead.messages.some((m) => m.text.includes("[you] my question"))).toBe(true);
  });

  it("shows expanded panel with messages when toggled", async () => {
    useChatStore.getState().addUserMessage("hello");
    // panel is now open from addUserMessage

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    // Should show the message text in the expanded panel
    expect(screen.getByText("hello")).toBeDefined();
    // Should show drag handle
    expect(screen.getByTestId("chat-drag-handle")).toBeDefined();
  });

  it("shows agent messages with name badge", async () => {
    useChatStore.getState().addAgentMessage("Lead", "#00ff88", "Analyzing codebase...");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    expect(screen.getByText("[Lead]")).toBeDefined();
    expect(screen.getByText("Analyzing codebase...")).toBeDefined();
  });

  it("toggles between collapsed and expanded", async () => {
    useChatStore.getState().addUserMessage("test");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    // Should be expanded (panelOpen=true from addUserMessage)
    expect(screen.getByTestId("chat-drag-handle")).toBeDefined();

    // Click toggle to collapse
    fireEvent.click(screen.getByTestId("chat-toggle"));

    // Should show toggle button with message count
    expect(screen.getByTestId("chat-toggle")).toBeDefined();
  });

  it("shows green pulse dot when running", async () => {
    useSessionStore.setState({ isRunning: true });

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    const { container } = render(<ChatPanel />);

    const dot = container.querySelector(".bg-green.animate-pulse");
    expect(dot).not.toBeNull();
  });

  it("shows gray dot when idle", async () => {
    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    const { container } = render(<ChatPanel />);

    const dot = container.querySelector(".bg-fg-muted");
    expect(dot).not.toBeNull();
  });

  it("does not show export button when no messages", async () => {
    useChatStore.setState({ panelOpen: true });

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    expect(screen.queryByTestId("chat-export")).toBeNull();
  });

  it("shows export button when messages exist in expanded panel", async () => {
    useChatStore.getState().addUserMessage("hello");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    expect(screen.getByTestId("chat-export")).toBeDefined();
  });

  it("calls exportChat with messages on export click", async () => {
    useChatStore.getState().addUserMessage("hello");
    useChatStore.getState().addAgentMessage("Lead", "#00ff88", "Hi there");

    const { ChatPanel } = await import("../../components/chrome/ChatPanel.js");
    render(<ChatPanel />);

    fireEvent.click(screen.getByTestId("chat-export"));

    expect(window.electronAPI.exportChat).toHaveBeenCalledTimes(1);
    const passedMessages = (window.electronAPI.exportChat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(passedMessages).toHaveLength(2);
    expect(passedMessages[0].text).toBe("hello");
    expect(passedMessages[1].text).toBe("Hi there");
  });
});
