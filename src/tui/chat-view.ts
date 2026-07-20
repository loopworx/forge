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
  private _debug: ((msg: string) => void) | null = null;
  private _convLog: ((msg: string) => void) | null = null;

  setDebugLogger(fn: (msg: string) => void): void {
    this._debug = fn;
  }

  setConversationLogger(fn: (msg: string) => void): void {
    this._convLog = fn;
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Format the full conversation state as a multi-line string for diagnostics.
   * Called before updateContent clears children and in the error catch block.
   */
  private dumpConversationState(): string {
    const lines: string[] = [];
    lines.push("--- Conversation State ---");
    for (let i = 0; i < this.messages.length; i++) {
      const m = this.messages[i];
      const text = m.text.length > 120 ? m.text.slice(0, 117) + "..." : m.text;
      lines.push(`  [${i}] source=${m.source} text="${text}" (${m.text.length} chars)`);
    }
    if (this.currentAgentText) {
      const t = this.currentAgentText.length > 120 ? this.currentAgentText.slice(0, 117) + "..." : this.currentAgentText;
      lines.push(`  pendingAgentText="${t}" (${this.currentAgentText.length} chars)`);
    }
    lines.push(`  isThinking=${this.isThinking} currentToolName=${this.currentToolName}`);
    lines.push("--- End Conversation State ---");
    return lines.join("\n");
  }
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
  private static readonly MIN_UPDATE_MS = 50;
  private _lastUpdateTime = 0;
  private _pendingUpdate = false;

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
    this._debug?.(`handleEvent: IN type=${event.type} messages=${this.messages.length} pendingLen=${this.currentAgentText.length} isThinking=${this.isThinking}`);
    const isTextDelta = event.type === "text_delta";
    switch (event.type) {
      case "text_delta": {
        this.isThinking = false;
        this.stopSpinnerInterval();
        this.currentAgentText += event.delta;
        this._convLog?.(`handleEvent text_delta delta="${event.delta.length > 80 ? event.delta.slice(0, 77) + "..." : event.delta}"`);
        break;
      }
      case "message_end":
        this.flushAgentText();
        this.messages.push({ text: "", source: "system" });
        this._convLog?.(`handleEvent message_end role=${event.role}`);
        break;
      case "tool_start": {
        this.flushAgentText();
        this.currentToolName = event.toolName;
        this.startSpinnerInterval();
        this._convLog?.(`handleEvent tool_start toolName=${event.toolName}`);
        break;
      }
      case "tool_end": {
        this.flushAgentText();
        this.stopSpinnerInterval();
        if (event.isError) {
          this.messages.push({ text: `\u26a0 ${event.toolName}: failed`, source: "tool_error" });
        }
        this.currentToolName = null;
        this._convLog?.(`handleEvent tool_end toolName=${event.toolName} isError=${event.isError}`);
        break;
      }
      case "agent_error":
        this.flushAgentText();
        this.stopSpinnerInterval();
        this.messages.push({ text: event.message, source: "tool_error" });
        this._convLog?.(`handleEvent agent_error message="${event.message.length > 200 ? event.message.slice(0, 197) + "..." : event.message}"`);
        break;
      case "agent_settled":
        this.isThinking = false;
        this.currentToolName = null;
        this.stopSpinnerInterval();
        this._convLog?.("handleEvent agent_settled");
        break;
    }
    this._debug?.(`handleEvent: OUT messages=${this.messages.length} isThinking=${this.isThinking} pendingLen=${this.currentAgentText.length}`);
    if (isTextDelta) {
      this.debouncedUpdate();
    } else {
      this.updateContent();
    }
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

  /**
   * Debounced version of updateContent. During fast agent streaming, text_delta
   * events can arrive at 50-100 calls/second. Each calls updateContent() which
   * destroys and recreates ~N*2 renderables (BoxRenderable + TextRenderable
   * per message). Rapid create/destroy cycles exhaust OpenTUI's internal
   * TextBuffer pool, causing "Failed to create TextBuffer" errors.
   *
   * This method debounces those calls: the immediate call is throttled, but a
   * final deferred call is scheduled via setImmediate to capture the latest
   * state. Only the text_delta case uses this — all other event types and
   * direct API calls updateContent() synchronously.
   */
  private debouncedUpdate(): void {
    const now = performance.now();
    if (now - this._lastUpdateTime < ChatView.MIN_UPDATE_MS) {
      if (!this._pendingUpdate) {
        this._pendingUpdate = true;
        this._convLog?.("debouncedUpdate: throttled — scheduling deferred update");
        setImmediate(() => {
          this._pendingUpdate = false;
          this._lastUpdateTime = 0;
          this._convLog?.("debouncedUpdate: deferred update firing");
          this.updateContent();
        });
      } else {
        this._convLog?.("debouncedUpdate: already pending — skipping");
      }
      return;
    }
    this._lastUpdateTime = now;
    this._convLog?.("debouncedUpdate: direct update");
    this.updateContent();
  }

  private updateContent(): void {
    // Remove the throttle — keep updateContent direct for all callers
    if (!this.scrollbox) return;
    const content = this.scrollbox.content;
    this._debug?.(`updateContent: START messages=${this.messages.length} scrollboxChildren=${content.getChildrenCount()}`);
    this._convLog?.(`updateContent: START messages=${this.messages.length} scrollboxChildren=${content.getChildrenCount()} pendingLen=${this.currentAgentText.length}`);
    this._convLog?.(this.dumpConversationState());
    // Phase 1: destroy all existing children, freeing native resources.
    // Must use destroyRecursively() instead of content.remove() — remove()
    // only unlinks from the layout tree but does NOT call destroy(), so
    // the child TextBufferRenderable's TextBuffer and TextBufferView native
    // resources leak. After many updateContent cycles the Zig allocator
    // pool exhausts and TextBufferView creation fails.
    this.spinnerText = null;
    const oldChildren = [...content.getChildren()];
    for (const child of oldChildren) {
      child.destroyRecursively();
    }
    this._debug?.(`updateContent: after clear children=${content.getChildrenCount()}`);
    this._convLog?.(`updateContent: after clear children=${content.getChildrenCount()}`);

    // Phase 2: re-add all messages + spinner. Wrapped in try/catch so
    // that if a renderable constructor or content.add throws mid-re-add,
    // the chat is not left empty (which was the root cause of issue 3:
    // the user saw a blank chat and /sessions stopped working). The catch
    // block adds an error row so the user sees something went wrong, and
    // the next updateContent call can recover normally.
    let addCount = 0;
    let failMsgIndex = -1;
    let failMsgText = "";
    try {
      for (let i = 0; i < this.messages.length; i++) {
        const msg = this.messages[i];
        this._convLog?.(`  re-add msg[${i}] source=${msg.source} text="${msg.text.slice(0, 60)}" (${msg.text.length} chars)`);
        if (msg.text === "" && msg.source === "system") {
          content.add(new TextRenderable(this.scrollbox.ctx, { content: "", fg: THEME.textMuted }));
          addCount++;
          continue;
        }
        failMsgIndex = i;
        failMsgText = msg.text;
        this.addMessageRow(content, msg);
        addCount++;
      }

      if (this.currentAgentText) {
        this._convLog?.(`  re-add currentAgentText "${this.currentAgentText.slice(0, 60)}" (${this.currentAgentText.length} chars)`);
        failMsgIndex = this.messages.length;
        failMsgText = this.currentAgentText;
        this.addMessageRow(content, { text: this.currentAgentText, source: "agent" });
        addCount++;
      }

      const showSpinner = this.isThinking || this.currentToolName !== null;
      if (showSpinner) {
        const label = this.spinner.getLabel(this.currentToolName);
        this.spinnerText = new TextRenderable(this.scrollbox.ctx, {
          content: label,
          fg: THEME.spinner,
          live: true,
        });
        this.spinnerText.renderAfter = (_buf, dt) => {
          this.spinner.advance(dt);
          this.spinnerText!.content = this.spinner.getLabel(this.currentToolName);
        };
        content.add(this.spinnerText);
        addCount++;
      } else {
        this.spinnerText = null;
      }

      if (content.getChildrenCount() === 0) {
        content.add(new TextRenderable(this.scrollbox.ctx, {
          content: " (waiting for agent output...)",
          fg: THEME.textMuted,
        }));
        addCount++;
      }
      this._debug?.(`updateContent: re-added ${addCount} items, children=${content.getChildrenCount()}`);
      this._convLog?.(`updateContent: re-added ${addCount} items, children=${content.getChildrenCount()}`);
    } catch (err) {
      this._debug?.(`updateContent: ERROR in Phase 2: ${(err as Error).message}`);
      this._convLog?.(`updateContent: ERROR in Phase 2: ${(err as Error).message}`);
      this._convLog?.(`updateContent: failMsgIndex=${failMsgIndex} failMsgText="${failMsgText.slice(0, 200)}"`);
      this._convLog?.(`updateContent: stack=${(err as Error).stack ?? "(no stack)"}`);
      this._convLog?.(`updateContent: CONVERSATION AT FAILURE:\n${this.dumpConversationState()}`);
      // Re-add phase failed — the chat has been cleared (phase 1) but
      // only partially repopulated. Add an error row so the user sees
      // something went wrong instead of a blank chat. The next
      // updateContent call will try again and can recover.
      try {
        this.spinnerText = null;
        content.add(new TextRenderable(this.scrollbox.ctx, {
          content: `\u26a0 Render error: ${(err as Error).message}`,
          fg: THEME.warning,
        }));
      } catch (err2) {
        // eslint-disable-next-line no-console
        console.error(`[forge] updateContent unrecoverable error: ${(err2 as Error).message}`);
      }
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
    this._convLog?.(`  addMessageRow: creating BoxRenderable + TextRenderable fg=${fg} text="${msg.text.slice(0, 60)}"`);
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
