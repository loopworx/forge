import type { TabManager } from "./tab-manager";
import type { AgentConversationBuffer } from "./agent-conversation-buffer";
import type { ForgeSidebarComponent } from "./forge-sidebar-component";

function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  return text.slice(0, Math.max(0, width - 3)) + "...";
}

function padTo(text: string, width: number): string {
  if (text.length >= width) return truncate(text, width);
  return text + " ".repeat(width - text.length);
}

export class ForgeDevDashboard {
  private renderTimer: ReturnType<typeof setInterval> | null = null;
  private cachedWidth: number | undefined;
  private cachedLines: string[] = [];
  private chatInput = "";
  private onSteer: ((sessionId: string, text: string) => void) | null = null;
  private onExit: (() => void) | null = null;

  constructor(
    private tabManager: TabManager,
    private sidebar: ForgeSidebarComponent,
    private buffers: Map<string, AgentConversationBuffer>,
  ) {}

  setOnSteer(handler: (sessionId: string, text: string) => void): void {
    this.onSteer = handler;
  }

  setOnExit(handler: () => void): void {
    this.onExit = handler;
  }

  render(width: number): string[] {
    if (this.cachedWidth === width && this.cachedLines.length > 0) {
      return this.cachedLines;
    }

    const w = Math.max(width, 20);
    const sidebarWidth = Math.min(28, Math.floor(w * 0.35));
    const mainWidth = w - sidebarWidth - 1;

    const tabs = this.tabManager.getTabs();
    const selectedId = this.tabManager.getSelectedId();

    // Build main area lines
    const mainLines: string[] = [];

    // Tab bar
    if (tabs.length > 0) {
      const modeLabel = this.tabManager.isAutoCycling() ? "(auto)" : "(manual)";
      const parts = tabs.map(t => {
        const label = this.tabManager.getTabLabel(t.sessionId);
        const sel = t.sessionId === selectedId ? "*" : " ";
        return `${sel}${label}`;
      });
      mainLines.push(truncate(`${parts.join("  ")}  ${modeLabel}`, mainWidth));
    } else {
      mainLines.push(truncate("No active sessions — press Escape to exit", mainWidth));
    }
    mainLines.push("─".repeat(mainWidth));

    // Conversation area
    if (selectedId) {
      const buf = this.buffers.get(selectedId);
      if (buf) {
        const convLines = buf.getLines();
        if (convLines.length === 0) {
          mainLines.push(truncate(" (waiting for agent output...)", mainWidth));
        } else {
          for (const cl of convLines) {
            mainLines.push(truncate(` ${cl}`, mainWidth));
          }
        }
        const toolName = buf.getCurrentToolName();
        if (toolName) {
          mainLines.push(truncate(` \u2699 ${toolName}...`, mainWidth));
        }
      } else {
        mainLines.push(truncate(" (no buffer for session)", mainWidth));
      }
    }

    // Pad main area to at least 15 lines
    while (mainLines.length < 15) {
      mainLines.push("");
    }

    // Chat bar
    mainLines.push("─".repeat(mainWidth));
    const chatPrompt = this.chatInput.length > 0 ? `> [${selectedId ?? ""}] ${this.chatInput}` : `> [${selectedId ?? ""}] _`;
    mainLines.push(truncate(chatPrompt, mainWidth));

    // Build sidebar lines
    const sidebarLines = this.sidebar.render(sidebarWidth);

    // Combine
    const maxLines = Math.max(mainLines.length, sidebarLines.length);
    const combined: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      const ml = i < mainLines.length ? mainLines[i] : "";
      const sl = i < sidebarLines.length ? sidebarLines[i] : "";
      combined.push(padTo(ml, mainWidth) + "│" + padTo(sl, sidebarWidth));
    }

    this.cachedWidth = width;
    this.cachedLines = combined;
    return combined;
  }

  handleInput(data: string): void {
    if (data === "\x1b[C") {
      this.tabManager.cycleNext();
      this.invalidate();
      return;
    }
    if (data === "\x1b[D") {
      this.tabManager.cyclePrev();
      this.invalidate();
      return;
    }
    if (data === "\t") {
      if (this.tabManager.isAutoCycling()) {
        this.tabManager.setManual();
      } else {
        this.tabManager.setAuto();
      }
      this.invalidate();
      return;
    }
    if (data === "\x1b[Z") {
      // Shift+Tab — return to auto
      this.tabManager.setAuto();
      this.invalidate();
      return;
    }
    if (data === "\x1b" || data === "\x1b\x1b") {
      this.onExit?.();
      return;
    }
    if (data === "\r" || data === "\n") {
      if (this.chatInput.trim() && this.onSteer) {
        const selectedId = this.tabManager.getSelectedId();
        if (selectedId) {
          this.onSteer(selectedId, this.chatInput);
        }
      }
      this.chatInput = "";
      this.invalidate();
      return;
    }
    if (data === "\x7f" || data === "\b") {
      this.chatInput = this.chatInput.slice(0, -1);
      this.invalidate();
      return;
    }
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.chatInput += data;
      this.invalidate();
    }
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = [];
    this.sidebar.invalidate();
  }

  dispose(): void {
    if (this.renderTimer) {
      clearInterval(this.renderTimer);
      this.renderTimer = null;
    }
  }
}
