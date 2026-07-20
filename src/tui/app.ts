import { BoxRenderable, TextRenderable, bold as boldText, fg as fgColor, StyledText } from "@opentui/core";
import type { ForgeEvent } from "../agent/event-adapter";
import { ChatView } from "./chat-view";
import { InputBar } from "./input-bar";
import { TabBar } from "./tab-bar";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { SelectOverlay } from "./select-overlay";
import { WorkIndicator } from "./work-indicator";
import { isQuestion, extractSuggestions } from "./question-modal";
import { THEME } from "./theme";
import type { ProjectStateProvider, WorkIndicatorController } from "./interfaces";
import type { Logger } from "../cli/forge-logger";
import type { CommandRegistry } from "../agent/command-registry";

export interface ForgeAppOptions {
  renderer: any;
  engine: ProjectStateProvider;
  sessions: any;
  commands: CommandRegistry;
  mode: "inception" | "development";
}

export class ForgeApp {
  private chatView: ChatView;
  private inputBar: InputBar;
  private tabBar: TabBar;
  private sidebar: Sidebar;
  private statusBar: StatusBar;
  private sidebarBox: BoxRenderable | null = null;
  private leftStatusText: TextRenderable | null = null;
  private rightStatusText: TextRenderable | null = null;
  private workIndicator: WorkIndicator;
  private _debug: ((msg: string) => void) | null = null;
  private _convLog: ((msg: string) => void) | null = null;
  private modelInfo = { agent: "", model: "", provider: "", thinkingLevel: "medium", maxTokens: 16384 };

  constructor(private opts: ForgeAppOptions) {
    this.chatView = new ChatView();
    this.inputBar = new InputBar(opts.commands);
    this.tabBar = new TabBar();
    this.sidebar = new Sidebar();
    this.statusBar = new StatusBar();
    this.workIndicator = new WorkIndicator();
  }

  setDebugLogger(fn: (msg: string) => void): void {
    this._debug = fn;
    this.chatView.setDebugLogger(fn);
  }

  setConversationLogger(fn: (msg: string) => void): void {
    this._convLog = fn;
    this.chatView.setConversationLogger(fn);
  }

  layout(): void {
    const renderer = this.opts.renderer;
    const state = this.opts.engine.getProjectState();
    const sessions = this.opts.engine.getActiveSessions();

    const root = new BoxRenderable(renderer, {
      id: "forge-root",
      flexDirection: "row",
      width: "100%",
      height: "100%",
      flexGrow: 1,
      backgroundColor: THEME.backgroundPanel,
    });

    const mainColumn = new BoxRenderable(renderer, {
      id: "main-column",
      flexDirection: "column",
      flexGrow: 1,
      minHeight: 0,
      // Darkest shade (#080808) so the chat area visually separates from
      // the panel-shade sidebar (#0f0f0f). Without this, the main column
      // is transparent and inherits the root's #0f0f0f — making the
      // sidebar gap invisible.
      backgroundColor: THEME.background,
    });

    if (state.mode === "development") {
      mainColumn.add(this.tabBar.mount(renderer));
    }

    mainColumn.add(this.chatView.mount(renderer));

    // 3-row gap between the chat scrollback and the input bar, matching
    // the OpenCode visual rhythm (chat ↓ gap ↓ input ↓ status).
    const chatInputGap = new BoxRenderable(renderer, {
      id: "chat-input-gap",
      flexShrink: 0,
      height: 3,
    });
    mainColumn.add(chatInputGap);

    mainColumn.add(this.inputBar.mount(renderer));

    // 1-row gap between the input bar and the work indicator.
    const inputStatusGap = new BoxRenderable(renderer, {
      id: "input-status-gap",
      flexShrink: 0,
      height: 1,
    });
    mainColumn.add(inputStatusGap);

    // Work indicator — gear icon + "AI is working" + ESC hint; hidden by
    // default, shown via WorkIndicatorController.setWorking().
    mainColumn.add(this.workIndicator.mount(renderer));

    const statusBarBox = new BoxRenderable(renderer, {
      id: "status-bar",
      flexDirection: "row",
      flexShrink: 0,
      width: "100%",
      paddingLeft: 1,
      paddingTop: 0,
      paddingBottom: 0,
      alignItems: "center",
    });
    this.leftStatusText = new TextRenderable(renderer, {
      content: this.buildLeftStyledText(),
      fg: THEME.textMuted,
    });
    const spacer = new TextRenderable(renderer, {
      content: "",
      flexGrow: 1,
    });
    this.rightStatusText = new TextRenderable(renderer, {
      content: this.buildRightText(),
      fg: THEME.textMuted,
    });
    statusBarBox.add(this.leftStatusText);
    statusBarBox.add(spacer);
    statusBarBox.add(this.rightStatusText);
    mainColumn.add(statusBarBox);

    root.add(mainColumn);

    const sidebarBox = new BoxRenderable(renderer, {
      id: "sidebar",
      width: 34, // 28 → 34 (~1/5 wider)
      height: "100%",
      flexDirection: "column",
      backgroundColor: THEME.backgroundPanel,
    });

    // 2-column spacer between the main column and the sidebar — cleaner
    // separation than a thin border line, matching OpenCode's spacing-based
    // visual rhythm. The gap uses the darkest shade (#080808) so it
    // contrasts with the sidebar's panel shade (#0f0f0f); without an
    // explicit background the gap inherits the root's #0f0f0f and is
    // visually indistinguishable from the sidebar.
    const sidebarGap = new BoxRenderable(renderer, {
      id: "sidebar-gap",
      flexShrink: 0,
      width: 2,
      height: "100%",
      backgroundColor: THEME.background,
    });
    root.add(sidebarGap);
    root.add(sidebarBox);

    this.sidebar.setState(state, sessions);
    for (const line of this.sidebar.getText()) {
      sidebarBox.add(new TextRenderable(renderer, { content: line, fg: THEME.text }));
    }
    this.sidebarBox = sidebarBox;

    renderer.root.add(root);

    // After the initial layout, refresh the sidebar with phase info from
    // the engine (name + agent + total) — the initial setState above used
    // the no-phase-info overload.
    this.refreshSidebar();
  }

  getInputBar(): InputBar {
    return this.inputBar;
  }

  getChatView(): ChatView {
    return this.chatView;
  }

  getTabBar(): TabBar {
    return this.tabBar;
  }

  getSidebar(): Sidebar {
    return this.sidebar;
  }

  getStatusBar(): StatusBar {
    return this.statusBar;
  }

  /**
   * Expose the renderer so command handlers (e.g. /sessions, question modal)
   * can mount overlays — SelectOverlay needs the renderer to add itself to
   * renderer.root and capture keyboard input within the render loop.
   */
  getRenderer(): any {
    return this.opts.renderer;
  }

  getWorkIndicator(): WorkIndicatorController {
    return this.workIndicator;
  }

  setModelInfo(agent: string, model: string, provider: string, thinkingLevel: string, maxTokens: number): void {
    this.modelInfo = { agent, model, provider, thinkingLevel, maxTokens };
  }

  private onQuestionCallback: ((text: string) => void) | null = null;

  setOnQuestion(callback: (text: string) => void): void {
    this.onQuestionCallback = callback;
  }

  /**
   * Show the question modal overlay for a detected agent question.
   * Extracts suggestions from the agent text, mounts a `SelectOverlay`,
   * and on selection either focuses the input bar (for "Write your own
   * answer") or pre-fills it with the chosen suggestion.
   *
   * Wrapped in try/catch/finally so ANY error (extractSuggestions,
   * SelectOverlay creation, showAsPromise) is logged and focus is
   * ALWAYS restored to the input bar. Without this, an error in the
   * callback leaves the TUI in a broken state (chat clears, /sessions
   * stops working, focus trapped in a partially-created overlay).
   *
   * This method was moved from `bin/forge.ts` so the TUI logic lives in
   * the TUI layer — `bin/forge.ts` just calls
   * `app.setOnQuestion((text) => app.showQuestionModal(text, logger))`.
   */
  async showQuestionModal(agentText: string, logger: Logger): Promise<void> {
    let overlay: SelectOverlay | null = null;
    try {
      const suggestions = extractSuggestions(agentText);
      this.getChatView().displayMessage("\u2753 Question detected — select an answer:");
      overlay = new SelectOverlay(this.getRenderer(), {
        title: "Your answer:",
        options: suggestions.map(s => ({ name: s, description: "", value: s })),
      });
      const answer = await overlay.showAsPromise();
      if (answer === "Write your own answer") {
        this.getInputBar().focus();
      } else {
        this.getInputBar().setInput(answer);
        this.getInputBar().focus();
      }
    } catch (err) {
      // User pressed ESC (showAsPromise rejects with "SelectOverlay
      // cancelled") OR an error occurred during overlay creation /
      // suggestions extraction. Either way, log the error and cancel the
      // overlay if it was created.
      if (err instanceof Error && err.message !== "SelectOverlay cancelled") {
        logger.error(`question modal failed: ${(err as Error).message}`, err as Error);
      }
      try { overlay?.cancel(); } catch {}
    } finally {
      // ALWAYS restore focus to the input bar — even if the overlay
      // was never created or was partially created.
      this.getInputBar().focus();
    }
  }

  /**
   * Update context usage from the SDK's `getContextUsage()` and refresh the
   * rendered right-aligned status segment. Called by the polling interval
   * started in bin/forge.ts after `sessions.createSession()`.
   */
  updateContextUsage(tokens: number, contextWindow: number, percent: number): void {
    this.statusBar.setContext(tokens, contextWindow, percent);
    if (this.rightStatusText) {
      this.rightStatusText.content = this.buildRightText();
    }
  }

  private buildRightText(): string {
    const chunks = this.statusBar.getRightChunks();
    return chunks.map(c => c.text).join("");
  }

  /**
   * Build a StyledText for the left status segment from `StatusBar.getLeftChunks()`.
   * Each chunk carries its own `fg` + `bold` attributes, applied via the
   * `bold()` and `fg()` helpers from @opentui/core. This replaces the prior
   * use of `getPlainText()` which included tokens/max/pct/mode — that info
   * belongs only on the right side (see `buildRightText()`).
   */
  private buildLeftStyledText(): StyledText | string {
    const chunks = this.statusBar.getLeftChunks();
    // Empty state: single muted chunk with no bold — return plain string
    // (the TextRenderable's `fg` default applies THEME.textMuted).
    if (chunks.length === 1 && !chunks[0].bold) {
      return chunks[0].text;
    }
    // Build TextChunk[] via the bold/fg helpers, then wrap in StyledText.
    const textChunks: any[] = [];
    for (const chunk of chunks) {
      let s: any = chunk.text;
      if (chunk.fg) s = fgColor(chunk.fg)(s);
      if (chunk.bold) s = boldText(s);
      textChunks.push(s);
    }
    return new StyledText(textChunks);
  }

  /**
   * Push the current `modelInfo` into `StatusBar` and refresh both rendered
   * status segments. Used:
   *   - by `handleForgeEvent` on `agent_settled` (live turn finished)
   *   - by the `/sessions` resume flow after `setModelInfo()` so the bar
   *     shows the resumed session's model immediately, without waiting for
   *     the first agent turn to fire `agent_settled`.
   *
   * Does NOT trigger the question-modal check (unlike `handleForgeEvent`'s
   * `agent_settled` branch), because resume doesn't imply a fresh question.
   */
  refreshStatusBar(): void {
    const state = this.opts.engine.getProjectState();
    this.statusBar.setInfo(
      this.modelInfo.agent,
      this.modelInfo.model,
      this.modelInfo.provider,
      this.modelInfo.thinkingLevel,
      0,
      this.modelInfo.maxTokens,
      state.mode,
    );
    if (this.leftStatusText) {
      this.leftStatusText.content = this.buildLeftStyledText();
    }
    if (this.rightStatusText) {
      this.rightStatusText.content = this.buildRightText();
    }
  }

  /**
   * Re-render the sidebar with the current project state + active sessions
   * + phase info. Used:
   *   - by `handleEngineEvent` on any engine event
   *   - by the `/sessions` resume flow after `engine.markInceptionPhaseStarted()`
   *     so the sidebar reflects the resumed phase immediately.
   *
   * Resolves the optional phase name / agent / total from the engine when
   * available (via `getInceptionPhaseInfo()`), replacing the prior behavior
   * of always passing `undefined` for these args.
   */
  refreshSidebar(): void {
    const state = this.opts.engine.getProjectState();
    const sessions = this.opts.engine.getActiveSessions();
    const phaseInfo = (this.opts.engine as any).getInceptionPhaseInfo?.();
    this.sidebar.setState(
      state,
      sessions,
      phaseInfo?.name,
      phaseInfo?.agent,
      phaseInfo?.total,
    );

    if (this.sidebarBox) {
      const oldChildren = [...this.sidebarBox.getChildren()];
      for (const child of oldChildren) {
        child.destroyRecursively();
      }
      for (const line of this.sidebar.getText()) {
        this.sidebarBox.add(
          new TextRenderable(this.opts.renderer, { content: line, fg: THEME.text }),
        );
      }
    }
  }

  handleForgeEvent(event: ForgeEvent): void {
    this._debug?.(`handleForgeEvent: IN type=${event.type} chatMsgCount=${this.chatView.getMessageCount()}`);
    this.chatView.handleEvent(event);
    this._debug?.(`handleForgeEvent: after chatView.handleEvent messages=${this.chatView.getMessageCount()}`);
    if (event.type === "agent_settled") {
      this.workIndicator.setWorking(false);
      this.refreshStatusBar();
      const lastAgentMsg = this.chatView.getLastAgentMessage();
      this._debug?.(`handleForgeEvent: agent_settled lastAgentMsg=${lastAgentMsg?.slice(0, 80) ?? "null"} hasCallback=${!!this.onQuestionCallback}`);
      if (lastAgentMsg && this.onQuestionCallback) {
        import("./question-modal").then(({ isQuestion }) => {
          if (isQuestion(lastAgentMsg)) {
            this.onQuestionCallback!(lastAgentMsg);
          }
        }).catch((err) => {
          console.error(`[forge] question modal check failed: ${(err as Error).message}`);
        });
      }
    } else if (event.type === "agent_error") {
      this._debug?.(`handleForgeEvent: agent_error message=${event.message}`);
      this.workIndicator.setWorking(false);
    } else if (event.type === "tool_start") {
      this._debug?.(`handleForgeEvent: tool_start toolName=${event.toolName}`);
      this.workIndicator.setWorking(true, event.toolName);
    } else if (event.type === "tool_end") {
      this._debug?.(`handleForgeEvent: tool_end toolName=${event.toolName} isError=${event.isError}`);
    }
  }

  handleEngineEvent(_event: any): void {
    try {
      this.refreshSidebar();
    } catch (err) {
      // Catch errors from refreshSidebar (e.g. engine.getActiveSessions
      // throws) so they don't propagate to the caller (the events.subscribe
      // callback in bin/forge.ts). Without this, a throwing engine method
      // would crash the event loop and leave the TUI frozen.
      // eslint-disable-next-line no-console
      console.error(`[forge] handleEngineEvent failed: ${(err as Error).message}`);
    }
  }
}
