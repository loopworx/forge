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
  /**
   * Interval that drives the spinner animation. Started on `setThinking(true)`
   * and on `tool_start`; stopped on `setThinking(false)`, `tool_end`,
   * `agent_settled`, `agent_error`, and `dispose()`.
   *
   * The `live: true` + `renderAfter` mechanism on `spinnerText` is fragile
   * through the ScrollBox content→viewport→wrapper hierarchy: when the
   * spinner is scrolled out of the viewport (or the viewport culling
   * filter excludes it), `renderAfter` is not called and the spinner
   * freezes on frame 0. A `setInterval` that advances the spinner and
   * reassigns `spinnerText.content` is immune to viewport culling — the
   * content setter calls `requestRender()` which schedules a fresh
   * render pass regardless of culling.
   */
  private spinnerInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly SPINNER_INTERVAL_MS = 80;

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
    if (value) {
      this.spinner.reset();
      this.startSpinnerInterval();
    } else {
      this.stopSpinnerInterval();
    }
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
        this.stopSpinnerInterval();
        this.currentAgentText += event.delta;
        break;
      case "message_end":
        this.flushAgentText();
        this.messages.push({ text: "", source: "system" });
        break;
      case "tool_start":
        this.flushAgentText();
        this.currentToolName = event.toolName;
        this.startSpinnerInterval();
        break;
      case "tool_end":
        this.flushAgentText();
        this.stopSpinnerInterval();
        if (event.isError) {
          this.messages.push({ text: `\u26a0 ${event.toolName}: failed`, source: "tool_error" });
        }
        this.currentToolName = null;
        break;
      case "agent_error":
        this.flushAgentText();
        this.stopSpinnerInterval();
        this.messages.push({ text: event.message, source: "tool_error" });
        break;
      case "agent_settled":
        this.isThinking = false;
        this.currentToolName = null;
        this.stopSpinnerInterval();
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

  /**
   * Start a `setInterval` that advances the spinner and updates the
   * `spinnerText.content` every `SPINNER_INTERVAL_MS` (80ms). The interval
   * is the primary animation driver — it is immune to the ScrollBox
   * viewport culling that can silently skip `renderAfter` callbacks when
   * the spinner is scrolled out of view. The content setter triggers
   * `requestRender()` on the renderable, which schedules a fresh render
   * pass regardless of culling.
   *
   * Idempotent: no-op if an interval is already running.
   */
  private startSpinnerInterval(): void {
    if (this.spinnerInterval !== null) return;
    this.spinnerInterval = setInterval(() => {
      this.spinner.advance(ChatView.SPINNER_INTERVAL_MS);
      if (this.spinnerText) {
        this.spinnerText.content = this.spinner.getLabel(this.currentToolName);
      }
    }, ChatView.SPINNER_INTERVAL_MS);
  }

  /**
   * Clear the spinner interval if running. Idempotent.
   */
  private stopSpinnerInterval(): void {
    if (this.spinnerInterval !== null) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
  }

  /**
   * Stop the spinner interval and release resources. Called by the
   * `/exit` command and on renderer destroy to prevent the interval
   * from firing after the TUI is torn down.
   */
  dispose(): void {
    this.stopSpinnerInterval();
  }
}
