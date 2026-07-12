import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { ForgeApp } from "../../src/tui/app";

describe("ForgeApp", () => {
  it("renders inception mode layout", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 1, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const mockCommands = { getAll: () => [], filterByPrefix: () => [] } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: mockCommands, mode: "inception" });
    app.layout();
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("Inception");
    expect(frame).toContain("Forge");
  });

  it("renders development mode with tab bar", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "development", inception: { mode: "development", currentPhase: 8, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [{ sessionId: "s1", storyId: "FOR-5", agentRole: "developer-agent", workflowState: "in-dev", sessionStartTime: Date.now(), isRecovery: false }],
    } as any;
    const mockCommands = { getAll: () => [], filterByPrefix: () => [] } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: mockCommands, mode: "development" });
    app.layout();
    await renderOnce();
    expect(captureCharFrame()).toContain("Development");
  });

  it("handles text_delta events", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 1, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    app.handleForgeEvent({ type: "text_delta", delta: "Hello from agent" });
    await renderOnce();
    expect(captureCharFrame()).toContain("Hello from agent");
  });
});
