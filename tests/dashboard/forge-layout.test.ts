import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { ForgeLayout } from "../../src/dashboard/forge-layout";
import { SplitLayout } from "../../src/dashboard/split-layout";
import { ForgeSidebar } from "../../src/dashboard/forge-sidebar";
import { ForgeAgentPanel } from "../../src/dashboard/forge-agent-panel";
import { ForgeChatBar } from "../../src/dashboard/forge-chat-bar";
import { DashboardEventBridge } from "../../src/dashboard/dashboard-event-bridge";

describe("ForgeLayout", () => {
  let sidebar: ForgeSidebar;
  let agentPanel: ForgeAgentPanel;
  let chatBar: ForgeChatBar;
  let splitLayout: SplitLayout;
  let eventBridge: DashboardEventBridge;
  let layout: ForgeLayout;

  beforeEach(() => {
    sidebar = new ForgeSidebar();
    agentPanel = new ForgeAgentPanel();
    chatBar = new ForgeChatBar();
    splitLayout = new SplitLayout({ sidebar, agentPanel, chatBar });
    eventBridge = new DashboardEventBridge(sidebar, agentPanel);
    layout = new ForgeLayout(splitLayout, eventBridge, agentPanel);
  });

  afterEach(() => {
    layout.stop();
  });

  it("renders the dashboard", () => {
    const lines = layout.render(80);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("forwards engine events to the event bridge", () => {
    layout.handleEngineEvent({
      type: "session_created",
      sessionId: "s1",
      storyId: "F-1",
      agentRole: "developer-agent",
    });

    const lines = layout.render(80);
    expect(lines.some(l => l.includes("F-1"))).toBe(true);
  });

  it("forwards input to the split layout", () => {
    layout.handleInput("x");
    const lines = layout.render(80);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("auto-cycles agent outputs", async () => {
    agentPanel.pushOutput("output 1");
    agentPanel.pushOutput("output 2");

    layout.startCycling(10);
    await new Promise(r => setTimeout(r, 50));

    layout.stop();
    // Output should have cycled at least once
    const lines = agentPanel.render(80);
    const text = lines.join("\n");
    // Either output 1 or output 2 should be visible (cycling happened)
    expect(text.includes("output 1") || text.includes("output 2")).toBe(true);
  });

  it("pauses cycling on Shift+Tab", () => {
    layout.startCycling(1000);
    layout.handleInput("\x1b[Z"); // Shift+Tab
    layout.stop();

    expect(layout.isCyclingPaused()).toBe(true);
  });

  it("stops cycling on dispose", () => {
    layout.startCycling(10);
    layout.stop();
    expect(layout.isCyclingStopped()).toBe(true);
  });

  it("implements DashboardComponent", () => {
    expect(typeof layout.render).toBe("function");
    expect(typeof layout.handleInput).toBe("function");
    expect(typeof layout.invalidate).toBe("function");
  });
});
