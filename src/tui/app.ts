import { BoxRenderable, TextRenderable } from "@opentui/core";
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
    mainColumn.add(this.inputBar.mount(renderer));

    const statusText = new TextRenderable(renderer, {
      content: this.statusBar.getText(),
      fg: THEME.textMuted,
    });
    mainColumn.add(statusText);

    root.add(mainColumn);

    const sidebarBox = new BoxRenderable(renderer, {
      id: "sidebar",
      width: 28,
      height: "100%",
      flexDirection: "column",
      backgroundColor: THEME.backgroundPanel,
      border: ["left"],
      borderColor: THEME.border,
    });

    this.sidebar.setState(state, sessions);
    for (const line of this.sidebar.getText()) {
      sidebarBox.add(new TextRenderable(renderer, { content: line, fg: THEME.text }));
    }
    this.sidebarBox = sidebarBox;
    root.add(sidebarBox);

    renderer.root.add(root);
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

  handleForgeEvent(event: ForgeEvent): void {
    this.chatView.handleEvent(event);
    if (event.type === "agent_settled") {
      const state = this.opts.engine.getProjectState();
      this.statusBar.setInfo(
        "agent",
        "model",
        "provider",
        "high",
        0,
        1000000,
        state.mode,
      );
    }
  }

  handleEngineEvent(_event: any): void {
    const state = this.opts.engine.getProjectState();
    this.sidebar.setState(state, this.opts.engine.getActiveSessions());

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
}
