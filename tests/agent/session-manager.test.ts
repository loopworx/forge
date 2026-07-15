import { describe, expect, it } from "bun:test";
import { AgentSessionManager } from "../../src/agent/session-manager";

describe("AgentSessionManager", () => {
  it("tracks active sessions", () => {
    const mgr = new AgentSessionManager("/test", {}, {} as any);
    expect(mgr.getActiveSessions()).toEqual([]);
  });

  it("terminateSession removes a tracked session", async () => {
    const mgr = new AgentSessionManager("/test", {}, {} as any);
    // simulate tracked session
    (mgr as any).sessions.set("s1", {
      sessionId: "s1",
      storyId: "FOR-1",
      agentRole: "developer-agent",
      prompt: async () => {},
      steer: async () => {},
      subscribe: () => () => {},
      abort: async () => {},
    });
    expect(mgr.getActiveSessions().length).toBe(1);
    await mgr.terminateSession("s1");
    expect(mgr.getActiveSessions().length).toBe(0);
  });

  it("terminateSession is safe for unknown session", async () => {
    const mgr = new AgentSessionManager("/test", {}, {} as any);
    await mgr.terminateSession("unknown");
    expect(mgr.getActiveSessions().length).toBe(0);
  });

  it("stores customTools passed to the constructor", () => {
    const tools = [{ name: "test_tool" }];
    const mgr = new AgentSessionManager("/test", {}, {} as any, tools);
    expect((mgr as any).customTools).toBe(tools);
  });

  it("setCustomTools injects defs after construction", () => {
    const mgr = new AgentSessionManager("/test", {}, {} as any);
    expect((mgr as any).customTools).toBeUndefined();
    const defs = [{ name: "test_tool" }];
    mgr.setCustomTools(defs);
    expect((mgr as any).customTools).toBe(defs);
  });

  it("getSession returns a tracked session by id, undefined for unknown", () => {
    const mgr = new AgentSessionManager("/test", {}, {} as any);
    const session = {
      sessionId: "s1",
      storyId: "FOR-1",
      agentRole: "developer-agent",
      prompt: async () => {},
      steer: async () => {},
      subscribe: () => () => {},
      abort: async () => {},
    };
    (mgr as any).sessions.set("s1", session);
    expect(mgr.getSession("s1")).toBe(session);
    expect(mgr.getSession("unknown")).toBeUndefined();
  });
});
