import type { DashboardComponent } from "../engine/interfaces";
import type { SessionInfo, Transition } from "../engine/types";

export interface Sidebar extends DashboardComponent {
  setSessions(sessions: SessionInfo[]): void;
  setTransitions(transitions: Transition[]): void;
  setGuardianStatus(status: string): void;
}

export interface AgentPanel extends DashboardComponent {
  pushOutput(text: string): void;
  setActiveSession(id: string | null): void;
  clear(): void;
  cycleNext(): void;
  cyclePause(): void;
  cycleResume(): void;
}

export interface SplitLayoutConfig {
  sidebar: Sidebar;
  agentPanel: AgentPanel;
  chatBar: DashboardComponent;
  sidebarWidth?: number;
}

type FocusTarget = "sidebar" | "agentPanel" | "chatBar";

export class SplitLayout implements DashboardComponent {
  private sidebar: Sidebar;
  private agentPanel: AgentPanel;
  private chatBar: DashboardComponent;
  private sidebarWidth: number;
  private focus: FocusTarget = "agentPanel";

  constructor(config: SplitLayoutConfig) {
    this.sidebar = config.sidebar;
    this.agentPanel = config.agentPanel;
    this.chatBar = config.chatBar;
    this.sidebarWidth = config.sidebarWidth ?? 25;
  }

  render(width: number): string[] {
    const safeWidth = Math.max(width, 10);
    const sbWidth = Math.min(this.sidebarWidth, safeWidth - 5);
    const rightWidth = safeWidth - sbWidth - 1;

    const sidebarLines = this.sidebar.render(sbWidth);
    const agentLines = this.agentPanel.render(rightWidth);
    const chatLines = this.chatBar.render(rightWidth);

    const combined: string[] = [];
    const maxLines = Math.max(
      sidebarLines.length,
      agentLines.length + chatLines.length,
    );

    for (let i = 0; i < maxLines; i++) {
      const sbPart = i < sidebarLines.length ? sidebarLines[i] : "";
      const sbPadded = sbPart.padEnd(sbWidth).slice(0, sbWidth);

      const sep = i === 0 ? "\u2502" : " ";

      let rightPart = "";
      if (i < agentLines.length) {
        rightPart = agentLines[i];
      } else if (i - agentLines.length < chatLines.length) {
        rightPart = chatLines[i - agentLines.length];
      }
      const rightPadded = rightPart.padEnd(rightWidth).slice(0, rightWidth);

      combined.push(sbPadded + sep + rightPadded);
    }

    return combined;
  }

  handleInput(data: string): void {
    if (data === "\t") {
      this.focus = this.focus === "sidebar" ? "agentPanel" : "sidebar";
      return;
    }

    switch (this.focus) {
      case "sidebar":
        this.sidebar.handleInput(data);
        break;
      case "agentPanel":
        this.agentPanel.handleInput(data);
        break;
      case "chatBar":
        this.chatBar.handleInput(data);
        break;
    }
  }

  invalidate(): void {
    this.sidebar.invalidate();
    this.agentPanel.invalidate();
    this.chatBar.invalidate();
  }

  focusSidebar(): void {
    this.focus = "sidebar";
  }

  focusAgentPanel(): void {
    this.focus = "agentPanel";
  }

  focusChatBar(): void {
    this.focus = "chatBar";
  }
}
