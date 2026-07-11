import type { SessionEvent } from "../engine/interfaces";

const MAX_LINES = 500;

export class AgentConversationBuffer {
  private lines: string[] = [];
  private currentAgentText = "";
  private currentToolName: string | null = null;
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
        this.currentToolName = event.toolName ?? "unknown";
        this.important = true;
        break;
      case "tool_result":
        this.flushAgentText();
        if (event.isError) {
          this.lines.push(`\u2717 ${event.toolName ?? "unknown"} failed`);
          this.trim();
        }
        this.currentToolName = null;
        this.important = true;
        break;
      case "agent_error":
        this.flushAgentText();
        this.lines.push(`\u2717 agent error`);
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

  getCurrentToolName(): string | null {
    return this.currentToolName;
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
    this.currentToolName = null;
    this.important = false;
  }

  addUserMessage(text: string): void {
    this.flushAgentText();
    this.lines.push(`> ${text}`);
    this.trim();
  }

  private flushAgentText(): void {
    if (this.currentAgentText.length > 0) {
      this.lines.push(this.currentAgentText);
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
