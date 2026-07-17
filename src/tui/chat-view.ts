import type { ForgeEvent } from "../agent/event-adapter";
import { THEME } from "./theme";
import { ScrollBoxRenderable, TextRenderable, BoxRenderable } from "@opentui/core";
import { Spinner } from "./spinner";

type MessageSource = "user" | "agent" | "system" | "tool_error";

interface ChatMessage {
  text: string;
  source: MessageSource;
}

export class ChatView {
  private scrollbox: ScrollBoxRenderable | null = null;
  private messages: ChatMessage[] = [];
  private currentAgentText = "";
  private currentToolName: string | null = null;
  private isThinking = false;
  private spinner = new Spinner();
  private spinnerText: TextRenderable | null = null;

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

  setThinking(value: boolean): void {
    this.isThinking = value;
    if (value) this.spinner.reset();
    this.updateContent();
  }

  displayMessage(text: string): void {
    this.messages.push({ text, source: "system" });
    this.updateContent();
  }

  displayUserMessage(text: string): void {
    this.messages.push({ text, source: "user" });
    this.updateContent();
  }

  handleEvent(event: ForgeEvent): void {
    switch (event.type) {
      case "text_delta":
        this.isThinking = false;
        this.currentAgentText += event.delta;
        break;
      case "message_end":
        this.flushAgentText();
        this.messages.push({ text: "", source: "system" });
        break;
      case "tool_start":
        this.flushAgentText();
        this.currentToolName = event.toolName;
        break;
      case "tool_end":
        this.flushAgentText();
        if (event.isError) {
          this.messages.push({ text: `\u26a0 ${event.toolName}: failed`, source: "tool_error" });
        }
        this.currentToolName = null;
        break;
      case "agent_error":
        this.flushAgentText();
        this.messages.push({ text: event.message, source: "tool_error" });
        break;
      case "agent_settled":
        this.isThinking = false;
        this.currentToolName = null;
        break;
    }
    this.updateContent();
  }

  getCurrentToolName(): string | null {
    return this.currentToolName;
  }

  getLastAgentMessage(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.source === "agent" && msg.text.trim().length > 0) {
        return msg.text;
      }
    }
    return null;
  }

  private flushAgentText(): void {
    if (this.currentAgentText.length > 0) {
      this.messages.push({ text: this.currentAgentText, source: "agent" });
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

    for (const msg of this.messages) {
      if (msg.text === "" && msg.source === "system") {
        content.add(new TextRenderable(this.scrollbox.ctx, { content: "", fg: THEME.textMuted }));
        continue;
      }
      this.addMessageRow(content, msg);
    }

    if (this.currentAgentText) {
      this.addMessageRow(content, { text: this.currentAgentText, source: "agent" });
    }

    const showSpinner = this.isThinking || this.currentToolName !== null;
    if (showSpinner) {
      const label = this.spinner.getLabel(this.currentToolName);
      this.spinnerText = new TextRenderable(this.scrollbox.ctx, {
        content: label,
        fg: THEME.spinner,
        // `live: true` forces the renderer to continuously re-render this
        // renderable at targetFps (30). Without it, renderAfter only fires
        // during a dirty render pass — which never happens between events,
        // so the spinner freezes on its first frame.
        live: true,
      });
      this.spinnerText.renderAfter = (_buf, dt) => {
        // dt is already in milliseconds (OpenTUI convention — see
        // `deltaSeconds = deltaTime / 1000` in @opentui/core). The previous
        // `dt * 1000` scaled 1000× too fast, landing on the same frame each
        // tick and freezing the visible animation.
        this.spinner.advance(dt);
        this.spinnerText!.content = this.spinner.getLabel(this.currentToolName);
      };
      content.add(this.spinnerText);
    } else {
      this.spinnerText = null;
    }

    if (content.getChildrenCount() === 0) {
      content.add(new TextRenderable(this.scrollbox.ctx, {
        content: " (waiting for agent output...)",
        fg: THEME.textMuted,
      }));
    }
  }

  private addMessageRow(content: any, msg: ChatMessage): void {
    let borderColor: string = THEME.overlay0;
    let bgColor: string = THEME.background;
    let fg: string = THEME.text;

    if (msg.source === "user") {
      borderColor = THEME.peach;
      bgColor = THEME.backgroundElement;
      fg = THEME.text;
    } else if (msg.source === "agent") {
      borderColor = THEME.overlay0;
      bgColor = THEME.surfaceDark;
      fg = THEME.text;
    } else if (msg.source === "tool_error") {
      borderColor = THEME.warning;
      bgColor = THEME.surfaceTool;
      fg = THEME.warning;
    } else if (msg.source === "system") {
      if (msg.text.startsWith("\u26a0")) fg = THEME.warning;
      else if (msg.text.startsWith("\u2713")) fg = THEME.success;
      else if (msg.text.startsWith("\u2717")) fg = THEME.error;
      else fg = THEME.overlay0;
      bgColor = THEME.background;
      borderColor = THEME.overlay0;
    }

    const ctx = this.scrollbox!.ctx;
    const row = new BoxRenderable(ctx, {
      flexDirection: "row",
      width: "100%",
      border: ["left"],
      borderColor,
      backgroundColor: bgColor,
      paddingLeft: 1,
    });
    row.add(new TextRenderable(ctx, {
      content: msg.text,
      fg,
    }));
    content.add(row);
  }
}
