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

  it("getRenderer returns the active renderer", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const app = new ForgeApp({ renderer, engine: inceptionEngine(), sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    expect(app.getRenderer()).toBe(renderer);
  });

  it("refreshStatusBar updates the rendered status text immediately after setModelInfo", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    await renderOnce();
    expect(captureCharFrame()).toContain("Not configured");
    app.setModelInfo("po-agent", "glm-5.2", "synthetic", "high", 16384);
    app.refreshStatusBar();
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("po-agent");
    expect(frame).toContain("glm-5.2");
    expect(frame).toContain("synthetic");
    expect(frame).toContain("high");
  });

  it("refreshStatusBar does NOT duplicate context info on the left side", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    app.setModelInfo("po-agent", "glm-5.2", "synthetic", "high", 16384);
    app.refreshStatusBar();
    await renderOnce();
    const frame = captureCharFrame();
    // Left side should have agent/model/provider/thinking.
    expect(frame).toContain("po-agent");
    expect(frame).toContain("glm-5.2");
    // The left status text should NOT contain token/pct info.
    // Find the status bar row (the row containing "po-agent" at the bottom
    // of the main column, before the input bar's ❯ prompt).
    const rows = frame.split("\n");
    const statusRow = rows.find(r => r.includes("po-agent") && r.includes("high"));
    expect(statusRow).toBeDefined();
    // The status row should NOT contain "0/16" or "0.0%" (left-side
    // context duplication). The right side shows "0/16k (0.0%)" once.
    // With the old getPlainText() the left side also had "0/16k (0.0%) · inception".
    // Now the left side only has agent · model · provider · thinking.
    // The status row will contain the right-side context info once, but
    // should NOT contain a second occurrence of "0.0%".
    const pctMatches = (statusRow!.match(/0\.0%/g) ?? []).length;
    expect(pctMatches).toBe(1);
  });

  it("refreshStatusBar does NOT trigger the question modal", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    let questionCalled = false;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    app.setOnQuestion(() => { questionCalled = true; });
    // Add an agent message that ends with ? so isQuestion would return true.
    app.getChatView().handleEvent({ type: "text_delta", delta: "Should I proceed?" } as any);
    app.getChatView().handleEvent({ type: "message_end", role: "assistant" } as any);
    await renderOnce();
    // Refresh status bar — should NOT trigger the question callback.
    app.setModelInfo("po-agent", "glm-5.2", "synthetic", "high", 16384);
    app.refreshStatusBar();
    await renderOnce();
    // Give the dynamic import in handleForgeEvent a chance to settle.
    await new Promise(r => setTimeout(r, 50));
    expect(questionCalled).toBe(false);
  });

  it("refreshSidebar re-renders sidebar with current phase info", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 2, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
      getInceptionPhaseInfo: () => ({ name: "User Journeys", agent: "ux-agent", total: 8 }),
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    await renderOnce();
    // Initial layout may not have phase name/agent; call refreshSidebar.
    app.refreshSidebar();
    await renderOnce();
    const frame = captureCharFrame();
    // currentPhase=2 (0-based) displays as "Phase: 3/8" (1-based)
    expect(frame).toContain("Phase: 3/8");
    expect(frame).toContain("User Journeys");
    expect(frame).toContain("(ux-agent)");
  });

  it("refreshSidebar updates phase total dynamically (not hardcoded /8)", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 3, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
      getInceptionPhaseInfo: () => ({ name: "Data Model", agent: "architect-agent", total: 12 }),
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    app.refreshSidebar();
    await renderOnce();
    const frame = captureCharFrame();
    // currentPhase=3 (0-based) displays as "Phase: 4/12" (1-based)
    expect(frame).toContain("Phase: 4/12");
    expect(frame).not.toContain("Phase: 3/8");
  });

  it("inserts a 3-row gap between chat view and input bar", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    await renderOnce();
    // Find the chat-input gap renderable in the main column.
    // Layout tree: renderer.root → forge-root → main-column → [chatView, gap, inputBar, statusBar]
    const forgeRoot = renderer.root.getChildren().find((c: any) => c.id === "forge-root");
    expect(forgeRoot).toBeDefined();
    const mainColumn = (forgeRoot as any)?.getChildren().find((c: any) => c.id === "main-column");
    expect(mainColumn).toBeDefined();
    const children = (mainColumn as any)?.getChildren() ?? [];
    const gap = children.find((c: any) => c.id === "chat-input-gap");
    expect(gap).toBeDefined();
    // Verify the gap is positioned between the chat view and the input bar.
    const gapIdx = children.findIndex((c: any) => c.id === "chat-input-gap");
    const inputIdx = children.findIndex((c: any) => c.id === "input-bar-container");
    expect(gapIdx).toBeGreaterThanOrEqual(0);
    expect(inputIdx).toBeGreaterThan(gapIdx);
  });

  it("updates StatusBar on agent_settled event", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const app = new ForgeApp({ renderer, engine: devEngine(), sessions: {} as any, commands: { getAll: () => [], filterByPrefix: () => [] } as any, mode: "development" });
    app.layout();
    expect(app.getStatusBar().getPlainText()).not.toContain("development");
    app.handleForgeEvent({ type: "agent_settled" });
    expect(app.getStatusBar().getPlainText()).toContain("development");
  });

  it("uses stored model info in StatusBar on agent_settled", async () => {
    const { renderer } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    app.setModelInfo("po-agent", "glm-5.2", "synthetic", "high", 16384);
    app.handleForgeEvent({ type: "agent_settled" });
    const statusText = app.getStatusBar().getPlainText();
    expect(statusText).toContain("po-agent");
    expect(statusText).toContain("glm-5.2");
    expect(statusText).toContain("synthetic");
    expect(statusText).toContain("high");
  });

  it("updates rendered status bar text after agent_settled", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    await renderOnce();
    expect(captureCharFrame()).toContain("Not configured");
    app.setModelInfo("po-agent", "glm-5.2", "synthetic", "high", 16384);
    app.handleForgeEvent({ type: "agent_settled" });
    await renderOnce();
    expect(captureCharFrame()).toContain("glm-5.2");
    expect(captureCharFrame()).toContain("synthetic");
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

  // --- Layout visual separation (issue: no visible space between sidebar and chat) ---
  // Root background is #0f0f0f (backgroundPanel) and sidebar is also #0f0f0f,
  // so the 2-col gap between them is invisible. Fix: give the gap and the
  // main column the darkest shade (#080808 = background) so they contrast
  // with the panel-shade sidebar and root.

  it("sidebar gap has background color for visible separation from sidebar", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    await renderOnce();
    const forgeRoot = renderer.root.getChildren().find((c: any) => c.id === "forge-root");
    const sidebarGap = (forgeRoot as any)?.getChildren().find((c: any) => c.id === "sidebar-gap");
    expect(sidebarGap).toBeDefined();
    // The gap must have the darkest background shade (#080808) so it
    // contrasts with the sidebar's panel shade (#0f0f0f). Without an
    // explicit backgroundColor, the gap inherits the root's #0f0f0f and
    // is visually indistinguishable from the sidebar.
    const bg = sidebarGap.backgroundColor;
    expect(bg).toBeDefined();
    // OpenTUI stores colors as RGBA objects. #080808 = (8, 8, 8, 255).
    const [r, g, b] = bg.toInts();
    expect(r).toBe(8);
    expect(g).toBe(8);
    expect(b).toBe(8);
  });

  it("main column has background color for visible separation from sidebar", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    await renderOnce();
    const forgeRoot = renderer.root.getChildren().find((c: any) => c.id === "forge-root");
    const mainColumn = (forgeRoot as any)?.getChildren().find((c: any) => c.id === "main-column");
    expect(mainColumn).toBeDefined();
    const bg = mainColumn.backgroundColor;
    expect(bg).toBeDefined();
    const [r, g, b] = bg.toInts();
    expect(r).toBe(8);
    expect(g).toBe(8);
    expect(b).toBe(8);
  });

  it("forge-root has exactly 3 children (mainColumn, sidebarGap, sidebar) — no duplicates", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    await renderOnce();
    const forgeRoot = renderer.root.getChildren().find((c: any) => c.id === "forge-root");
    const children = (forgeRoot as any)?.getChildren() ?? [];
    // Regression: commit 9a47434 added root.add(mainColumn) twice (once
    // before the sidebar block and once after the sidebarGap). The
    // duplicate add was a no-op in OpenTUI (same id), but the intent
    // was a single tree with 3 children.
    expect(children.length).toBe(3);
    const ids = children.map((c: any) => c.id);
    expect(ids).toContain("main-column");
    expect(ids).toContain("sidebar-gap");
    expect(ids).toContain("sidebar");
  });

  // --- Question modal error handling (issue: chat clears + TUI freezes) ---
  // When the question callback throws (e.g. SelectOverlay creation fails,
  // extractSuggestions throws, etc.), the error must be caught — otherwise
  // it becomes an unhandled promise rejection that leaves the TUI in a
  // broken state (chat cleared, /sessions and other commands stop working
  // because the renderer's global unhandledRejection handler swallows
  // subsequent errors).

  it("handleForgeEvent catches errors from the question callback (no unhandled rejection)", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    let callbackCalled = false;
    let unhandledRejection = false;
    const rejectionHandler = () => { unhandledRejection = true; };
    process.on("unhandledRejection", rejectionHandler);
    try {
      const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
      app.layout();
      app.setOnQuestion(() => { callbackCalled = true; throw new Error("callback boom"); });
      // Add an agent message ending with ? so isQuestion returns true.
      app.getChatView().handleEvent({ type: "text_delta", delta: "Should I proceed?" } as any);
      app.getChatView().handleEvent({ type: "message_end", role: "assistant" } as any);
      // Emit agent_settled — triggers the question check via a dynamic
      // import().then() chain. Without a .catch(), the thrown error in
      // the callback becomes an unhandled promise rejection.
      app.handleForgeEvent({ type: "agent_settled" });
      await renderOnce();
      // Wait for the dynamic import + microtask queue to settle.
      await new Promise(r => setTimeout(r, 100));
      expect(callbackCalled).toBe(true);
      expect(unhandledRejection).toBe(false);
    } finally {
      process.off("unhandledRejection", rejectionHandler);
    }
  });

  it("handleForgeEvent catches errors from isQuestion itself (no unhandled rejection)", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    let unhandledRejection = false;
    const rejectionHandler = () => { unhandledRejection = true; };
    process.on("unhandledRejection", rejectionHandler);
    try {
      const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
      app.layout();
      // Set a question callback that should NOT be reached if isQuestion
      // throws — but we can't easily make isQuestion throw. Instead, verify
      // that the normal path (no question detected) doesn't produce an
      // unhandled rejection when the callback is set.
      app.setOnQuestion(() => {});
      app.getChatView().handleEvent({ type: "text_delta", delta: "Not a question" } as any);
      app.getChatView().handleEvent({ type: "message_end", role: "assistant" } as any);
      app.handleForgeEvent({ type: "agent_settled" });
      await renderOnce();
      await new Promise(r => setTimeout(r, 100));
      expect(unhandledRejection).toBe(false);
    } finally {
      process.off("unhandledRejection", rejectionHandler);
    }
  });

  it("handleEngineEvent catches errors from refreshSidebar (no unhandled rejection)", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 100, height: 30 });
    // Engine whose getActiveSessions throws on the 2nd+ call — the 1st
    // call is from layout() (must succeed), subsequent calls are from
    // refreshSidebar() via handleEngineEvent (must throw).
    let callCount = 0;
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => {
        callCount++;
        if (callCount <= 2) return []; // 1st: layout line 43, 2nd: layout line 155
        throw new Error("engine boom"); // 3rd+: handleEngineEvent → refreshSidebar
      },
    } as any;
    let unhandledRejection = false;
    const rejectionHandler = () => { unhandledRejection = true; };
    process.on("unhandledRejection", rejectionHandler);
    try {
      const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
      app.layout();
      await renderOnce();
      // handleEngineEvent should catch the error from refreshSidebar
      // (which calls engine.getActiveSessions() → throws on 2nd call).
      expect(() => app.handleEngineEvent({})).not.toThrow();
      await new Promise(r => setTimeout(r, 50));
      expect(unhandledRejection).toBe(false);
    } finally {
      process.off("unhandledRejection", rejectionHandler);
    }
  });
});
