import type { Persistence, Clock } from "./interfaces";
import type { AgentSessionMeta, WorkflowState, AgentRole } from "./types";

const SESSIONS_KEY = "sessions";

export class SessionTracker {
  private sessions: Map<string, AgentSessionMeta>;

  constructor(
    private persistence: Persistence,
    private clock: Clock,
  ) {
    this.sessions = new Map();
    this.load();
  }

  private load(): void {
    const data = this.persistence.read<AgentSessionMeta[]>(SESSIONS_KEY);
    if (data) {
      for (const meta of data) {
        this.sessions.set(meta.sessionId, meta);
      }
    }
  }

  private save(): void {
    this.persistence.write(SESSIONS_KEY, Array.from(this.sessions.values()));
  }

  track(
    sessionId: string,
    storyId: string,
    agentRole: AgentRole,
    workflowState: WorkflowState,
    isRecovery: boolean = false,
  ): void {
    const meta: AgentSessionMeta = {
      sessionId,
      storyId,
      agentRole,
      workflowState,
      sessionStartTime: this.clock.now(),
      isRecovery,
    };
    this.sessions.set(sessionId, meta);
    this.save();
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.save();
  }

  get(sessionId: string): AgentSessionMeta | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getAll(): Map<string, AgentSessionMeta> {
    return new Map(this.sessions);
  }

  findByStoryId(storyId: string): AgentSessionMeta | null {
    for (const meta of this.sessions.values()) {
      if (meta.storyId === storyId) return meta;
    }
    return null;
  }

  count(): number {
    return this.sessions.size;
  }
}
