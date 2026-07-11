import { describe, expect, it } from "bun:test";
import { ForgeDevDashboard } from "../../src/dashboard/forge-dev-dashboard";
import { TabManager } from "../../src/dashboard/tab-manager";
import { AgentConversationBuffer } from "../../src/dashboard/agent-conversation-buffer";
import { ForgeSidebarComponent } from "../../src/dashboard/forge-sidebar-component";
import type { ProjectState } from "../../src/engine/types";

function mockProjectState(mode: string = "development", phase: number = 0): ProjectState {
  return {
    mode: mode as any,
    inception: { mode: mode as any, currentPhase: phase, phaseSessionId: null, artifacts: {} },
  };
}

describe("ForgeDevDashboard", () => {
  it("renders empty state when no tabs", () => {
    const tm = new TabManager();
    const sidebar = new ForgeSidebarComponent();
    const dash = new ForgeDevDashboard(tm, sidebar, new Map());
    const lines = dash.render(80);
    expect(lines.length).toBeGreaterThan(0);
    const joined = lines.join("\n");
    expect(joined).toContain("No active");
  });

  it("renders tab bar and conversation when tabs exist", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState("development"), [], undefined, undefined);

    const buffers = new Map<string, AgentConversationBuffer>();
    const buf = new AgentConversationBuffer("s1");
    buf.handleEvent({ type: "text_delta", sessionId: "s1", delta: "Working on it..." } as any);
    buffers.set("s1", buf);

    const dash = new ForgeDevDashboard(tm, sidebar, buffers);
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("FOR-5");
    expect(joined).toContain("Working on it");
  });

  it("renders sidebar on the right side", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState("development"), [], undefined, undefined);

    const buffers = new Map<string, AgentConversationBuffer>();
    buffers.set("s1", new AgentConversationBuffer("s1"));

    const dash = new ForgeDevDashboard(tm, sidebar, buffers);
    const width = 80;
    const lines = dash.render(width);
    const joined = lines.join("\n");
    // Sidebar content should appear in the right portion
    expect(joined).toContain("Forge");
    expect(joined).toContain("Development");
  });

  it("renders chat bar at the bottom", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState("development"), [], undefined, undefined);

    const buffers = new Map<string, AgentConversationBuffer>();
    buffers.set("s1", new AgentConversationBuffer("s1"));

    const dash = new ForgeDevDashboard(tm, sidebar, buffers);
    const lines = dash.render(80);
    // Last few lines should contain the chat bar prompt
    const last5 = lines.slice(-5).join("\n");
    expect(last5).toContain(">");
  });

  it("all lines fit within width", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    tm.addTab("s2", "FOR-8", "qa-agent");
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState("development"), [
      { sessionId: "s1", storyId: "FOR-5", agentRole: "developer-agent" as any, workflowState: "in-dev" as any, sessionStartTime: Date.now(), isRecovery: false },
    ], undefined, undefined);

    const buffers = new Map<string, AgentConversationBuffer>();
    buffers.set("s1", new AgentConversationBuffer("s1"));
    buffers.set("s2", new AgentConversationBuffer("s2"));

    const dash = new ForgeDevDashboard(tm, sidebar, buffers);
    const width = 60;
    const lines = dash.render(width);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(width);
    }
  });

  it("handleInput with left/right arrows cycles tabs", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    tm.addTab("s2", "FOR-8", "qa-agent");
    const sidebar = new ForgeSidebarComponent();
    const dash = new ForgeDevDashboard(tm, sidebar, new Map());

    expect(tm.getSelectedId()).toBe("s1");
    dash.handleInput("\x1b[C"); // right arrow
    expect(tm.getSelectedId()).toBe("s2");
    dash.handleInput("\x1b[D"); // left arrow
    expect(tm.getSelectedId()).toBe("s1");
  });

  it("handleInput Tab toggles manual mode", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const sidebar = new ForgeSidebarComponent();
    const dash = new ForgeDevDashboard(tm, sidebar, new Map());

    expect(tm.isAutoCycling()).toBe(true);
    dash.handleInput("\t");
    expect(tm.isAutoCycling()).toBe(false);
    dash.handleInput("\t");
    expect(tm.isAutoCycling()).toBe(true);
  });

  it("invalidate clears cache", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState("development"), [], undefined, undefined);
    const buffers = new Map<string, AgentConversationBuffer>();
    buffers.set("s1", new AgentConversationBuffer("s1"));

    const dash = new ForgeDevDashboard(tm, sidebar, buffers);
    dash.render(80);
    expect(() => dash.invalidate()).not.toThrow();
    const lines = dash.render(80);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("dispose stops render timer", () => {
    const tm = new TabManager();
    const sidebar = new ForgeSidebarComponent();
    const dash = new ForgeDevDashboard(tm, sidebar, new Map());
    expect(() => dash.dispose()).not.toThrow();
  });

  it("renders spinner when selected session has active tool call", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState("development"), [], undefined, undefined);
    const buffers = new Map<string, AgentConversationBuffer>();
    const buf = new AgentConversationBuffer("s1");
    buf.handleEvent({ type: "tool_call", sessionId: "s1", toolName: "bash" } as any);
    buffers.set("s1", buf);

    const dash = new ForgeDevDashboard(tm, sidebar, buffers);
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("\u2699");
    expect(joined).toContain("bash");
  });

  it("does not render spinner when no tool is active", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState("development"), [], undefined, undefined);
    const buffers = new Map<string, AgentConversationBuffer>();
    buffers.set("s1", new AgentConversationBuffer("s1"));

    const dash = new ForgeDevDashboard(tm, sidebar, buffers);
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).not.toContain("\u2699");
  });
});
