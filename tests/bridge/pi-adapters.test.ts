import { describe, expect, it } from "bun:test";
import { PiDevRuntime } from "../../src/bridge/pi-dev-runtime";
import { PiDevSessionManager } from "../../src/bridge/pi-dev-session-manager";

function createStubApi() {
  const tools: Array<Record<string, unknown>> = [];
  const events: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  return {
    tools,
    events,
    registerTool(def: Record<string, unknown>) {
      tools.push(def);
    },
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!events.has(event)) events.set(event, []);
      events.get(event)!.push(handler);
    },
    setStatus(_key: string, _text: string | undefined) {},
    registerCommand(_name: string, _opts: Record<string, unknown>) {},
    setSessionName(_name: string) {},
  };
}

describe("PiDevRuntime", () => {
  it("implements AgentRuntime", () => {
    const api = createStubApi();
    const runtime = new PiDevRuntime(api as any);
    expect(runtime).toBeDefined();
  });

  it("delegates registerTool to pi.dev API", () => {
    const api = createStubApi();
    const runtime = new PiDevRuntime(api as any);

    runtime.registerTool({
      name: "forge_test",
      label: "Test",
      description: "A test tool",
      parameters: {},
      execute: async () => ({ content: [{ type: "text", text: "ok" }], details: null, isError: false }),
    });

    expect(api.tools.length).toBe(1);
    expect(api.tools[0].name).toBe("forge_test");
  });

  it("delegates on() subscriptions to pi.dev API", () => {
    const api = createStubApi();
    const runtime = new PiDevRuntime(api as any);

    const handler = async () => {};
    runtime.on("agent_settled", handler);

    expect(api.events.has("agent_settled")).toBe(true);
    expect(api.events.get("agent_settled")!.length).toBe(1);
  });

  it("passes through setStatus", () => {
    const api = createStubApi();
    const runtime = new PiDevRuntime(api as any);

    expect(() => runtime.setStatus("mode", "development")).not.toThrow();
  });
});

describe("PiDevSessionManager", () => {
  it("implements SessionManager", () => {
    const sessions = new PiDevSessionManager("/tmp");
    expect(sessions).toBeDefined();
  });

  it("getActiveSessions returns empty array when no sessions", () => {
    const sessions = new PiDevSessionManager("/tmp");
    expect(sessions.getActiveSessions()).toEqual([]);
  });

  it("terminateSession does not throw for unknown session", async () => {
    const sessions = new PiDevSessionManager("/tmp");
    await expect(sessions.terminateSession("nonexistent")).resolves.toBeUndefined();
  });
});
