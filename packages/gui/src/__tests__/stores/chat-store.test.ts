import { useChatStore } from "../../stores/chat-store.js";

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.getState().clearMessages();
    useChatStore.getState().setInput("");
  });

  it("has correct initial state", () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.inputValue).toBe("");
  });

  it("addMessage appends a message with correct role and auto-timestamp", () => {
    const before = Date.now();
    useChatStore.getState().addMessage("ai", "Hello world");
    const after = Date.now();

    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("ai");
    expect(messages[0].text).toBe("Hello world");
    expect(messages[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(messages[0].timestamp).toBeLessThanOrEqual(after);
  });

  it("addMessage appends multiple messages preserving order", () => {
    const { addMessage } = useChatStore.getState();
    addMessage("ai", "first");
    addMessage("user", "second");
    addMessage("ai", "third");

    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe("ai");
    expect(messages[0].text).toBe("first");
    expect(messages[1].role).toBe("user");
    expect(messages[1].text).toBe("second");
    expect(messages[2].role).toBe("ai");
    expect(messages[2].text).toBe("third");
  });

  it("setInput updates the inputValue", () => {
    useChatStore.getState().setInput("new input");
    expect(useChatStore.getState().inputValue).toBe("new input");
  });

  it("clearMessages empties the messages array", () => {
    const { addMessage, clearMessages } = useChatStore.getState();
    addMessage("ai", "msg1");
    addMessage("user", "msg2");

    clearMessages();

    expect(useChatStore.getState().messages).toEqual([]);
  });

  it("clearMessages does not affect inputValue", () => {
    const { setInput, addMessage, clearMessages } = useChatStore.getState();
    setInput("preserved");
    addMessage("ai", "msg");

    clearMessages();

    expect(useChatStore.getState().inputValue).toBe("preserved");
  });

  it("addMessage stores agent metadata when provided", () => {
    useChatStore.getState().addMessage("ai", "Scanning files", { name: "researcher", color: "#ff6b6b" });

    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].agentName).toBe("researcher");
    expect(messages[0].agentColor).toBe("#ff6b6b");
  });

  it("addMessage leaves agent fields undefined when no metadata provided", () => {
    useChatStore.getState().addMessage("ai", "Generic message");

    const { messages } = useChatStore.getState();
    expect(messages[0].agentName).toBeUndefined();
    expect(messages[0].agentColor).toBeUndefined();
  });
});
