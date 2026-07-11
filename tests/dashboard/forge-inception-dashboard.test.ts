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
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
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
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("What are we building?");
  });

  it("renders input bar at the bottom", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    const lines = dash.render(80);
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toContain(">");
  });

  it("shows typed text in the input bar", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    dash.handleInput("h");
    dash.handleInput("i");
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("hi");
  });

  it("Enter on regular text calls onSend and adds user message to buffer", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    let sent: any = null;
    dash.setOnSend((text: string) => { sent = text; });
    dash.handleInput("h");
    dash.handleInput("i");
    dash.handleInput("\r");
    expect(sent).toBe("hi");
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("> hi");
  });

  it("Enter on /forge-next calls onCommand with name and args", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
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
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
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
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    dash.setOnCommand(() => {});
    for (const ch of "/forge-next") dash.handleInput(ch);
    dash.handleInput("\r");
    expect(buf.getLines().length).toBe(0);
  });

  it("Backspace removes last character from input", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
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
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    let exited = false;
    dash.setOnExit(() => { exited = true; });
    dash.handleInput("\x1b");
    expect(exited).toBe(true);
  });

  it("clears input after Enter", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    dash.setOnSend(() => {});
    dash.handleInput("x");
    dash.handleInput("\r");
    const lines = dash.render(80);
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toContain("> _");
  });

  it("invalidate clears cached render", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    dash.render(80);
    dash.invalidate();
    const lines = dash.render(80);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("dispose can be called without error", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    expect(() => dash.dispose()).not.toThrow();
  });

  // --- Spinner tests ---

  it("renders spinner when tool call is active", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    buf.handleEvent({ type: "tool_call", sessionId: "inception", toolName: "bash" } as any);
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("bash");
    expect(joined).toContain("\u2699");
  });

  it("does not render spinner when no tool is active", () => {
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => []);
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).not.toContain("\u2699");
  });

  // --- Autocomplete tests ---

  it("shows autocomplete list when input starts with /", () => {
    const commands = ["forge-new", "forge-next", "forge-status", "help", "login"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    dash.handleInput("/");
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("forge-new");
    expect(joined).toContain("forge-next");
    expect(joined).toContain("help");
    expect(joined).toContain("login");
  });

  it("filters autocomplete by prefix", () => {
    const commands = ["forge-new", "forge-next", "forge-status", "help", "login"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    for (const ch of "/forge") dash.handleInput(ch);
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("forge-new");
    expect(joined).toContain("forge-next");
    expect(joined).toContain("forge-status");
    expect(joined).not.toContain("  help");
    expect(joined).not.toContain("  login");
  });

  it("arrow down selects next autocomplete item", () => {
    const commands = ["forge-new", "forge-next", "forge-status"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    dash.handleInput("/");
    dash.handleInput("\x1b[B"); // arrow down
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("> /forge-new");
  });

  it("arrow up selects previous autocomplete item", () => {
    const commands = ["forge-new", "forge-next", "forge-status"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    dash.handleInput("/");
    dash.handleInput("\x1b[B"); // down
    dash.handleInput("\x1b[B"); // down
    dash.handleInput("\x1b[A"); // up
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("> /forge-new");
  });

  it("Tab completes the selected command name", () => {
    const commands = ["forge-new", "forge-next", "forge-status"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    dash.handleInput("/");
    dash.handleInput("\x1b[B"); // select forge-new
    dash.handleInput("\t");
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("/forge-new");
  });

  it("Tab without selection completes first item", () => {
    const commands = ["forge-new", "forge-next"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    dash.handleInput("/");
    dash.handleInput("\t");
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("/forge-new");
  });

  it("autocomplete hidden when input does not start with /", () => {
    const commands = ["forge-new", "forge-next"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    dash.handleInput("h");
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).not.toContain("forge-new");
  });

  it("autocomplete hidden after command is submitted", () => {
    const commands = ["forge-new", "forge-next"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    dash.setOnCommand(() => {});
    dash.handleInput("/");
    dash.handleInput("\t"); // complete to /forge-new
    dash.handleInput("\r"); // submit
    const lines = dash.render(80);
    const joined = lines.join("\n");
    expect(joined).not.toContain("  forge-next");
  });

  it("unknown command passes to onCommand which can provide feedback", () => {
    const commands = ["forge-new"];
    const sidebar = new ForgeSidebarComponent();
    const buf = new AgentConversationBuffer("inception");
    const dash = new ForgeInceptionDashboard(sidebar, buf, () => commands);
    let received: any = null;
    dash.setOnCommand((name: string) => { received = name; });
    for (const ch of "/badcmd") dash.handleInput(ch);
    dash.handleInput("\r");
    expect(received).toBe("badcmd");
  });
});
