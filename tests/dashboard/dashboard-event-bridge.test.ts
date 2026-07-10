import { describe, expect, it, beforeEach } from "bun:test";
import { DashboardEventBridge } from "../../src/dashboard/dashboard-event-bridge";
import { ForgeSidebar } from "../../src/dashboard/forge-sidebar";
import { ForgeAgentPanel } from "../../src/dashboard/forge-agent-panel";
import type { EngineEvent } from "../../src/engine/events";

describe("DashboardEventBridge", () => {
  let sidebar: ForgeSidebar;
  let agentPanel: ForgeAgentPanel;
  let bridge: DashboardEventBridge;

  beforeEach(() => {
    sidebar = new ForgeSidebar();
    agentPanel = new ForgeAgentPanel();
    bridge = new DashboardEventBridge(sidebar, agentPanel);
  });

  it("updates sidebar on session_created event", () => {
    const event: EngineEvent = {
      type: "session_created",
      sessionId: "s1",
      storyId: "F-1",
      agentRole: "developer-agent",
    };
    bridge.handle(event);

    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("F-1");
  });

  it("updates agent panel on output event", () => {
    const sessionEvent: EngineEvent = {
      type: "session_created",
      sessionId: "s1",
      storyId: "F-1",
      agentRole: "developer-agent",
    };
    bridge.handle(sessionEvent);

    const outputEvent: EngineEvent = {
      type: "output",
      sessionId: "s1",
      delta: "Test output line",
    };
    bridge.handle(outputEvent);

    const lines = agentPanel.render(40);
    const text = lines.join("\n");
    expect(text).toContain("Test output line");
  });

  it("updates transitions on story_claimed event", () => {
    const event: EngineEvent = {
      type: "story_claimed",
      storyId: "F-1",
      agentRole: "developer-agent",
    };
    bridge.handle(event);

    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("F-1");
  });

  it("updates guardian status on story_halted event", () => {
    const event: EngineEvent = {
      type: "story_halted",
      storyId: "F-1",
      reason: "stall detected",
    };
    bridge.handle(event);

    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("stall detected");
  });

  it("tracks session settlement", () => {
    const created: EngineEvent = {
      type: "session_created",
      sessionId: "s1",
      storyId: "F-1",
      agentRole: "developer-agent",
    };
    bridge.handle(created);

    const settled: EngineEvent = {
      type: "session_settled",
      sessionId: "s1",
      storyId: "F-1",
    };
    bridge.handle(settled);

    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("F-1");
  });
});
