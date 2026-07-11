export interface TabInfo {
  sessionId: string;
  storyId: string;
  agentRole: string;
}

function shortRole(role: string): string {
  return role.replace("-agent", "");
}

export class TabManager {
  private tabs: TabInfo[] = [];
  private selectedIndex = 0;
  private autoCycling = true;

  getTabs(): TabInfo[] {
    return [...this.tabs];
  }

  getSelectedId(): string | null {
    return this.tabs[this.selectedIndex]?.sessionId ?? null;
  }

  addTab(sessionId: string, storyId: string, agentRole: string): void {
    if (this.tabs.find(t => t.sessionId === sessionId)) return;
    this.tabs.push({ sessionId, storyId, agentRole });
    if (this.tabs.length === 1) {
      this.selectedIndex = 0;
    }
  }

  removeTab(sessionId: string): void {
    const idx = this.tabs.findIndex(t => t.sessionId === sessionId);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);
    if (this.tabs.length === 0) {
      this.selectedIndex = 0;
    } else if (idx <= this.selectedIndex) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    }
  }

  cycleNext(): void {
    if (this.tabs.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.tabs.length;
  }

  cyclePrev(): void {
    if (this.tabs.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.tabs.length) % this.tabs.length;
  }

  isAutoCycling(): boolean {
    return this.autoCycling;
  }

  setAuto(): void {
    this.autoCycling = true;
  }

  setManual(): void {
    this.autoCycling = false;
  }

  onActivity(sessionId: string, important: boolean): void {
    if (!this.autoCycling || !important) return;
    const idx = this.tabs.findIndex(t => t.sessionId === sessionId);
    if (idx !== -1) {
      this.selectedIndex = idx;
    }
  }

  getTabLabel(sessionId: string): string {
    const tab = this.tabs.find(t => t.sessionId === sessionId);
    if (!tab) return "";
    return `${tab.storyId}: ${shortRole(tab.agentRole)}`;
  }
}
