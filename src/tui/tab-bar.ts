import { BoxRenderable, TextRenderable } from "@opentui/core";
import { THEME } from "./theme";

interface Tab {
  sessionId: string;
  label: string;
}

export class TabBar {
  private container: BoxRenderable | null = null;
  private tabs: Tab[] = [];
  private selectedId: string | null = null;
  private autoCycling = true;

  mount(renderer: any): BoxRenderable {
    this.container = new BoxRenderable(renderer, {
      id: "tab-bar",
      flexDirection: "row",
      flexShrink: 0,
      gap: 2,
    });
    renderer.root.add(this.container);
    this.renderTabs();
    return this.container;
  }

  setTabs(tabs: Tab[]): void {
    this.tabs = tabs;
    if (this.selectedId && !tabs.find((t) => t.sessionId === this.selectedId)) {
      this.selectedId = tabs.length > 0 ? tabs[0].sessionId : null;
    } else if (!this.selectedId && tabs.length > 0) {
      this.selectedId = tabs[0].sessionId;
    }
    this.renderTabs();
  }

  setSelected(id: string): void {
    this.selectedId = id;
    this.renderTabs();
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  setAutoCycling(auto: boolean): void {
    this.autoCycling = auto;
    this.renderTabs();
  }

  cycleNext(): void {
    if (this.tabs.length === 0) return;
    const idx = this.tabs.findIndex((t) => t.sessionId === this.selectedId);
    const next = (idx + 1) % this.tabs.length;
    this.selectedId = this.tabs[next].sessionId;
    this.renderTabs();
  }

  cyclePrev(): void {
    if (this.tabs.length === 0) return;
    const idx = this.tabs.findIndex((t) => t.sessionId === this.selectedId);
    const prev = (idx - 1 + this.tabs.length) % this.tabs.length;
    this.selectedId = this.tabs[prev].sessionId;
    this.renderTabs();
  }

  private renderTabs(): void {
    if (!this.container) return;
    while (this.container.getChildrenCount() > 0) {
      const [first] = this.container.getChildren();
      if (!first) break;
      this.container.remove(first);
    }

    for (const tab of this.tabs) {
      const isSelected = tab.sessionId === this.selectedId;
      const marker = isSelected ? "*" : " ";
      const text = new TextRenderable(this.container.ctx, {
        content: `${marker}${tab.label}`,
        fg: isSelected ? THEME.text : THEME.textMuted,
      });
      this.container.add(text);
    }

    const modeLabel = this.autoCycling ? "(auto)" : "(manual)";
    const mode = new TextRenderable(this.container.ctx, {
      content: `  ${modeLabel}`,
      fg: THEME.textMuted,
    });
    this.container.add(mode);
  }
}
