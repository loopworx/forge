import type { SessionManager, Session, SessionEvent } from "../engine/interfaces";
import type { SessionConfig, SessionInfo } from "../engine/types";

export class PiDevSessionManager implements SessionManager {
  private activeMap = new Map<string, Session>();
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

    this.activeMap.set(session.sessionId, session);
    return session;
  }

  getActiveSessions(): SessionInfo[] {
    return [];
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.activeMap.get(sessionId);
    if (session) {
      await session.abort();
      this.activeMap.delete(sessionId);
    }
  }
}
