import type { TabManager } from "./tab-manager";

function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  return text.slice(0, width - 3) + "...";
}

export class ForgeTabBarComponent {
  private cachedWidth: number | undefined;
  private cachedLines: string[] = [];

  constructor(private tabManager: TabManager) {}

  render(width: number): string[] {
    if (this.cachedWidth === width && this.cachedLines.length > 0) {
      return this.cachedLines;
    }

    const tabs = this.tabManager.getTabs();
    if (tabs.length === 0) {
      this.cachedWidth = width;
      this.cachedLines = [];
      return [];
    }

    const selectedId = this.tabManager.getSelectedId();
    const modeLabel = this.tabManager.isAutoCycling() ? "(auto)" : "(manual)";

    const parts: string[] = [];
    for (const tab of tabs) {
      const label = this.tabManager.getTabLabel(tab.sessionId);
      const isSelected = tab.sessionId === selectedId;
      const marker = isSelected ? "*" : " ";
      parts.push(`${marker}${label}`);
    }

    const line = `${parts.join("  ")}  ${modeLabel}`;
    this.cachedWidth = width;
    this.cachedLines = [truncate(line, width)];
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = [];
  }
}
