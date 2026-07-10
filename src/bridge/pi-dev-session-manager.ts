import type { SessionManager, Session, SessionEvent } from "../engine/interfaces";
import type { SessionConfig, SessionInfo } from "../engine/types";

function log(tag: string, msg: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  console.error(`[forge ${ts}] ${tag}: ${msg}`, ...args.length ? args : []);
}

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
    log("sessions", `PiDevSessionManager constructed (cwd=${cwd})`);
  }

  async createSession(config: SessionConfig): Promise<Session> {
    log("sessions", `createSession: agentRole=${config.agentRole} storyId=${config.storyId ?? "(none)"}`, {
      cwd: config.cwd ?? this.cwd,
      tools: config.tools,
    });

    let createAgentSession: any;
    try {
      const mod = await import("@earendil-works/pi-coding-agent");
      createAgentSession = mod.createAgentSession;
      log("sessions", "createAgentSession imported successfully");
    } catch (err) {
      log("sessions", `FAILED to import createAgentSession: ${(err as Error).message}`);
      throw err;
    }

    const opts: Record<string, unknown> = {
      cwd: config.cwd ?? this.cwd,
      tools: config.tools,
      noExtensions: true,
      noSession: true,
    };
    if (config.model) opts.model = config.model;

    log("sessions", "calling createAgentSession with opts", { cwd: opts.cwd, toolCount: (opts.tools as string[])?.length, noExtensions: true });

    process.env.FORGE_SUBSESSION = "1";
    let result: any;
    try {
      result = await createAgentSession(opts as any);
      log("sessions", `createAgentSession returned sessionId=${result.session?.sessionId}`);
    } catch (err) {
      log("sessions", `createAgentSession ERROR: ${(err as Error).message}`);
      throw err;
    } finally {
      delete process.env.FORGE_SUBSESSION;
    }

    const session: Session = {
      sessionId: result.session.sessionId,
      prompt: async (text: string) => {
        log("sessions", `prompt [${result.session.sessionId}] ${(text ?? "").slice(0, 100)}...`);
        await result.session.prompt(text);
      },
      steer: async (text: string) => {
        log("sessions", `steer [${result.session.sessionId}] ${(text ?? "").slice(0, 100)}...`);
        await result.session.steer(text);
      },
      subscribe: (listener) => {
        log("sessions", `subscribe [${result.session.sessionId}]`);
        return result.session.subscribe((event: any) => {
          log("sessions", `event [${result.session.sessionId}] type=${event?.type}`);
          listener(event as unknown as SessionEvent);
        });
      },
      abort: async () => {
        log("sessions", `abort [${result.session.sessionId}]`);
        await result.session.abort();
      },
    };

    this.activeMap.set(session.sessionId, {
      session,
      config,
      startedAt: Date.now(),
    });
    log("sessions", `session tracked (active count=${this.activeMap.size})`);
    return session;
  }

  getActiveSessions(): SessionInfo[] {
    const now = Date.now();
    const sessions = Array.from(this.activeMap.entries()).map(([sessionId, tracked]) => ({
      sessionId,
      storyId: (tracked.config as any).storyId ?? "",
      agentRole: tracked.config.agentRole,
      isBusy: true,
      elapsedTime: (now - tracked.startedAt) / 1000,
    }));
    log("sessions", `getActiveSessions: ${sessions.length} active`);
    return sessions;
  }

  async terminateSession(sessionId: string): Promise<void> {
    log("sessions", `terminateSession: ${sessionId}`);
    const tracked = this.activeMap.get(sessionId);
    if (tracked) {
      await tracked.session.abort();
      this.activeMap.delete(sessionId);
      log("sessions", `terminated ${sessionId} (active count=${this.activeMap.size})`);
    } else {
      log("sessions", `terminateSession: ${sessionId} not found`);
    }
  }
}
