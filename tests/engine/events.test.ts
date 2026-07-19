import { describe, expect, it, mock } from "bun:test";
import { EngineEventBus } from "../../src/engine/events";

describe("EngineEventBus", () => {
  it("publishes to all subscribers", () => {
    const bus = new EngineEventBus();
    const a = mock(() => {});
    const b = mock(() => {});
    bus.subscribe(a);
    bus.subscribe(b);
    bus.publish({ type: "session_created", sessionId: "s1", storyId: "st1", agentRole: "developer-agent" });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("subscribe returns a remove function that unsubscribes", () => {
    const bus = new EngineEventBus();
    const fn = mock(() => {});
    const remove = bus.subscribe(fn);
    remove();
    bus.publish({ type: "session_created", sessionId: "s1", storyId: "st1", agentRole: "developer-agent" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("publishes multiple event types", () => {
    const bus = new EngineEventBus();
    const fn = mock(() => {});
    bus.subscribe(fn);
    bus.publish({ type: "phase_started", phase: 1, name: "Lean Canvas", sessionId: "s1" });
    bus.publish({ type: "inception_complete" });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
