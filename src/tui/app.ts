import { BoxRenderable, TextRenderable, bold as boldText, fg as fgColor, StyledText } from "@opentui/core";
import type { ForgeEvent } from "../agent/event-adapter";
import { ChatView } from "./chat-view";
import { InputBar } from "./input-bar";
import { TabBar } from "./tab-bar";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { THEME } from "./theme";
import type { WorkflowEngine } from "../engine/workflow-engine";
import type { AgentSessionManager } from "../agent/session-manager";
import type { CommandRegistry } from "../agent/command-registry";

export interface ForgeAppOptions {
  renderer: any;
  engine: WorkflowEngine;
  sessions: AgentSessionManager;
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
  private modelInfo = { agent: "", model: "", provider: "", thinkingLevel: "medium", maxTokens: 16384 };

  constructor(private opts: ForgeAppOptions) {
    this.chatView = new ChatView();
    this.inputBar = new InputBar(opts.commands);
    this.tabBar = new TabBar();
    this.sidebar = new Sidebar();
    this.statusBar = new StatusBar();
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

    // 1-row gap between the input bar and the status bar.
    const inputStatusGap = new BoxRenderable(renderer, {
      id: "input-status-gap",
      flexShrink: 0,
      height: 1,
    });
    mainColumn.add(inputStatusGap);

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
    // visual rhythm.
    const sidebarGap = new BoxRenderable(renderer, {
      id: "sidebar-gap",
      flexShrink: 0,
      width: 2,
      height: "100%",
    });
    root.add(mainColumn);
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

  setModelInfo(agent: string, model: string, provider: string, thinkingLevel: string, maxTokens: number): void {
    this.modelInfo = { agent, model, provider, thinkingLevel, maxTokens };
  }

  private onQuestionCallback: ((text: string) => void) | null = null;

  setOnQuestion(callback: (text: string) => void): void {
    this.onQuestionCallback = callback;
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
      while (this.sidebarBox.getChildrenCount() > 0) {
        const [first] = this.sidebarBox.getChildren();
        if (!first) break;
        this.sidebarBox.remove(first);
      }
      for (const line of this.sidebar.getText()) {
        this.sidebarBox.add(
          new TextRenderable(this.opts.renderer, { content: line, fg: THEME.text }),
        );
      }
    }
  }

  handleForgeEvent(event: ForgeEvent): void {
    this.chatView.handleEvent(event);
    if (event.type === "agent_settled") {
      this.refreshStatusBar();
      const lastAgentMsg = this.chatView.getLastAgentMessage();
      if (lastAgentMsg && this.onQuestionCallback) {
        import("./question-modal").then(({ isQuestion }) => {
          if (isQuestion(lastAgentMsg)) {
            this.onQuestionCallback!(lastAgentMsg);
          }
        });
      }
    }
  }

  handleEngineEvent(_event: any): void {
    this.refreshSidebar();
  }
}
