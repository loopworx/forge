import type { SessionEvent } from "../engine/interfaces";

const MAX_LINES = 500;

export class AgentConversationBuffer {
  private lines: string[] = [];
  private currentAgentText = "";
  private important = false;

  constructor(public readonly sessionId: string) {}

  handleEvent(event: SessionEvent): void {
    switch (event.type) {
      case "text_delta":
        this.currentAgentText += event.delta ?? "";
        break;
      case "message_end":
        this.flushAgentText();
        this.lines.push("");
        this.trim();
        break;
      case "tool_call":
        this.flushAgentText();
        this.lines.push(`[tool] ${event.toolName ?? "unknown"}`);
        this.important = true;
        this.trim();
        break;
      case "tool_result":
        this.flushAgentText();
        if (event.isError) {
          this.lines.push(`[result] ERROR`);
        } else {
          this.lines.push(`[result] ${event.toolName ?? "ok"}`);
        }
        this.important = true;
        this.trim();
        break;
      case "agent_error":
        this.flushAgentText();
        this.lines.push(`[ERROR] agent error`);
        this.important = true;
        this.trim();
        break;
      case "agent_started":
      case "agent_settled":
      case "compaction":
        break;
    }
  }

  getLines(): string[] {
    this.flushAgentText();
    return [...this.lines];
  }

  hasImportantActivity(): boolean {
    return this.important;
  }

  clearImportantActivity(): void {
    this.important = false;
  }

  clear(): void {
    this.lines = [];
    this.currentAgentText = "";
    this.important = false;
  }

  private flushAgentText(): void {
    if (this.currentAgentText.length > 0) {
      this.lines.push(`agent: ${this.currentAgentText}`);
      this.currentAgentText = "";
      this.trim();
    }
  }

  private trim(): void {
    if (this.lines.length > MAX_LINES) {
      this.lines = this.lines.slice(this.lines.length - MAX_LINES);
    }
  }
}
