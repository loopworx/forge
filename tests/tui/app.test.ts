import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { ForgeApp } from "../../src/tui/app";
import { InputBar } from "../../src/tui/input-bar";
import { ChatView } from "../../src/tui/chat-view";
import { TabBar } from "../../src/tui/tab-bar";
import { Sidebar } from "../../src/tui/sidebar";
import { StatusBar } from "../../src/tui/status-bar";

function inceptionEngine(sessions: any[] = []) {
  return {
    getProjectState: () => ({
      mode: "inception",
      inception: { mode: "inception", currentPhase: 1, phaseSessionId: null, artifacts: {} },
    }),
    getActiveSessions: () => sessions,
  } as any;
}

function devEngine(getSessions: () => any[] = () => []) {
  return {
    getProjectState: () => ({
      mode: "development",
      inception: { mode: "development", currentPhase: 8, phaseSessionId: null, artifacts: {} },
    }),
    getActiveSessions: getSessions,
  } as any;
}

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

  it("getInputBar returns the InputBar instance", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const app = new ForgeApp({ renderer, engine: inceptionEngine(), sessions: {} as any, commands: { getAll: () => [], filterByPrefix: () => [] } as any, mode: "inception" });
    app.layout();
    expect(app.getInputBar()).toBeInstanceOf(InputBar);
  });

  it("getChatView returns the ChatView instance", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const app = new ForgeApp({ renderer, engine: inceptionEngine(), sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    expect(app.getChatView()).toBeInstanceOf(ChatView);
  });

  it("getTabBar returns the TabBar instance", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const app = new ForgeApp({ renderer, engine: inceptionEngine(), sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    expect(app.getTabBar()).toBeInstanceOf(TabBar);
  });

  it("getSidebar returns the Sidebar instance", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const app = new ForgeApp({ renderer, engine: inceptionEngine(), sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    expect(app.getSidebar()).toBeInstanceOf(Sidebar);
  });

  it("getStatusBar returns the StatusBar instance", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const app = new ForgeApp({ renderer, engine: inceptionEngine(), sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    expect(app.getStatusBar()).toBeInstanceOf(StatusBar);
  });

  it("updates StatusBar on agent_settled event", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const app = new ForgeApp({ renderer, engine: devEngine(), sessions: {} as any, commands: { getAll: () => [], filterByPrefix: () => [] } as any, mode: "development" });
    app.layout();
    expect(app.getStatusBar().getText()).not.toContain("development");
    app.handleForgeEvent({ type: "agent_settled" });
    expect(app.getStatusBar().getText()).toContain("development");
  });

  it("re-renders sidebar children on engine event", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    let sessions: any[] = [];
    const app = new ForgeApp({ renderer, engine: devEngine(() => sessions), sessions: {} as any, commands: { getAll: () => [], filterByPrefix: () => [] } as any, mode: "development" });
    app.layout();
    await renderOnce();

    sessions = [{ sessionId: "s1", storyId: "FOR-99", agentRole: "developer-agent", workflowState: "in-dev", sessionStartTime: Date.now(), isRecovery: false }];
    app.handleEngineEvent({});

    const sidebarBox = (app as any).sidebarBox;
    const childTexts = sidebarBox.getChildren().map((c: any) => c.plainText ?? "");
    expect(childTexts.some((t: string) => t.includes("FOR-99"))).toBe(true);
  });
});
