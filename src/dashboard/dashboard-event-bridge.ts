import type { Sidebar, AgentPanel } from "./split-layout";
import type { EngineEvent } from "../engine/events";
import type { AgentRole, WorkflowState } from "../engine/types";

interface TrackedSession {
  sessionId: string;
  storyId: string;
  agentRole: AgentRole;
  isBusy: boolean;
  startTime: number;
}

export class DashboardEventBridge {
  private sessions = new Map<string, TrackedSession>();

  constructor(
    public sidebar: Sidebar,
    public agentPanel: AgentPanel,
  ) {}

  handle(event: EngineEvent): void {
    switch (event.type) {
      case "session_created": {
        this.sessions.set(event.sessionId, {
          sessionId: event.sessionId,
          storyId: event.storyId,
          agentRole: event.agentRole,
          isBusy: true,
          startTime: Date.now(),
        });
        this.agentPanel.setActiveSession(event.sessionId);
        this.syncSidebar();
        break;
      }
      case "session_settled": {
        const s = this.sessions.get(event.sessionId);
        if (s) s.isBusy = false;
        this.syncSidebar();
        break;
      }
      case "session_error": {
        this.sidebar.setGuardianStatus(`ERROR: ${"error" in event ? event.error : "unknown"}`);
        this.syncSidebar();
        break;
      }
      case "output": {
        if ("delta" in event && event.delta) {
          this.agentPanel.pushOutput(event.delta);
        }
        break;
      }
      case "story_claimed":
      case "transition": {
        const storyId = event.type === "transition" ? event.transition.storyId : event.storyId;
        const fromState: WorkflowState = event.type === "transition" ? event.transition.fromState : "ready-for-dev";
        const toState: WorkflowState = event.type === "transition" ? event.transition.toState : "in-dev";
        const agentRole: AgentRole = event.type === "transition" ? event.transition.agentRole : event.agentRole;
        const reason = event.type === "transition" ? event.transition.reason : "story claimed";
        this.sidebar.setTransitions([{
          timestamp: new Date().toISOString(),
          storyId,
          fromState,
          toState,
          agentRole,
          reason,
        }]);
        this.syncSidebar();
        break;
      }
      case "story_halted": {
        this.sidebar.setGuardianStatus(`HALT: ${event.reason}`);
        this.syncSidebar();
        break;
      }
      case "phase_started": {
        this.agentPanel.pushOutput(`Inception phase ${event.phase}: ${event.name}`);
        break;
      }
      case "phase_completed": {
        this.agentPanel.pushOutput(`Phase ${event.phase} completed`);
        break;
      }
    }
  }

  private syncSidebar(): void {
    const sessionList = Array.from(this.sessions.values()).map(s => ({
      sessionId: s.sessionId,
      storyId: s.storyId,
      agentRole: s.agentRole,
      isBusy: s.isBusy,
      elapsedTime: Math.floor((Date.now() - s.startTime) / 1000),
    }));
    this.sidebar.setSessions(sessionList);
  }
}
