import type { DashboardComponent } from "../engine/interfaces";
import type { EngineEvent } from "../engine/events";
import type { SplitLayout } from "./split-layout";
import type { AgentPanel } from "./split-layout";
import type { DashboardEventBridge } from "./dashboard-event-bridge";

export class ForgeLayout implements DashboardComponent {
  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private stopped = false;

  constructor(
    private splitLayout: SplitLayout,
    private eventBridge: DashboardEventBridge,
    private agentPanel: AgentPanel,
  ) {}

  render(width: number): string[] {
    return this.splitLayout.render(width);
  }

  handleInput(data: string): void {
    if (data === "\x1b[Z") {
      this.paused = !this.paused;
      if (this.paused) {
        this.agentPanel.cyclePause();
      } else {
        this.agentPanel.cycleResume();
      }
      return;
    }
    this.splitLayout.handleInput(data);
  }

  invalidate(): void {
    this.splitLayout.invalidate();
  }

  handleEngineEvent(event: EngineEvent): void {
    this.eventBridge.handle(event);
  }

  startCycling(intervalMs: number = 5000): void {
    if (this.cycleTimer) return;
    this.stopped = false;
    this.cycleTimer = setInterval(() => {
      if (!this.paused) {
        this.agentPanel.cycleNext();
      }
    }, intervalMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
  }

  isCyclingPaused(): boolean {
    return this.paused;
  }

  isCyclingStopped(): boolean {
    return this.stopped;
  }
}
