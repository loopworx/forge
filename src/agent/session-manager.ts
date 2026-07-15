import type {
  SessionManager,
  Session,
  SessionEvent,
} from "../engine/interfaces";
import type { AgentRole, SessionConfig, SessionInfo } from "../engine/types";
import type { ModelResolver } from "./model-resolver";
import { adaptSdkEvent } from "./event-adapter";

interface TrackedSession extends Session {
  storyId?: string;
  agentRole: AgentRole;
}

export class AgentSessionManager implements SessionManager {
  private sessions = new Map<string, TrackedSession>();

  constructor(
    private cwd: string,
    private agentModels: Record<string, { model: string; thinkingLevel: string }>,
    private modelResolver: ModelResolver,
    private customTools?: any[],
  ) {}

  async createSession(config: SessionConfig): Promise<Session> {
    // Lazy import — only loaded when actually creating sessions
    const {
      createAgentSession,
      DefaultResourceLoader,
      SessionManager: SdkSessionManager,
      SettingsManager,
    } = await import("@earendil-works/pi-coding-agent");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");

    const forgeAgentDir = join(homedir(), ".config", "forge", "agent");
    const _resolved = this.modelResolver.resolveAgentModel(
      config.agentRole,
      this.agentModels,
    );

    const loader = new DefaultResourceLoader({
      cwd: config.cwd,
      agentDir: forgeAgentDir,
      noExtensions: true,
      noSkills: false,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: false,
    });
    await loader.reload({ resolveProjectTrust: async () => true });

    const { session } = await createAgentSession({
      cwd: config.cwd,
      resourceLoader: loader,
      sessionManager: SdkSessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory(),
      customTools: this.customTools ?? [],
      tools: config.tools,
    });

    const tracked: TrackedSession = {
      sessionId: session.sessionId,
      storyId: config.storyId,
      agentRole: config.agentRole,
      prompt: (text: string) => session.prompt(text),
      steer: (text: string) => session.steer(text),
      subscribe: (listener: (event: SessionEvent) => void) => {
        return session.subscribe((event: any) => {
          const adapted = adaptSdkEvent(event);
          if (adapted) {
            listener(adapted as unknown as SessionEvent);
          }
        });
      },
      abort: () => session.abort(),
    };

    this.sessions.set(tracked.sessionId, tracked);
    return tracked;
  }

  getActiveSessions(): SessionInfo[] {
    const now = Date.now();
    return [...this.sessions.values()].map((s) => ({
      sessionId: s.sessionId,
      storyId: s.storyId ?? "",
      agentRole: s.agentRole,
      isBusy: false,
      elapsedTime: now,
    }));
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Set the custom tool definitions forwarded to `createAgentSession({ customTools })`.
   * Exists because of a construction-order cycle: the engine needs `sessions` in
   * its constructor, forge tools need the engine to exist, and we want those tool
   * defs on the session manager — so the manager is constructed first (empty),
   * the engine is built, tools are registered, then defs are injected here.
   */
  setCustomTools(defs: any[]): void {
    this.customTools = defs;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.abort();
      this.sessions.delete(sessionId);
    }
  }
}
