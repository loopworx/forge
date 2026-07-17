import type {
  WorkflowState, Story, CommentWithDate, TeamInfo, WorkflowStateResult,
  Artifact, SessionConfig, SessionInfo, ForgeConfig,
  PromptParams, LoopPromptParams, InceptionPromptParams,
} from "./types";

export interface StoryRepository {
  pollStories(pullStates: WorkflowState[]): Promise<Story[]>;
  updateStoryState(storyId: string, state: WorkflowState): Promise<void>;
  getStoryState(storyId: string): Promise<WorkflowState>;
  postComment(storyId: string, body: string): Promise<void>;
  getLastComment(storyId: string): Promise<string | null>;
  getLastCommentWithDate(storyId: string): Promise<CommentWithDate | null>;
  ensureWorkflowStates(): Promise<WorkflowStateResult>;
  discoverTeam(): Promise<TeamInfo | null>;
  listTeams(): Promise<TeamInfo[]>;
}

export interface ArtifactRepository {
  createArtifact(title: string, content: string): Promise<string>;
  getArtifact(id: string): Promise<Artifact | null>;
  verifyArtifact(id: string): Promise<boolean>;
}

export interface Persistence {
  read<T>(key: string): T | null;
  write<T>(key: string, value: T): void;
  exists(key: string): boolean;
  delete(key: string): void;
}

export interface AgentRuntime {
  registerCommand(name: string, handler: CommandHandler): void;
  registerTool(definition: ToolDefinition): void;
  on(event: string, handler: EventHandler): void;
  setStatus(key: string, text: string | undefined): void;
  renderDashboard(component: DashboardComponent): void;
  closeDashboard(): void;
}

export interface DashboardComponent {
  render(width: number): string[];
  handleInput(data: string): void;
  invalidate(): void;
}

export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: (toolCallId: string, params: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: unknown;
  isError: boolean;
}

export type CommandHandler = (args: string, ctx: CommandContext) => Promise<void>;

export interface CommandContext {
  cwd: string;
  model?: unknown;
  ui?: unknown;
  newSession?: (opts: any) => Promise<{ cancelled: boolean }>;
  sendUserMessage?: (content: string) => void;
}

export type EventHandler = (event: RuntimeEvent, ctx: EventContext) => Promise<void | unknown>;

export interface RuntimeEvent {
  type: string;
  sessionId: string;
  delta?: string;
  toolName?: string;
  isError?: boolean;
  [key: string]: unknown;
}

export interface EventContext {
  sessionId: string;
  cwd: string;
  ui?: unknown;
}

export interface SessionManager {
  createSession(config: SessionConfig): Promise<Session>;
  getActiveSessions(): SessionInfo[];
  terminateSession(sessionId: string): Promise<void>;
}

export interface Session {
  readonly sessionId: string;
  prompt(text: string): Promise<void>;
  steer(text: string): Promise<void>;
  subscribe(listener: (event: SessionEvent) => void): () => void;
  abort(): Promise<void>;
  /**
   * Live context usage from the SDK's `getContextUsage()`. Optional — only
   * implemented by sessions backed by `AgentSession` from
   * `@earendil-works/pi-coding-agent`. The TUI polls this every ~750ms while
   * a session is active to surface real token usage + percentage, instead of
   * the static "0.0%" we used to show.
   *
   * Returns `undefined` when the SDK has no usage data yet (e.g. before the
   * first assistant message).
   */
  getContextUsage?: () => {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  } | undefined;

  /**
   * Live session history — entries from the SDK's
   * `sessionManager.buildContextEntries()`. Optional — only implemented by
   * sessions backed by `AgentSession` from `@earendil-works/pi-coding-agent`.
   *
   * The TUI uses this when resuming a session (`/sessions` command) to feed
   * the existing conversation (user prompts, assistant responses, tool calls,
   * compaction summaries, model changes) into ChatView via
   * `replaySessionHistory()`. Without this, resumed sessions appear blank —
   * the user only sees the "✓ Session restored" message and nothing else.
   *
   * Returns an array of broadly-typed objects (`{ type: string; [k]: unknown }`).
   * The TUI's session-history module narrows each entry by `type` and casts
   * to the SDK's discriminated `SessionEntry` union lazily at access time.
   */
  getHistory?: () => Array<{ type: string; [key: string]: unknown }>;
}

export interface SessionEvent {
  type: "agent_started" | "agent_settled" | "agent_error"
      | "text_delta" | "tool_call" | "tool_result"
      | "message_end" | "compaction";
  sessionId: string;
  delta?: string;
  toolName?: string;
  isError?: boolean;
  [key: string]: unknown;
}

export interface ProofValidator {
  verifyGitCommit(storyId: string, acNumber: number): Promise<boolean>;
  verifyArtifact(artifactId: string): Promise<boolean>;
}

export interface PromptBuilder {
  buildPrompt(params: PromptParams): string;
  buildLoopPrompt(params: LoopPromptParams): string;
  buildInceptionPrompt(params: InceptionPromptParams): string;
}

export interface Config {
  load(): ForgeConfig;
  save(partial: Partial<ForgeConfig>): void;
  validate(config: ForgeConfig): string[];
}

export interface Clock {
  now(): number;
}

export interface EventBus {
  publish(event: unknown): void;
  subscribe(listener: (event: unknown) => void): () => void;
}
