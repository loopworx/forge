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
});
