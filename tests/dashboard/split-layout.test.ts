import { describe, expect, it, beforeEach } from "bun:test";
import { SplitLayout, Sidebar, AgentPanel } from "../../src/dashboard/split-layout";
import type { DashboardComponent } from "../../src/engine/interfaces";
import type { SessionInfo, Transition } from "../../src/engine/types";

class StubComponent implements DashboardComponent {
  renderedWidths: number[] = [];
  inputs: string[] = [];
  invalidated = false;
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  render(width: number): string[] {
    this.renderedWidths.push(width);
    return this.text.split("\n");
  }

  handleInput(data: string): void {
    this.inputs.push(data);
  }

  invalidate(): void {
    this.invalidated = true;
  }

  setText(text: string): void {
    this.text = text;
  }
}

class StubSidebar extends StubComponent implements Sidebar {
  setSessions(_sessions: SessionInfo[]): void {}
  setTransitions(_transitions: Transition[]): void {}
  setGuardianStatus(_status: string): void {}
}

class StubAgentPanel extends StubComponent implements AgentPanel {
  pushOutput(_text: string): void {}
  setActiveSession(_id: string | null): void {}
  clear(): void {}
  cycleNext(): void {}
  cyclePause(): void {}
  cycleResume(): void {}
}

describe("SplitLayout", () => {
  let sidebar: StubSidebar;
  let agentPanel: StubAgentPanel;
  let chatBar: StubComponent;
  let layout: SplitLayout;

  beforeEach(() => {
    sidebar = new StubSidebar("SIDEBAR");
    agentPanel = new StubAgentPanel("AGENT PANEL");
    chatBar = new StubComponent("CHAT BAR");
    layout = new SplitLayout({ sidebar, agentPanel, chatBar });
  });

  it("implements DashboardComponent", () => {
    expect(typeof layout.render).toBe("function");
    expect(typeof layout.handleInput).toBe("function");
    expect(typeof layout.invalidate).toBe("function");
  });

  it("renders sidebar on left and agent panel on right", () => {
    const lines = layout.render(80);
    expect(lines.length).toBeGreaterThan(0);
    const firstLine = lines[0];
    expect(firstLine).toContain("SIDEBAR");
    expect(firstLine).toContain("AGENT PANEL");
  });

  it("sidebar gets 25 columns out of 80 by default", () => {
    layout.render(80);
    expect(sidebar.renderedWidths[sidebar.renderedWidths.length - 1]).toBe(25);
    expect(agentPanel.renderedWidths[agentPanel.renderedWidths.length - 1]).toBe(79 - 25);
  });

  it("agent panel and chat bar share the right side vertically", () => {
    layout.render(80);
    const lines = layout.render(80);
    const hasAgent = lines.some(l => l.includes("AGENT PANEL"));
    const hasChat = lines.some(l => l.includes("CHAT BAR"));
    expect(hasAgent).toBe(true);
    expect(hasChat).toBe(true);
  });

  it("forwards input to focused component", () => {
    layout.focusSidebar();
    layout.handleInput("tab");
    expect(sidebar.inputs).toContain("tab");
    expect(agentPanel.inputs.length).toBe(0);
  });

  it("forwards input to agent panel when it has focus", () => {
    layout.focusAgentPanel();
    layout.handleInput("enter");
    expect(agentPanel.inputs).toContain("enter");
    expect(sidebar.inputs.length).toBe(0);
  });

  it("cycles focus between sidebar and agent panel", () => {
    layout.focusSidebar();
    layout.handleInput("\t"); // tab switches focus
    layout.handleInput("x");
    expect(sidebar.inputs).not.toContain("x");
    expect(agentPanel.inputs).toContain("x");
  });

  it("invalidates all children", () => {
    layout.invalidate();
    expect(sidebar.invalidated).toBe(true);
    expect(agentPanel.invalidated).toBe(true);
    expect(chatBar.invalidated).toBe(true);
  });

  it("custom sidebar width can be configured", () => {
    const custom = new SplitLayout({ sidebar, agentPanel, chatBar, sidebarWidth: 40 });
    custom.render(100);
    expect(sidebar.renderedWidths[sidebar.renderedWidths.length - 1]).toBe(40);
  });

  it("does not crash on very narrow terminals", () => {
    expect(() => layout.render(30)).not.toThrow();
  });
});
