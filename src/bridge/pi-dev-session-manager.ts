import type { SessionManager, Session, SessionEvent } from "../engine/interfaces";
import type { SessionConfig, SessionInfo } from "../engine/types";

interface TrackedSession {
  session: Session;
  config: SessionConfig;
  startedAt: number;
}

export class PiDevSessionManager implements SessionManager {
  private activeMap = new Map<string, TrackedSession>();
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  async createSession(config: SessionConfig): Promise<Session> {
    const { createAgentSession } = await import("@earendil-works/pi-coding-agent");
    const opts: Record<string, unknown> = {
      cwd: config.cwd ?? this.cwd,
      tools: config.tools,
    };
    if (config.model) opts.model = config.model;
    const result = await createAgentSession(opts as any);

    const session: Session = {
      sessionId: result.session.sessionId,
      prompt: (text: string) => result.session.prompt(text),
      steer: (text: string) => result.session.steer(text),
      subscribe: (listener) => {
        return result.session.subscribe((event) => {
          listener(event as unknown as SessionEvent);
        });
      },
      abort: () => result.session.abort(),
    };

    this.activeMap.set(session.sessionId, {
      session,
      config,
      startedAt: Date.now(),
    });
    return session;
  }

  getActiveSessions(): SessionInfo[] {
    const now = Date.now();
    return Array.from(this.activeMap.entries()).map(([sessionId, tracked]) => ({
      sessionId,
      storyId: (tracked.config as any).storyId ?? "",
      agentRole: tracked.config.agentRole,
      isBusy: true,
      elapsedTime: (now - tracked.startedAt) / 1000,
    }));
  }

  async terminateSession(sessionId: string): Promise<void> {
    const tracked = this.activeMap.get(sessionId);
    if (tracked) {
      await tracked.session.abort();
      this.activeMap.delete(sessionId);
    }
  }
}
