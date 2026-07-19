import type {
  SessionManager,
  Session,
  SessionEvent,
} from "../engine/interfaces";
import type { AgentRole, SessionConfig, SessionInfo } from "../engine/types";
import type { ModelRegistry, AuthStorage } from "@earendil-works/pi-coding-agent";
import type { Logger } from "../cli/forge-logger";
import { NOOP_LOGGER } from "../cli/forge-logger";
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
    private modelRegistry: ModelRegistry,
    private defaultModelRef?: string,
    private defaultThinkingLevel?: string,
    private customTools?: any[],
    private authStorage?: AuthStorage,
    private logger: Logger = NOOP_LOGGER,
  ) {}

  /**
   * Resolve a model + thinkingLevel for the given agent role.
   *
   * Looks up `agentModels[role]` first, falling back to `defaultModelRef` /
   * `defaultThinkingLevel`, and finally to `"medium"`. A model ref of the form
   * `"provider/modelId"` is split into provider + modelId; a bare id (no
   * slash) is resolved against the empty provider. Throws with a clear,
   * config-pointing message when the registry has no match.
   */
  resolveModel(role: string): { model: any; thinkingLevel: string } {
    const modelRef = this.agentModels[role]?.model ?? this.defaultModelRef ?? "";
    const thinkingLevel =
      this.agentModels[role]?.thinkingLevel ?? this.defaultThinkingLevel ?? "medium";
    const slashIndex = modelRef.indexOf("/");
    const providerName = slashIndex < 0 ? "" : modelRef.slice(0, slashIndex);
    const modelId = slashIndex < 0 ? modelRef : modelRef.slice(slashIndex + 1);
    const model = this.modelRegistry.find(providerName, modelId);
    if (!model) {
      throw new Error(
        `Model "${modelId}" not found for provider "${providerName}". Check your forge.yaml agentModels config.`,
      );
    }
    return { model, thinkingLevel };
  }

  async createSession(config: SessionConfig): Promise<Session> {
    const { session } = await this.instantiateAgentSession(config, false);
    const tracked = this.buildSessionProxy(session, config);
    this.sessions.set(tracked.sessionId, tracked);
    return tracked;
  }

  /**
   * Resume an existing session by path. Mirrors `createSession()` but uses
   * `SdkSessionManager.open(path, sessionDir, cwd)` to re-open a persisted
   * session file rather than starting a fresh one with `.create()`.
   *
   * Used by the `/sessions` slash command and the question modal selector
   * in the TUI.
   */
  async resumeSession(sessionPath: string, config: SessionConfig): Promise<Session> {
    const { session } = await this.instantiateAgentSession(config, true, sessionPath);
    const tracked = this.buildSessionProxy(session, config);
    this.sessions.set(tracked.sessionId, tracked);
    return tracked;
  }

  /**
   * Build a `TrackedSession` proxy around a raw SDK session. Shared by
   * `createSession()` and `resumeSession()` — eliminates ~30 lines of
   * duplicated `getContextUsage` / `getHistory` / `subscribe` / `prompt` /
   * `steer` / `abort` forwarding between the two code paths.
   *
   * All `catch {}` blocks log to `this.logger.debug()` so silent errors
   * are visible in `~/.config/forge/forge.log` (was: completely silent —
   * the root cause of issue 3 where the TUI failed and no log line was
   * written).
   */
  private buildSessionProxy(session: any, config: SessionConfig): TrackedSession {
    const logger = this.logger;
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
      getContextUsage: () => {
        try {
          return (session as any).getContextUsage?.();
        } catch (err) {
          logger.debug(`getContextUsage failed: ${(err as Error).message}`);
          return undefined;
        }
      },
      getHistory: () => {
        try {
          return (session as any).sessionManager?.buildContextEntries?.() ?? [];
        } catch (err) {
          logger.debug(`getHistory failed: ${(err as Error).message}`);
          return [];
        }
      },
    };
    return tracked;
  }

  /**
   * Shared SDK bootstrap for both `createSession()` and `resumeSession()`:
   * loads resources, resolves the model, opens (or creates) the
   * `SdkSessionManager`, and calls `createAgentSession()`.
   *
   * `resume=true` opens an existing session file via `SdkSessionManager.open(path, ...)`;
   * `resume=false` creates a new one via `SdkSessionManager.create(cwd, ...)`.
   */
  private async instantiateAgentSession(
    config: SessionConfig,
    resume: boolean,
    sessionPath?: string,
  ): Promise<{ session: any }> {
    const {
      createAgentSession,
      DefaultResourceLoader,
      SessionManager: SdkSessionManager,
      SettingsManager,
    } = await import("@earendil-works/pi-coding-agent");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");

    const forgeAgentDir = join(homedir(), ".config", "forge", "agent");
    const sessionDir = join(forgeAgentDir, "sessions");
    const { model, thinkingLevel } = this.resolveModel(config.agentRole);

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

    const sdkSessionManager = resume
      ? SdkSessionManager.open(sessionPath!, sessionDir, config.cwd)
      : SdkSessionManager.create(config.cwd, sessionDir);

    const { session } = await createAgentSession({
      cwd: config.cwd,
      resourceLoader: loader,
      sessionManager: sdkSessionManager,
      settingsManager: SettingsManager.inMemory(),
      authStorage: this.authStorage,
      customTools: this.customTools ?? [],
      tools: config.tools,
      model,
      thinkingLevel: thinkingLevel as any,
    });

    return { session };
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

  async listSessions(cwd: string): Promise<Array<{ id: string; name: string; firstMessage: string; created: Date; modified: Date; path: string }>> {
    const { SessionManager: SdkSessionManager } = await import("@earendil-works/pi-coding-agent");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const sessionDir = join(homedir(), ".config", "forge", "agent", "sessions");
    try {
      const sessions = await SdkSessionManager.list(cwd, sessionDir);
      return sessions.map(s => ({
        id: s.id,
        name: s.name ?? s.firstMessage?.slice(0, 60) ?? "(empty)",
        firstMessage: s.firstMessage?.slice(0, 80) ?? "",
        created: s.created,
        modified: s.modified,
        path: (s as any).path ?? "",
      }));
    } catch (err) {
      this.logger.debug(`listSessions failed: ${(err as Error).message}`);
      return [];
    }
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
