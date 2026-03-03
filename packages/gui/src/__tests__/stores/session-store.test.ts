import { useSessionStore } from "../../stores/session-store.js";

describe("useSessionStore", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("has correct initial state", () => {
    const state = useSessionStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.currentStage).toBeNull();
    expect(state.logs).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(state.cost).toBe(0);
    expect(state.duration).toBe("");
    expect(state.sessionId).toBe("");
  });

  it("startStage sets isRunning and currentStage, clears logs and errors", () => {
    const { addLog, addError, startStage } = useSessionStore.getState();
    addLog("old log");
    addError("old error");

    startStage("inspect");

    const state = useSessionStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state.currentStage).toBe("inspect");
    expect(state.logs).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(state.cost).toBe(0);
    expect(state.duration).toBe("");
    expect(state.sessionId).toBe("");
  });

  it("addLog appends messages to logs array", () => {
    const { addLog } = useSessionStore.getState();
    addLog("first");
    addLog("second");

    expect(useSessionStore.getState().logs).toEqual(["first", "second"]);
  });

  it("addError appends messages to errors array", () => {
    const { addError } = useSessionStore.getState();
    addError("err1");
    addError("err2");

    expect(useSessionStore.getState().errors).toEqual(["err1", "err2"]);
  });

  it("endSession sets cost, duration, and sessionId, clears isRunning", () => {
    const { startStage, endSession } = useSessionStore.getState();
    startStage("design");

    endSession(true, 1.25, "2m 15s", "sess-abc-123");

    const state = useSessionStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.cost).toBe(1.25);
    expect(state.duration).toBe("2m 15s");
    expect(state.sessionId).toBe("sess-abc-123");
  });

  it("endSession works for failed sessions", () => {
    const { startStage, endSession } = useSessionStore.getState();
    startStage("plan");

    endSession(false, 0, "0s", "");

    const state = useSessionStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.cost).toBe(0);
    expect(state.duration).toBe("0s");
    expect(state.sessionId).toBe("");
  });

  it("startStage clears previous sessionId", () => {
    const { endSession, startStage } = useSessionStore.getState();
    endSession(true, 1.0, "1m", "sess-old");
    expect(useSessionStore.getState().sessionId).toBe("sess-old");

    startStage("plan");
    expect(useSessionStore.getState().sessionId).toBe("");
  });

  it("reset returns all state to initial values", () => {
    const { startStage, addLog, addError, endSession, reset } = useSessionStore.getState();
    startStage("execute");
    addLog("some log");
    addError("some error");
    endSession(true, 5.0, "10m 3s", "sess-xyz");

    reset();

    const state = useSessionStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.currentStage).toBeNull();
    expect(state.logs).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(state.cost).toBe(0);
    expect(state.duration).toBe("");
    expect(state.sessionId).toBe("");
  });
});
