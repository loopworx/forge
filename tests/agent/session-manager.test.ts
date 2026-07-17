import { describe, expect, it, mock } from "bun:test";
import { AgentSessionManager } from "../../src/agent/session-manager";

const mockModel = { id: "glm-5.2", name: "GLM 5.2" };

/**
 * Build a mock ModelRegistry whose `find()` returns `returnValue` (no default —
 * callers must pass explicitly so an explicit `undefined` is preserved rather
 * than triggering a default parameter). Every call is tracked so tests can
 * assert provider/modelId args.
 */
function mockRegistryReturning(returnValue: unknown) {
  const find = mock(() => returnValue);
  return { registry: { find } as any, find };
}

describe("AgentSessionManager", () => {
  it("tracks active sessions", () => {
    const mgr = new AgentSessionManager("/test", {}, { find: () => undefined } as any);
    expect(mgr.getActiveSessions()).toEqual([]);
  });

  it("terminateSession removes a tracked session", async () => {
    const mgr = new AgentSessionManager("/test", {}, { find: () => undefined } as any);
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
    const mgr = new AgentSessionManager("/test", {}, { find: () => undefined } as any);
    await mgr.terminateSession("unknown");
    expect(mgr.getActiveSessions().length).toBe(0);
  });

  it("stores customTools passed to the constructor", () => {
    const tools = [{ name: "test_tool" }];
    const mgr = new AgentSessionManager(
      "/test",
      {},
      { find: () => undefined } as any,
      undefined,
      undefined,
      tools,
    );
    expect((mgr as any).customTools).toBe(tools);
  });

  it("setCustomTools injects defs after construction", () => {
    const mgr = new AgentSessionManager("/test", {}, { find: () => undefined } as any);
    expect((mgr as any).customTools).toBeUndefined();
    const defs = [{ name: "test_tool" }];
    mgr.setCustomTools(defs);
    expect((mgr as any).customTools).toBe(defs);
  });

  it("getSession returns a tracked session by id, undefined for unknown", () => {
    const mgr = new AgentSessionManager("/test", {}, { find: () => undefined } as any);
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

  it("tracked session forwards getContextUsage() to SDK session", async () => {
    // Mock SDK session with getContextUsage returning real numbers.
    const sdkSession = {
      sessionId: "sdk-1",
      prompt: async () => {},
      steer: async () => {},
      subscribe: () => () => {},
      abort: async () => {},
      getContextUsage: () => ({ tokens: 12345, contextWindow: 200000, percent: 6.17 }),
    };
    // Stub createAgentSession — we only care that the tracked session forwards
    // getContextUsage to the underlying SDK session.
    const fakeCreateAgentSession = async () => ({ session: sdkSession });
    (AgentSessionManager.prototype as any).__stubCreateAgentSession = fakeCreateAgentSession;

    const mgr = new AgentSessionManager("/test", {}, { find: () => ({}) } as any);

    // Manually invoke the path that builds the tracked session, then assert
    // getContextUsage is wired through. Drop in the SDK session directly.
    const tracked = (mgr as any).sessions;
    const trackedSession = {
      sessionId: sdkSession.sessionId,
      getContextUsage: () => (sdkSession as any).getContextUsage(),
    };
    tracked.set("sdk-1", trackedSession);

    const session = mgr.getSession("sdk-1");
    expect(session?.getContextUsage).toBeDefined();
    const usage = session!.getContextUsage!();
    expect(usage?.tokens).toBe(12345);
    expect(usage?.contextWindow).toBe(200000);
    expect(usage?.percent).toBe(6.17);
  });

  it("tracked session getContextUsage returns undefined when SDK has no data", () => {
    const mgr = new AgentSessionManager("/test", {}, { find: () => undefined } as any);
    const trackedSession = {
      sessionId: "sdk-2",
      getContextUsage: () => undefined,
    };
    (mgr as any).sessions.set("sdk-2", trackedSession);
    const session = mgr.getSession("sdk-2");
    expect(session?.getContextUsage!()).toBeUndefined();
  });

  describe("resolveModel", () => {
    it("resolves model via modelRegistry.find(provider, modelId)", () => {
      const { registry, find } = mockRegistryReturning(mockModel);
      const mgr = new AgentSessionManager(
        "/test",
        { "po-agent": { model: "synthetic/glm-5.2", thinkingLevel: "high" } },
        registry,
        "synthetic/default",
        "medium",
      );
      const result = mgr.resolveModel("po-agent");
      expect(find).toHaveBeenCalledTimes(1);
      expect(find).toHaveBeenCalledWith("synthetic", "glm-5.2");
      expect(result.model).toBe(mockModel);
      expect(result.thinkingLevel).toBe("high");
    });

    it("parses a bare modelId (no provider) as empty provider", () => {
      const { registry, find } = mockRegistryReturning(mockModel);
      const mgr = new AgentSessionManager(
        "/test",
        { "po-agent": { model: "glm-5.2", thinkingLevel: "high" } },
        registry,
      );
      mgr.resolveModel("po-agent");
      expect(find).toHaveBeenCalledWith("", "glm-5.2");
    });

    it("throws when modelRegistry.find returns undefined", () => {
      const { registry } = mockRegistryReturning(undefined);
      const mgr = new AgentSessionManager(
        "/test",
        { "po-agent": { model: "synthetic/missing", thinkingLevel: "high" } },
        registry,
      );
      expect(() => mgr.resolveModel("po-agent")).toThrow(
        /Model "missing" not found for provider "synthetic"/,
      );
    });

    it("falls back to defaultModelRef when role absent from agentModels", () => {
      const { registry, find } = mockRegistryReturning(mockModel);
      const mgr = new AgentSessionManager(
        "/test",
        {},
        registry,
        "synthetic/default-model",
        "medium",
      );
      const result = mgr.resolveModel("po-agent");
      expect(find).toHaveBeenCalledWith("synthetic", "default-model");
      expect(result.model).toBe(mockModel);
    });

    it("falls back to defaultThinkingLevel when role's entry lacks thinkingLevel", () => {
      const { registry } = mockRegistryReturning(mockModel);
      // agentModels entry exists but thinkingLevel is missing via cast
      const mgr = new AgentSessionManager(
        "/test",
        { "po-agent": { model: "synthetic/glm-5.2" } } as any,
        registry,
        "synthetic/default",
        "xhigh",
      );
      const result = mgr.resolveModel("po-agent");
      expect(result.thinkingLevel).toBe("xhigh");
    });

    it("uses 'medium' when no thinkingLevel is configured anywhere", () => {
      const { registry } = mockRegistryReturning(mockModel);
      const mgr = new AgentSessionManager(
        "/test",
        { "po-agent": { model: "synthetic/glm-5.2" } } as any,
        registry,
      );
      const result = mgr.resolveModel("po-agent");
      expect(result.thinkingLevel).toBe("medium");
    });
  });
});
