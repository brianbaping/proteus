import { useChatStore } from "../../stores/chat-store.js";

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it("has correct initial state", () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.panelOpen).toBe(false);
  });

  describe("addUserMessage", () => {
    it("adds a user message and opens panel", () => {
      useChatStore.getState().addUserMessage("hello");

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].sender).toBe("user");
      expect(state.messages[0].text).toBe("hello");
      expect(state.messages[0].id).toBeTruthy();
      expect(state.messages[0].timestamp).toBeGreaterThan(0);
      expect(state.panelOpen).toBe(true);
    });
  });

  describe("addAgentMessage", () => {
    it("adds an agent message with name and color", () => {
      useChatStore.getState().addAgentMessage("Lead", "#00ff88", "Analyzing...");

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].sender).toBe("agent");
      expect(state.messages[0].agentName).toBe("Lead");
      expect(state.messages[0].agentColor).toBe("#00ff88");
      expect(state.messages[0].text).toBe("Analyzing...");
      expect(state.panelOpen).toBe(true);
    });
  });

  describe("togglePanel", () => {
    it("toggles panel open state", () => {
      expect(useChatStore.getState().panelOpen).toBe(false);
      useChatStore.getState().togglePanel();
      expect(useChatStore.getState().panelOpen).toBe(true);
      useChatStore.getState().togglePanel();
      expect(useChatStore.getState().panelOpen).toBe(false);
    });
  });

  describe("clear", () => {
    it("clears messages but keeps panel state", () => {
      useChatStore.getState().addUserMessage("test");
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().panelOpen).toBe(true);

      useChatStore.getState().clear();
      expect(useChatStore.getState().messages).toEqual([]);
      expect(useChatStore.getState().panelOpen).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears messages and closes panel", () => {
      useChatStore.getState().addUserMessage("test");
      useChatStore.getState().reset();

      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.panelOpen).toBe(false);
    });
  });

  it("accumulates multiple messages in order", () => {
    useChatStore.getState().addUserMessage("question");
    useChatStore.getState().addAgentMessage("Lead", "#00ff88", "answer");
    useChatStore.getState().addUserMessage("follow-up");

    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(3);
    expect(messages[0].sender).toBe("user");
    expect(messages[1].sender).toBe("agent");
    expect(messages[2].sender).toBe("user");
  });

  it("generates unique IDs for each message", () => {
    useChatStore.getState().addUserMessage("a");
    useChatStore.getState().addUserMessage("b");

    const { messages } = useChatStore.getState();
    expect(messages[0].id).not.toBe(messages[1].id);
  });
});
