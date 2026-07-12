import type { ForgeEvent } from "../agent/event-adapter";
import { THEME } from "./theme";
import { ScrollBoxRenderable, TextRenderable } from "@opentui/core";

export class ChatView {
  private scrollbox: ScrollBoxRenderable | null = null;
  private lines: string[] = [];
  private currentAgentText = "";
  private currentToolName: string | null = null;

  mount(renderer: any): ScrollBoxRenderable {
    this.scrollbox = new ScrollBoxRenderable(renderer, {
      id: "chat-view",
      flexGrow: 1,
      minHeight: 0,
      stickyScroll: true,
      stickyStart: "bottom",
      contentOptions: { flexDirection: "column", minHeight: 0 },
    });
    renderer.root.add(this.scrollbox);
    this.updateContent();
    return this.scrollbox;
  }

  handleEvent(event: ForgeEvent): void {
    switch (event.type) {
      case "text_delta":
        this.currentAgentText += event.delta;
        break;
      case "message_end":
        this.flushAgentText();
        this.lines.push("");
        break;
      case "tool_start":
        this.flushAgentText();
        this.currentToolName = event.toolName;
        break;
      case "tool_end":
        this.flushAgentText();
        if (event.isError) {
          this.lines.push(`\u2717 ${event.toolName} failed`);
        }
        this.currentToolName = null;
        break;
      case "agent_error":
        this.flushAgentText();
        this.lines.push(`\u2717 ${event.message}`);
        break;
      case "agent_settled":
        break;
    }
    this.updateContent();
  }

  getCurrentToolName(): string | null {
    return this.currentToolName;
  }

  private flushAgentText(): void {
    if (this.currentAgentText.length > 0) {
      this.lines.push(this.currentAgentText);
      this.currentAgentText = "";
    }
  }

  private updateContent(): void {
    if (!this.scrollbox) return;
    const content = this.scrollbox.content;
    while (content.getChildrenCount() > 0) {
      const [first] = content.getChildren();
      if (!first) break;
      content.remove(first);
    }

    const allLines = [...this.lines];
    if (this.currentAgentText) allLines.push(this.currentAgentText);
    if (this.currentToolName) allLines.push(`\u2699 ${this.currentToolName}...`);

    if (allLines.length === 0) {
      const placeholder = new TextRenderable(this.scrollbox.ctx, {
        content: " (waiting for agent output...)",
        fg: THEME.textMuted,
      });
      this.scrollbox.content.add(placeholder);
    } else {
      for (const line of allLines) {
        const text = new TextRenderable(this.scrollbox.ctx, {
          content: line,
          fg: line.startsWith("\u2717") ? THEME.error : THEME.text,
        });
        this.scrollbox.content.add(text);
      }
    }
  }
}
