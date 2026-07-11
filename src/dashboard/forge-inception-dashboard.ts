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

const MAX_AUTOCOMPLETE = 5;

export class ForgeInceptionDashboard {
  private cachedWidth: number | undefined;
  private cachedLines: string[] = [];
  private chatInput = "";
  private autocompleteIndex = -1;
  private onSend: ((text: string) => void) | null = null;
  private onCommand: ((name: string, args: string) => void) | null = null;
  private onExit: (() => void) | null = null;

  constructor(
    private sidebar: ForgeSidebarComponent,
    private buffer: AgentConversationBuffer,
    private getCommands: () => string[],
  ) {}

  setOnSend(handler: (text: string) => void): void {
    this.onSend = handler;
  }

  setOnCommand(handler: (name: string, args: string) => void): void {
    this.onCommand = handler;
  }

  setOnExit(handler: () => void): void {
    this.onExit = handler;
  }

  private getAutocompleteItems(): string[] {
    if (!this.chatInput.startsWith("/")) return [];
    const prefix = this.chatInput.slice(1).toLowerCase();
    const all = this.getCommands();
    return all.filter(c => c.toLowerCase().startsWith(prefix)).slice(0, MAX_AUTOCOMPLETE);
  }

  private isAutocompleteShowing(): boolean {
    return this.chatInput.startsWith("/") && this.getAutocompleteItems().length > 0;
  }

  render(width: number): string[] {
    if (this.cachedWidth === width && this.cachedLines.length > 0) {
      return this.cachedLines;
    }

    const w = Math.max(width, 20);
    const sidebarWidth = Math.min(28, Math.floor(w * 0.3));
    const mainWidth = w - sidebarWidth - 1;

    const mainLines: string[] = [];

    const convLines = this.buffer.getLines();
    if (convLines.length === 0) {
      mainLines.push(truncate(" (waiting for agent output...)", mainWidth));
    } else {
      for (const cl of convLines) {
        mainLines.push(truncate(` ${cl}`, mainWidth));
      }
    }

    const toolName = this.buffer.getCurrentToolName();
    if (toolName) {
      mainLines.push(truncate(` \u2699 ${toolName}...`, mainWidth));
    }

    while (mainLines.length < 15) {
      mainLines.push("");
    }

    mainLines.push("\u2500".repeat(mainWidth));

    const acItems = this.getAutocompleteItems();
    if (acItems.length > 0) {
      for (let i = 0; i < acItems.length; i++) {
        const marker = i === this.autocompleteIndex ? ">" : " ";
        mainLines.push(truncate(` ${marker} /${acItems[i]}`, mainWidth));
      }
    }

    const chatPrompt = this.chatInput.length > 0
      ? `> ${this.chatInput}`
      : "> _";
    mainLines.push(truncate(chatPrompt, mainWidth));

    const sidebarLines = this.sidebar.render(sidebarWidth);

    const maxLines = Math.max(mainLines.length, sidebarLines.length);
    const combined: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      const ml = i < mainLines.length ? mainLines[i] : "";
      const sl = i < sidebarLines.length ? sidebarLines[i] : "";
      combined.push(padTo(ml, mainWidth) + "\u2502" + padTo(sl, sidebarWidth));
    }

    this.cachedWidth = width;
    this.cachedLines = combined;
    return combined;
  }

  handleInput(data: string): void {
    if (data === "\x1b" || data === "\x1b\x1b") {
      this.onExit?.();
      return;
    }

    if (this.isAutocompleteShowing()) {
      if (data === "\x1b[B") {
        const items = this.getAutocompleteItems();
        this.autocompleteIndex = Math.min(this.autocompleteIndex + 1, items.length - 1);
        this.invalidate();
        return;
      }
      if (data === "\x1b[A") {
        this.autocompleteIndex = Math.max(this.autocompleteIndex - 1, -1);
        this.invalidate();
        return;
      }
      if (data === "\t") {
        const items = this.getAutocompleteItems();
        const idx = this.autocompleteIndex >= 0 ? this.autocompleteIndex : 0;
        if (items[idx]) {
          this.chatInput = `/${items[idx]}`;
          this.autocompleteIndex = -1;
        }
        this.invalidate();
        return;
      }
    }

    if (data === "\r" || data === "\n") {
      const text = this.chatInput.trim();
      this.chatInput = "";
      this.autocompleteIndex = -1;
      if (!text) {
        this.invalidate();
        return;
      }
      if (text.startsWith("/")) {
        const sp = text.indexOf(" ");
        const name = sp > 0 ? text.slice(1, sp) : text.slice(1);
        const args = sp > 0 ? text.slice(sp + 1) : "";
        this.onCommand?.(name, args);
      } else {
        this.buffer.addUserMessage(text);
        this.onSend?.(text);
      }
      this.invalidate();
      return;
    }
    if (data === "\x7f" || data === "\b") {
      this.chatInput = this.chatInput.slice(0, -1);
      this.autocompleteIndex = -1;
      this.invalidate();
      return;
    }
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.chatInput += data;
      this.autocompleteIndex = -1;
      this.invalidate();
    }
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = [];
    this.sidebar.invalidate();
  }

  dispose(): void {}
}
