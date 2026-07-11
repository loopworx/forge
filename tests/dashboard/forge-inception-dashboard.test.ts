import { describe, expect, it } from "bun:test";
import { ForgeInceptionDashboard } from "../../src/dashboard/forge-inception-dashboard";
import { AgentConversationBuffer } from "../../src/dashboard/agent-conversation-buffer";
import { ForgeSidebarComponent } from "../../src/dashboard/forge-sidebar-component";
import type { ProjectState } from "../../src/engine/types";

function mockProjectState(phase: number = 1): ProjectState {
  return {
    mode: "inception",
    inception: { mode: "inception", currentPhase: phase, phaseSessionId: null, artifacts: {} },
  };
}

describe("ForgeInceptionDashboard", () => {
  it("renders with sidebar and conversation areas", () => {
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState(1), [], "Lean Canvas", "po-agent");
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    const lines = dash.render(80);
    expect(lines.length).toBeGreaterThan(0);
    const joined = lines.join("\n");
    expect(joined).toContain("Inception");
  });

  it("renders conversation buffer content on the left", () => {
    const sidebar = new ForgeSidebarComponent();
    sidebar.setState(mockProjectState(1), [], "Lean Canvas", "po-agent");
    const buf = new AgentConversationBuffer("inception");
    buf.handleEvent({ type: "text_delta", sessionId: "inception", delta: "What are we building?" } as any);
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("What are we building?");
  });

  it("renders input bar at the bottom", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    const lines = dash.render(80);
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toContain(">");
  });

  it("shows typed text in the input bar", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    dash.handleInput("h");
    dash.handleInput("i");
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("hi");
  });

  it("Enter on regular text calls onSend and adds user message to buffer", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    let sent: any = null;
    dash.setOnSend((text: string) => { sent = text; });
    dash.handleInput("h");
    dash.handleInput("i");
    dash.handleInput("\r");
    expect(sent).toBe("hi");
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("user:");
    expect(lines[0]).toContain("hi");
  });

  it("Enter on /forge-next calls onCommand with name and args", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    let cmdName: any = null;
    let cmdArgs: any = null;
    dash.setOnCommand((name: string, args: string) => { cmdName = name; cmdArgs = args; });
    for (const ch of "/forge-next") dash.handleInput(ch);
    dash.handleInput("\r");
    expect(cmdName).toBe("forge-next");
    expect(cmdArgs).toBe("");
  });

  it("Enter on /forge-approve FOR-123 calls onCommand with args", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    let cmdName: any = null;
    let cmdArgs: any = null;
    dash.setOnCommand((name: string, args: string) => { cmdName = name; cmdArgs = args; });
    for (const ch of "/forge-approve FOR-123") dash.handleInput(ch);
    dash.handleInput("\r");
    expect(cmdName).toBe("forge-approve");
    expect(cmdArgs).toBe("FOR-123");
  });

  it("slash command does not add user message to buffer", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    dash.setOnCommand(() => {});
    for (const ch of "/forge-next") dash.handleInput(ch);
    dash.handleInput("\r");
    expect(buf.getLines().length).toBe(0);
  });

  it("Backspace removes last character from input", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    dash.handleInput("a");
    dash.handleInput("b");
    dash.handleInput("\x7f");
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("> a");
  });

  it("Escape calls onExit", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    let exited = false;
    dash.setOnExit(() => { exited = true; });
    dash.handleInput("\x1b");
    expect(exited).toBe(true);
  });

  it("clears input after Enter", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    dash.setOnSend(() => {});
    dash.handleInput("x");
    dash.handleInput("\r");
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).not.toContain("> x");
  });

  it("invalidate clears cached render", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    dash.render(80);
    dash.invalidate();
    const lines = dash.render(80);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("dispose can be called without error", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf);
    expect(() => dash.dispose()).not.toThrow();
  });
});
