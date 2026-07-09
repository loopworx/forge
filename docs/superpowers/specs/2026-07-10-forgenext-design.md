# Forge v2 — Design Specification

**Date:** 2026-07-10  
**Status:** Approved  
**Repo:** `~/projects/loopworx/forgenext` (brand new, clean slate)

---

## 1. Purpose

Forge is an AI-driven software delivery orchestrator that coordinates seven specialized AI agents through a structured lean software delivery pipeline, using a project board (Linear) as the single source of truth for story state.

**Primary objective:** Automate the full software delivery lifecycle — from 8-phase project inception through continuous story development to production release — by orchestrating a team of role-bound AI agents that pull work, execute it through test-driven loops, and hand off autonomously.

**The Forge invariant:** No untested code ships. The outer Acceptance Test goes RED before any implementation begins. Every AC that turns GREEN gets a git commit before the desk check. Only test results determine reality — never plan files or conversation summaries.

---

## 2. Key Decisions

All decisions were made through collaborative brainstorming and approved by the user.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repo | Brand new at `~/projects/loopworx/forgenext` | Clean slate, no legacy code. SWOT analysis is the only carry-over. |
| Agent runtime | pi.dev (in-process SDK) | In-process session creation, full TUI component system, programmatic session switching, richer event granularity, session branching/tree navigation. |
| Workflow engine | In-process, deterministic, custom tools | Agents never touch Linear directly. Engine owns all state transitions, validates rules, tracks proof-of-progress. Fixes v1's biggest weakness (agents forgetting state updates). |
| Artifact verification | Dual-write (Linear Documents authoritative) | Agents write artifacts to both filesystem and Linear Documents. Engine verifies via Linear Documents. Eliminates filesystem/Linear drift. |
| Claim locking | Single-writer FIFO queue | All Linear mutations serialized through a queue. Eliminates race conditions in concurrent claims. |
| Dashboard | Full custom TUI via pi.dev extension | Full-window split layout: main output + right sidebar + bottom chat. Auto-cycling between agent sessions. Replaces pi.dev's default TUI when active. |
| Skills/agents | Port existing 24 skills + 7 agent definitions | Platform-agnostic Markdown. Validated by loopkit. Rewrite only what the new engine changes. |
| Runtime | Bun | Fast, TypeScript native, shell API. Same as v1. |
| Architecture | Engine module + bridge extension | Engine is standalone TypeScript with zero harness imports. Bridge is the sole composition root wiring concrete implementations. |
| Interfaces | Implementation to interfaces, DI, no inheritance | Every external dependency abstracted behind an interface. No "I" prefix. Constructor injection. Enables porting to Trello, Claude Code, opencode, etc. |
| Harness abstraction | Dispatcher pattern | `forge-bridge.ts` detects harness and loads the right bridge (`pi-bridge.ts`, `claude-bridge.ts`, etc.). Future harnesses require only a new bridge adapter. |

---

## 3. Architecture Overview

### 3.1 Directory structure

```
forgenext/
├── package.json                  # @loopworx/forge npm package
├── forge.yaml                    # Default config template
├── bin/
│   └── forge.ts                   # CLI: `forge init` (setup, OAuth, copy bridge)
├── src/
│   ├── engine/                    # Pure TypeScript, zero harness imports, fully testable
│   │   ├── workflow-engine.ts     # Core orchestrator: claim, dispatch, handle idle
│   │   ├── state-machine.ts       # Transition rules, valid edges, halt logic
│   │   ├── claim-queue.ts         # Single-writer FIFO queue for board mutations
│   │   ├── proof-validator.ts     # Git commit verification, artifact verification
│   │   ├── session-manager.ts     # Agent session tracking, crash recovery, orphan reconciliation
│   │   ├── interfaces.ts          # All engine interfaces (no "I" prefix)
│   │   ├── events.ts              # Engine event types and EventBus
│   │   └── types.ts               # Engine-specific types (Transition, ClaimRequest, etc.)
│   ├── linear/                    # Linear-specific implementations of interfaces
│   │   ├── linear-story-repository.ts    # Implements StoryRepository
│   │   ├── linear-document-repository.ts # Implements ArtifactRepository (dual-write)
│   │   ├── linear-client.ts       # OAuth, GraphQL, token refresh
│   │   └── workflow-states.ts      # 14 state definitions, provisioning
│   ├── bridge/                    # Harness-specific adapters (only place that imports pi.dev)
│   │   ├── forge-bridge.ts        # Universal entry: detects harness, loads right bridge
│   │   ├── harness-detector.ts    # Detects which runtime we're in
│   │   ├── pi-bridge.ts           # pi.dev bridge (wires PiDevRuntime + all dependencies)
│   │   ├── pi-dev-runtime.ts     # Implements AgentRuntime (wraps ExtensionAPI)
│   │   ├── pi-dev-session-manager.ts # Implements SessionManager (wraps createAgentSession)
│   │   ├── pi-dev-session.ts     # Implements Session (wraps AgentSession)
│   │   ├── custom-tools.ts        # Registers forge_* tools via AgentRuntime
│   │   └── event-handlers.ts      # Maps harness events → engine methods
│   ├── dashboard/                 # TUI components (implement DashboardComponent interface)
│   │   ├── forge-layout.ts        # Root layout: SplitLayout (main + sidebar)
│   │   ├── split-layout.ts       # Horizontal split: left content + right sidebar
│   │   ├── agent-output.ts       # Top-left: auto-cycling agent output
│   │   ├── chat-bar.ts           # Bottom-left: input bar (preserves harness input)
│   │   ├── sidebar.ts            # Right: composes SessionList + TransitionTimeline + GuardianStatus
│   │   ├── session-list.ts       # Sidebar: active sessions with status badges
│   │   ├── transition-timeline.ts # Sidebar: recent board state changes
│   │   └── guardian-status.ts    # Sidebar: per-story guardian check results
│   ├── prompts/
│   │   ├── prompt-builder.ts     # Assembles agent prompts (story context, handoff, loop contract)
│   │   └── read-loop-md.ts       # Reads skills/{name}/LOOP.md
│   ├── config/
│   │   ├── config-loader.ts       # forge.yaml → typed ForgeConfig
│   │   └── config-validator.ts    # Business rules validation
│   └── utils/
│       └── session-title.ts       # Session naming/parsing (fallback for orphan recovery)
├── agents/                        # 7 agent definitions (ported from v1)
├── skills/                        # 24 skills (ported from v1, modified ones updated)
├── commands/                      # Slash commands (ported from v1)
├── tests/
│   ├── engine/
│   │   ├── state-machine.test.ts
│   │   ├── claim-queue.test.ts
│   │   ├── proof-validator.test.ts
│   │   └── workflow-engine.test.ts
│   ├── linear/
│   │   └── linear-client.test.ts
│   ├── prompts/
│   │   └── prompt-builder.test.ts
│   └── config/
│       └── config-loader.test.ts
└── dist/                          # Built output (bundled by bun build)
```

### 3.2 Dependency flow

```
                     ┌─────────────┐
                     │  forge.ts   │  (bin/ CLI — forge init)
                     └──────┬──────┘
                            │ copies bridge entry file to .pi/extensions/
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Harness process (pi.dev)                                       │
│                                                                  │
│  ┌──────────────────┐    ┌───────────────────────────────────┐ │
│  │  forge-bridge.ts │───►│  @loopworx/forge (npm package)     │ │
│  │  (thin import)   │    │                                    │ │
│  └──────────────────┘    │  ┌──────────────────────────────┐  │ │
│         │                │  │  bridge/                     │  │ │
│         │  detects       │  │   forge-bridge.ts (dispatch) │  │ │
│         │  harness →     │  │   pi-bridge.ts (composition)  │  │ │
│         │  pi-bridge     │  │   pi-dev-runtime.ts           │  │ │
│         │                │  │   pi-dev-session-manager.ts   │  │ │
│         │ registers       │  │   custom-tools.ts            │  │ │
│         │ commands,      │  │   event-handlers.ts          │  │ │
│         │ tools,         │  └──────────────────────────────┘  │ │
│         │ events         │  ┌──────────────────────────────┐  │ │
│         │                │  │  engine/ (ZERO harness deps) │  │ │
│         │                │  │   workflow-engine.ts         │  │ │
│         │                │  │   state-machine.ts           │  │ │
│         │                │  │   claim-queue.ts             │  │ │
│         │                │  │   proof-validator.ts         │  │ │
│         │                │  │   session-manager.ts         │  │ │
│         │                │  │   interfaces.ts              │  │ │
│         │                │  └──────────┬───────────────────┘  │ │
│         │                │  ┌──────────▼───────────────────┐  │ │
│         │                │  │  linear/                     │  │ │
│         │                │  │   linear-story-repository    │  │ │
│         │                │  │   linear-document-repository  │  │ │
│         │                │  │   linear-client              │  │ │
│         │                │  └──────────────────────────────┘  │ │
│         │                │  ┌──────────────────────────────┐  │ │
│         │                │  │  dashboard/                  │  │ │
│         │                │  │   forge-layout.ts           │  │ │
│         │                │  │   split-layout.ts            │  │ │
│         │                │  │   agent-output.ts            │  │ │
│         │                │  │   sidebar.ts                 │  │ │
│         │                │  └──────────────────────────────┘  │ │
│         │                └───────────────────────────────────┘ │
│         │                                                       │
│         ▼                                                       │
│  Creates agent sessions via SessionManager (in-process)        │
│  Subscribes to events via session.subscribe()                   │
│  Renders dashboard via runtime.renderDashboard()                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Agent Sessions (independent of user session)           │    │
│  │  • PO Agent (inception phase 1)                        │    │
│  │  • Developer Agent (FORGE-42, in-dev)                  │    │
│  │  • QA Agent (FORGE-43, in-qa)                          │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Key design invariant

The engine module (`src/engine/`) has **zero imports** from `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, or any other harness package. It only imports from its own interfaces. The bridge is the sole composition root where concrete implementations meet.

---

## 4. Interface Architecture

Every external dependency is abstracted behind an interface. No "I" prefix. Constructor injection. No inheritance — always prefer composition. Zero concrete class dependencies in the engine.

### 4.1 Interfaces

```typescript
// src/engine/interfaces.ts

// ── Board operations (Linear, Trello, GitHub Projects — swap anytime) ──
interface StoryRepository {
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

// ── Artifact storage (Linear Documents, S3, wiki — swap anytime) ──
interface ArtifactRepository {
  createArtifact(title: string, content: string): Promise<string>;
  getArtifact(id: string): Promise<Artifact | null>;
  verifyArtifact(id: string): Promise<boolean>;
}

// ── Persistence (file, database, board — swap anytime) ──
interface Persistence {
  read<T>(key: string): T | null;
  write<T>(key: string, value: T): void;
  exists(key: string): boolean;
  delete(key: string): void;
}

// ── Agent harness abstraction (pi.dev, Claude Code, opencode, Hermes) ──
interface AgentRuntime {
  registerCommand(name: string, handler: CommandHandler): void;
  registerTool(definition: ToolDefinition): void;
  on(event: string, handler: EventHandler): void;
  setStatus(key: string, text: string | undefined): void;
  renderDashboard(component: DashboardComponent): void;
  closeDashboard(): void;
}

// ── TUI component abstraction ──
interface DashboardComponent {
  render(width: number): string[];
  handleInput(data: string): void;
  invalidate(): void;
}

// ── Tool definition (harness-agnostic) ──
interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: (toolCallId: string, params: unknown) => Promise<ToolResult>;
}

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: unknown;
  isError: boolean;
}

// ── Command handler ──
type CommandHandler = (args: string, ctx: CommandContext) => Promise<void>;

interface CommandContext {
  cwd: string;
  model?: unknown;
}

// ── Event handler ──
type EventHandler = (event: RuntimeEvent, ctx: EventContext) => Promise<void>;

interface RuntimeEvent {
  type: string;
  sessionId: string;
  delta?: string;
  toolName?: string;
  isError?: boolean;
  [key: string]: unknown;
}

interface EventContext {
  sessionId: string;
  cwd: string;
}

// ── Session lifecycle ──
interface SessionManager {
  createSession(config: SessionConfig): Promise<Session>;
  getActiveSessions(): SessionInfo[];
  terminateSession(sessionId: string): Promise<void>;
}

interface Session {
  readonly sessionId: string;
  prompt(text: string): Promise<void>;
  steer(text: string): Promise<void>;
  subscribe(listener: (event: SessionEvent) => void): () => void;
  abort(): Promise<void>;
}

interface SessionEvent {
  type: "agent_started" | "agent_settled" | "agent_error"
      | "text_delta" | "tool_call" | "tool_result"
      | "message_end" | "compaction";
  sessionId: string;
  delta?: string;
  toolName?: string;
  isError?: boolean;
  [key: string]: unknown;
}

// ── Proof-of-progress verification ──
interface ProofValidator {
  verifyGitCommit(storyId: string, acNumber: number): Promise<boolean>;
  verifyArtifact(artifactId: string): Promise<boolean>;
}

// ── Prompt assembly ──
interface PromptBuilder {
  buildPrompt(params: PromptParams): string;
  buildLoopPrompt(params: LoopPromptParams): string;
  buildInceptionPrompt(params: InceptionPromptParams): string;
}

// ── Configuration ──
interface Config {
  load(): ForgeConfig;
  save(partial: Partial<ForgeConfig>): void;
  validate(config: ForgeConfig): string[];
}

// ── Time (makes timestamp-based failsafe deterministic in tests) ──
interface Clock {
  now(): number;
}

// ── Event bus (engine-internal pub/sub, no external dependency) ──
interface EventBus {
  publish(event: EngineEvent): void;
  subscribe(listener: (event: EngineEvent) => void): () => void;
}
```

### 4.2 Implementation map

| Interface | Primary implementation | Test implementation |
|-----------|----------------------|-------------------|
| `StoryRepository` | `LinearStoryRepository` | `MockStoryRepository` |
| `ArtifactRepository` | `LinearDocumentRepository` (dual-write to filesystem) | `MockArtifactRepository` |
| `Persistence` | `FilePersistence` (`.forge/sessions.json`, etc.) | `MemoryPersistence` |
| `AgentRuntime` | `PiDevRuntime` (wraps `ExtensionAPI`) | `MockRuntime` |
| `SessionManager` | `PiDevSessionManager` (wraps `createAgentSession`) | `MockSessionManager` |
| `Session` | `PiDevSession` (wraps `AgentSession`) | `MockSession` |
| `ProofValidator` | `GitProofValidator` | `MockProofValidator` |
| `PromptBuilder` | `PromptBuilder` | (pure functions, test directly) |
| `Config` | `YamlConfig` | `MemoryConfig` |
| `Clock` | `SystemClock` | `FakeClock` (deterministic) |
| `EventBus` | `EngineEventBus` | `MockEventBus` |

### 4.3 Composition root (bridge)

The bridge is the **only** place where concrete implementations are wired together. The engine receives all dependencies via constructor injection:

```typescript
// src/bridge/pi-bridge.ts (sole composition root for pi.dev)

function piBridge(api: ExtensionAPI) {
  const runtime = new PiDevRuntime(api);

  runtime.registerCommand("forge", async (args, ctx) => {
    if (args === "new project") {
      const engine = new WorkflowEngine(
        new LinearStoryRepository(authPath, teamId),     // StoryRepository
        new LinearDocumentRepository(authPath, teamId),  // ArtifactRepository
        new FilePersistence(join(ctx.cwd, ".forge")),    // Persistence
        new PiDevSessionManager(ctx.cwd, agentDir),     // SessionManager
        new GitProofValidator(ctx.cwd),                  // ProofValidator
        new PromptBuilder(ctx.cwd),                      // PromptBuilder
        new YamlConfig(configPath),                       // Config
        new SystemClock(),                               // Clock
        new EngineEventBus(),                             // EventBus
        runtime,                                          // AgentRuntime
      );
      await engine.startInception();
    }
  });
}
```

### 4.4 Porting to another harness

When porting to Claude Code, opencode, Hermes, etc., write a new bridge file (`claude-bridge.ts`, `opencode-bridge.ts`, `hermes-bridge.ts`). The bridge implements `AgentRuntime` and `SessionManager` using that harness's API. The engine, all custom tools, all event handlers, the failsafe, the state machine — all run against the interfaces unchanged.

### 4.5 Harness dispatcher

The universal entry point detects which harness Forge is running in and loads the appropriate bridge:

```
src/bridge/
├── forge-bridge.ts       # Entry point: detects harness, loads the right bridge
├── harness-detector.ts   # Detects which runtime we're in
├── pi-bridge.ts          # pi.dev bridge
├── claude-bridge.ts      # (future) Claude Code bridge
├── opencode-bridge.ts    # (future) opencode bridge
├── pi-dev-runtime.ts     # PiDevRuntime implements AgentRuntime
├── pi-dev-session-manager.ts
├── pi-dev-session.ts
├── custom-tools.ts
└── event-handlers.ts
```

```typescript
// src/bridge/forge-bridge.ts

export async function forgeBridge(api: unknown) {
  const harness = detectHarness();

  switch (harness) {
    case "pi.dev":
      const { piBridge } = await import("./pi-bridge");
      return piBridge(api);
    case "claude-code":
      const { claudeBridge } = await import("./claude-bridge");
      return claudeBridge(api);
    case "opencode":
      const { opencodeBridge } = await import("./opencode-bridge");
      return opencodeBridge(api);
    default:
      throw new Error(`Unsupported agent harness: ${harness}`);
  }
}
export default forgeBridge;
```

The user's extension file is a thin import:
```typescript
// .pi/extensions/forge-bridge.ts
import forgeBridge from "@loopworx/forge";
export default forgeBridge;
```

---

## 5. Workflow Engine

This is the core that fixes v1's biggest weaknesses: untested orchestration logic and agents forgetting state updates.

### 5.1 State machine

14 distinct workflow states, each created as a separate entry in the project board:

| State | Board State Type | Group |
|-------|-----------------|-------|
| `in-analysis` | unstarted | Pre-dev |
| `ready-for-dev` | unstarted | Pre-dev |
| `in-deskcheck` | unstarted | Pre-dev |
| `ready-for-qa` | unstarted | Pre-dev |
| `ready-for-acceptance` | unstarted | Pre-dev |
| `ready-to-deploy` | unstarted | Pre-dev |
| `in-dev` | started | Active |
| `in-qa` | started | Active |
| `in-acceptance` | started | Active |
| `done` | completed | Terminal |
| `halted-stall` | canceled | Halted |
| `halted-ambiguous` | canceled | Halted |
| `halted-human-gate` | canceled | Halted |
| `halted-unsafe` | canceled | Halted |

Valid transitions are enforced by the engine, not by agents. The `VALID_TRANSITIONS` map defines every legal edge. Invalid transitions are rejected with an error message the agent receives.

### 5.2 Custom tools (the engine's API surface)

These are registered via `AgentRuntime.registerTool()`. Agents call them instead of touching the board directly:

| Tool | Called by | What it does |
|------|----------|--------------|
| `forge_claim_story` | Agent at session start | Engine claims the oldest story in the agent's pull state. Returns story ID, title, handoff comment. FIFO queue serializes the board state mutation. |
| `forge_complete_ac` | Developer after GREEN test | Engine verifies git commit exists for this AC number, records AC completion, updates story snapshot. Rejects if no commit found. |
| `forge_handoff` | Agent when done | Engine validates target state is a legal transition, posts handoff comment to board, transitions state. FIFO queue serializes. |
| `forge_create_artifact` | Inception agent | Engine writes content to board document AND filesystem. Returns document ID. |
| `forge_log_progress` | Any agent | Engine records progress to loop state file AND posts compact summary to board as a comment. |
| `forge_request_human_gate` | Agent when blocked | Engine transitions story to `halted-human-gate`, posts reason to board. |

**Permission enforcement:** The bridge uses the harness's tool-call event to block agents from calling board-related built-in tools directly. Agents can only interact with the board through Forge custom tools.

### 5.3 Claim queue (race condition fix)

A single-writer FIFO queue serializes all board mutations. No two operations can race:

```typescript
class ClaimQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try { resolve(await operation()); }
        catch (e) { reject(e); }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const op = this.queue.shift()!;
      await op();
    }
    this.processing = false;
  }
}
```

Every board mutation (claim, handoff, state update, comment post, artifact create) goes through `claimQueue.enqueue()`. No exceptions.

### 5.4 Proof validator

Server-side verification of progress claims:

- `verifyGitCommit(storyId, acNumber)` — checks `git log --grep "feat({STORY-ID}): AC{n}"` exists
- `verifyArtifact(artifactId)` — queries board document existence + content length > 100 chars

Called by `forge_complete_ac` before recording AC completion, and by the engine during inception idle handling to verify phase completion.

### 5.5 Session manager (crash recovery)

Same two-sided reconciliation as v1, but with structured metadata as the primary tracking mechanism:

**Side A — Tracked-but-dead:** Sessions in our tracking map but not in the live session list.
- If story is halted or in a pull state → drop from tracking (board/poller will handle it)
- If story is still in an active state and nothing else tracks it → drop + create recovery session

**Side B — Live-but-untracked:** Sessions in the live list but not in our map.
- Parse session title (fallback) to extract story ID/agent
- If currently busy → re-adopt into tracking map
- If story is still in active state → create recovery session

Session title parsing is retained as a **fallback** for orphan recovery. Primary tracking is structured JSON metadata. A test asserts the title format and parser stay in sync.

**Structured metadata format:**
```typescript
interface AgentSessionMeta {
  sessionId: string;
  storyId: string;
  agentRole: string;
  workflowState: WorkflowState;
  sessionStartTime: number;
  isRecovery: boolean;
}
```

### 5.6 Failsafe (improved)

When an agent session settles without calling `forge_handoff`:

1. Engine queries board for current story state
2. If state changed → agent did handoff via custom tool → route to next agent
3. If state unchanged → check for board comment since `sessionStartTime`:
   - Comment exists → auto-advance (agent produced handoff text but forgot to call tool)
   - No comment → halt as `halted-ambiguous`
4. **New in v2:** If the agent called `forge_complete_ac` but not `forge_handoff` → auto-advance (partial progress detected, agent did real work but didn't finish the handoff)

The `sessionStartTime` is captured **before** the prompt is sent. This prevents a dead agent's stale comment from masquerading as a fresh handoff.

### 5.7 Progress logging

When an agent calls `forge_log_progress`, the engine:
1. Writes full structured state to local `stories/{STORY-ID}.loop.md` (current_loop, stall_counter, iteration_counter, guardian_check entries)
2. Posts a compact summary to the board as a comment:
   ```
   [Forge Progress] AC1 ✓ (abc1234) | AC2 ✓ (def5678) | AC3 in-progress | Guardian: cleared
   ```

The local file keeps full structured state; the board comment is a compacted snapshot for board visibility.

### 5.8 Engine constructor

The engine receives all dependencies via constructor injection:

```typescript
class WorkflowEngine {
  constructor(
    private stories: StoryRepository,
    private artifacts: ArtifactRepository,
    private persistence: Persistence,
    private sessions: SessionManager,
    private proof: ProofValidator,
    private prompts: PromptBuilder,
    private config: Config,
    private clock: Clock,
    private events: EventBus,
    private runtime: AgentRuntime,
  ) {}
}
```

All methods use interface methods — no direct access to Linear, pi.dev, filesystem, or git. The `Clock` interface makes timestamp-based failsafe deterministic in tests via `FakeClock`.

---

## 6. Linear Integration

### 6.1 OAuth

- PKCE flow, per-project auth at `.forge/linear-auth.json`
- Client ID hardcoded (Forge OAuth application)
- Scopes: `read,write,admin` (admin needed for workflow state creation)
- `actor=user` (inherits user's workspace permissions)
- Token refresh: 60-second buffer, persists new tokens to disk
- Fixed-delay retry (3 attempts, 1s) — noted as a known limitation, could improve to exponential backoff later

### 6.2 Board operations

- `pollStories(pullStates)` — query stories in pull states for the bound team
- `updateStoryState(storyId, stateName)` — transition story (only called via claim queue)
- `getStoryState(storyId)` — read current state
- `postComment(storyId, body)` — post handoff/progress comment
- `getLastComment(storyId)` / `getLastCommentWithDate(storyId)` — for failsafe
- `ensureWorkflowStates()` — idempotent provisioning of 14 states
- `discoverTeam()` / `listTeams()` — team binding

### 6.3 Linear Documents API (artifact storage)

- `createDocument(title, content)` — create a Markdown document in the team
- `getDocument(documentId)` — query document existence + content
- `updateDocument(documentId, content)` — update an existing document
- `listDocuments()` — list all documents (for phase verification)

### 6.4 Dual-write for inception artifacts

When an inception agent calls `forge_create_artifact`:
1. Write to board document (authoritative)
2. Write to filesystem at `docs/{filename}` (convenience cache)
3. Record document ID in project state

During idle handling, the engine verifies via board document (not filesystem). If the board document doesn't exist or is too short, the phase does not advance.

### 6.5 Claim queue integration

The `ClaimQueue` wraps all board mutations. The `StoryRepository` methods are only called through `claimQueue.enqueue()` inside the `WorkflowEngine`:

```typescript
async claimStory(agent: AgentRole): Promise<Story | null> {
  return this.claimQueue.enqueue(async () => {
    const stories = await this.stories.pollStories(config.agents[agent].pullStates);
    if (stories.length === 0) return null;
    const story = stories[0];
    await this.stories.updateStoryState(story.id, config.agents[agent].activeState);
    return story;
  });
}
```

---

## 7. Agent Runtime Integration (Bridge)

### 7.1 Bridge as composition root

The bridge wires concrete implementations together and registers everything with the harness:

```typescript
// src/bridge/pi-bridge.ts
function piBridge(api: ExtensionAPI) {
  const runtime = new PiDevRuntime(api);

  runtime.registerCommand("forge", async (args, ctx) => {
    if (args === "new project") {
      const engine = new WorkflowEngine(
        new LinearStoryRepository(authPath, teamId),
        new LinearDocumentRepository(authPath, teamId),
        new FilePersistence(join(ctx.cwd, ".forge")),
        new PiDevSessionManager(ctx.cwd, agentDir),
        new GitProofValidator(ctx.cwd),
        new PromptBuilder(ctx.cwd),
        new YamlConfig(configPath),
        new SystemClock(),
        new EngineEventBus(),
        runtime,
      );
      await engine.startInception();
      // Dashboard takes over full window
      runtime.renderDashboard(new ForgeLayout(engine));
    } else if (args === "stop") {
      engine?.stop();
      runtime.closeDashboard();
    }
  });

  registerCustomTools(runtime, () => engine);
  registerEventHandlers(runtime, () => engine);
}
```

### 7.2 Custom tools

Registered via `AgentRuntime.registerTool()`. Each tool delegates to engine methods. Agents receive structured results. Invalid operations return errors the agent can act on.

Tools: `forge_claim_story`, `forge_complete_ac`, `forge_handoff`, `forge_create_artifact`, `forge_log_progress`, `forge_request_human_gate`.

### 7.3 Event handlers

The bridge maps harness events to engine methods:

- `agent_settled` → `engine.handleAgentIdle(sessionId)` — main lifecycle signal
- `agent_end` with error → `engine.handleAgentError(sessionId)` — crash recovery
- `tool_call` with `linear_*` → block — agents can't access board directly
- `text_delta` → `engine.handleOutput(sessionId, delta)` — forward to dashboard
- `tool_execution_end` → auto-focus dashboard on significant tool completions

### 7.4 Agent session creation

The engine creates sessions via `SessionManager.createSession()` (which uses pi.dev's `createAgentSession()` SDK in the pi.dev bridge):

```typescript
async createAgentSessionForStory(story: Story, agentRole: AgentRole): Promise<string> {
  const prompt = this.prompts.buildPrompt({ story, agentRole, ... });

  const session = await this.sessions.createSession({
    cwd: this.workdir,
    model: this.getModelForRole(agentRole),
    tools: ["read", "bash", "edit", "write", "grep", "find", "ls",
            "forge_claim_story", "forge_complete_ac", "forge_handoff",
            "forge_create_artifact", "forge_log_progress"],
    agentRole,
  });

  session.subscribe((event) => {
    if (event.type === "agent_settled") {
      this.handleAgentIdle(session.sessionId);
    }
  });

  await session.prompt(prompt);
  // Track internally via Persistence (engine concern, not SessionManager)
  this.trackSession(session.sessionId, story.id, agentRole);

  return session.sessionId;
}
```

Sessions run in-process, events stream via `session.subscribe()`. No HTTP, no subprocess, no connection issues.

### 7.5 Engine lifecycle

The engine runs inside the harness process for its entire lifetime:

- Extension loads at startup (auto-discovered by pi.dev)
- Engine starts lazily when user runs `/forge new project`
- Polling interval lives at the extension level, not tied to any specific session
- Agent sessions are independent of the user's interactive session
- Engine stops via `/forge stop` or when pi.dev exits

---

## 8. Dashboard TUI

A full custom TUI that replaces pi.dev's default layout when Forge is active. Built using the `DashboardComponent` interface (`render`, `handleInput`, `invalidate`).

### 8.1 Layout

```
┌─ Agent Output (auto-cycling) ─────────────────┬─ Forge Sidebar ────┐
│                                                │                    │
│  > Analyzing acceptance criteria...           │  ACTIVE SESSIONS   │
│  > Writing outer AT: tests/oauth.spec.ts      │  ● PO  Phase 1    │
│  > RED: 3 tests failed                        │    Lean Canvas    │
│  > Implementing LoginButton.tsx                │    busy · 2m       │
│  > GREEN: FE test passing                      │                    │
│  > Starting BE CDC contract...                │  ● Dev  FORGE-42   │
│  ▌                                            │    in-dev · 5m     │
│                                                │                    │
│                                                │  ○ QA   FORGE-43   │
│                                                │    idle · 1m       │
│                                                │                    │
│                                                │  TRANSITIONS       │
│                                                │  14:32 FORGE-42    │
│                                                │    → in-dev        │
│                                                │  14:28 FORGE-43    │
│                                                │    → ready-for-acc │
│                                                │  14:15 Phase 1 ✓   │
│                                                │    → Phase 2       │
│                                                │                    │
├────────────────────────────────────────────────┤  GUARDIAN          │
│ > _                                            │  FORGE-42: cleared │
│                                                │  FORGE-43: cleared │
│  [Tab] cycle agent  [Esc] exit Forge dashboard │                    │
└────────────────────────────────────────────────┴────────────────────┘
```

### 8.2 Component structure

```
ForgeLayout (root, takes full window)
├── SplitLayout (horizontal split: main | sidebar)
│   ├── left: MainPanel
│   │   ├── AgentOutput (top — auto-cycles between agent sessions)
│   │   └── ChatBar (bottom — preserves harness input component)
│   │       └── Footer (keybindings hint)
│   └── right: Sidebar
│       ├── SessionList (active sessions with status badges)
│       ├── TransitionTimeline (recent board state changes)
│       └── GuardianStatus (per-story guardian check results)
```

### 8.3 Key components

**SplitLayout** — Horizontal split (main content + sidebar). Not built into pi.dev, so implemented from scratch: renders left and right components, joins lines with `│` separator, routes input to the focused pane.

**AgentOutput** — Top-left. Shows streaming output from the currently focused agent session. Maintains a buffer per session (last N lines). `handleInput` responds to Tab (cycle sessions) and Shift-Tab (resume auto-cycling).

**ChatBar** — Bottom-left. Preserves the harness's built-in Input component so the user can type prompts, interact with the focused agent session (via `session.steer()`), or run commands. Input is routed to the focused agent session.

**Sidebar** — Right side. Composes SessionList, TransitionTimeline, and GuardianStatus vertically. Read-only display (no input handling).

### 8.4 Auto-cycling behavior

The bridge evaluates incoming events and decides when to auto-switch the output view:

- `text_delta` with significant keywords (RED, GREEN, halted, error, complete, fail) → auto-focus that session
- `tool_execution_end` for bash tools → auto-focus (agent did something visible)
- Board state transition → auto-focus the session responsible

**Pause behavior:**
- Tab pauses auto-cycling for 2 minutes or until Shift-Tab is pressed
- Auto-cycling is **inactive** while the chat bar is focused — user can focus on the problem without interruptions
- Manual Tab always cycles to the next session immediately

### 8.5 Status bar (always visible, even when dashboard is closed)

When Forge is active but the user is in normal pi.dev mode (Esc'd out of dashboard), a status bar shows:

```
Forge: 3 active | Latest: FORGE-42 → in-dev
```

### 8.6 How this replaces pi.dev's default TUI

The full `ForgeLayout` is rendered via `runtime.renderDashboard()` when Forge is active:

- **Before `/forge`:** pi.dev's default TUI (user coding normally)
- **After `/forge new project`:** ForgeLayout takes over — split layout with sidebar, auto-cycling output, chat bar
- **Esc:** Back to pi.dev's normal TUI (Forge still runs in background, status bar shows activity)
- **Reopen:** `/forge` command again, or a keybind to toggle

---

## 9. Skills and Agents

### 9.1 Porting strategy

Port all 24 skills and 7 agent definitions from v1. Files are platform-agnostic Markdown. Change only what the new engine requires.

### 9.2 Skills that need updates

**`using-forge`** — Update the "Plugin-vs-Agent boundary" table. The engine now owns ALL board mutations. Agents must use `forge_claim_story`, `forge_complete_ac`, `forge_handoff`, `forge_create_artifact`, `forge_log_progress` instead of board MCP tools. The `tool_call` event blocks direct board access.

**`guarding-loops`** — The git commit verification (`git log --grep "AC{n}"`) is now enforced server-side by `forge_complete_ac` before AC completion is recorded. The guardian skill still runs its pre-flight checks but doesn't need to do the commit check itself — the engine already validated it.

**`resuming-sessions`** — Recovery protocol unchanged. The engine's crash recovery creates recovery sessions via `SessionManager.createSession()` with `buildLoopPrompt` (recovery-focused prompt).

**`facilitating-inception`** — Phase completion now requires calling `forge_create_artifact` (which writes to board documents, not just filesystem). Update instructions to call this tool at the end of each phase.

### 9.3 All other skills

Port verbatim. They don't interact with the board directly — they produce code, tests, and documentation. The skill precedence hierarchy (L1-RIGID > L2-GUIDED > L3-MECH) and all behavioral contracts remain unchanged.

### 9.4 Agent definitions

Port all 7. Each agent's tool allowlist must now include the `forge_*` custom tools alongside the built-in tools (read, bash, edit, write, grep, glob, find, ls). Board-related tools (`linear_*`, `mcp_linear_*`) must NOT be in the allowlist — the `tool_call` event blocks them anyway, but explicit deny is defense-in-depth.

### 9.5 The seven agents

| Agent | Model | Discipline | Trigger |
|-------|-------|-----------|---------|
| Product Owner | Analytical/Reasoning model | Discovery, story writing, story acceptance | Pull state `ready-for-acceptance` |
| UX Specialist | Analytical/Reasoning model | Empathy mapping, design system | Inception phases 4-5 |
| Architect | Analytical/Reasoning model | ADRs, service boundaries, tech debt | Inception phase 7, dev blocked |
| Developer | Code-generation model | ATDD loops, TDD loops, feature flags | Pull state `ready-for-dev` |
| QA Engineer | Code-generation model | Desk checks, regression suite, acceptance tests | Pull state `ready-for-qa` |
| DevOps | Code-generation model | CI/CD, environments, smoke tests, flag flips | Pull state `ready-to-deploy` |
| SecOps | Code-generation model | Threat modeling, security ACs, SAST/DAST | After story writing, iteration zero |

Four agents are **pulling agents** (PO, Developer, QA, DevOps). Three are **triggered agents** (UX, Architect, SecOps).

---

## 10. Configuration

Same structure as v1. Key sections:

```yaml
active: false                    # Dormant until /forge new project
max_concurrent_stories: 5

linear:
  poll_interval_seconds: 30
  team_id: ""
  team_name: ""

agents:
  po-agent:
    pull_states: ["in-analysis", "ready-for-acceptance"]
    active_state: "in-acceptance"
    primary_skill: "approving-stories"
    interactive: false
    human_gate: false
  developer-agent:
    pull_states: ["ready-for-dev", "in-deskcheck"]
    active_state: "in-dev"
    primary_skill: "running-atdd-sessions"
    interactive: false
    human_gate: false
  # ... 5 more agents

inception:
  phases:
    - { phase: 1, name: "Lean Canvas", skill: "facilitating-inception", agent: "po-agent", output: "lean-canvas.md" }
    # ... 7 more phases

triggers:       # same as v1
integrations:   # same as v1
cost_tracking:  # same as v1
loop_logs:      # same as v1

dashboard:
  sidebar_width: 40             # New: configurable sidebar width
```

---

## 11. Testing Strategy

Fixes v1's biggest weakness: zero unit tests on orchestration functions.

### 11.1 Test files

| Test file | What it covers |
|-----------|---------------|
| `tests/engine/state-machine.test.ts` | Every valid transition, every invalid transition rejected, halt-state un-halting rules |
| `tests/engine/claim-queue.test.ts` | Sequential execution, no race conditions, error handling in queue |
| `tests/engine/proof-validator.test.ts` | Git commit pattern matching, artifact verification |
| `tests/engine/workflow-engine.test.ts` | Claim flow, AC completion, handoff, failsafe logic, inception phase advancement, crash recovery reconciliation |
| `tests/linear/linear-client.test.ts` | OAuth token refresh, GraphQL operations (mocked) |
| `tests/prompts/prompt-builder.test.ts` | Prompt assembly (same as v1, proven) |
| `tests/config/config-loader.test.ts` | Load, normalize, validate (same as v1, proven) |

### 11.2 Key testing principles

- The workflow engine tests don't mock pi.dev at all. They mock `StoryRepository`, `ArtifactRepository`, `Persistence`, `SessionManager`, `ProofValidator`, and `Clock` (via interfaces)
- `FakeClock` makes the timestamp-based failsafe deterministic — you can test "agent posted a comment 5 seconds after session start" precisely
- `MemoryPersistence` makes state file testing trivial — no filesystem cleanup needed
- `MockSessionManager` creates fake sessions that emit programmable events
- Tests cover: every state transition (valid and invalid), claim race conditions, AC verification (missing commit), failsafe (recent comment vs. no comment), inception artifact verification, crash recovery (tracked-dead + live-untracked)

---

## 12. Pipeline Flow

### 12.1 Inception (sequential, 8 phases)

Each phase spawns an agent session that must produce a concrete artifact (via `forge_create_artifact`) before the next phase begins. Completion is verified by the engine querying the board document, not by agent self-report or filesystem check.

| Phase | Name | Agent | Output Artifact |
|-------|------|-------|-----------------|
| 1 | Lean Canvas | Product Owner | `docs/lean-canvas.md` |
| 2 | Context / Empathy Map | Product Owner | `docs/context.md` |
| 3 | Trade-off Sliders | Product Owner | `docs/trade-offs.md` |
| 4 | Event Storming | Product Owner → UX | `docs/event-storm.md` |
| 5 | UX Design System | UX Agent | `design-system/MASTER.md` |
| 6 | Story Writing | Product Owner | Board issues created |
| 7 | Tech Stack & Architecture | Architect | `docs/adr/ADR-001.md`, `ADR-002.md` |
| 8 | Iteration Mapping | Iteration Planner | Board projects/milestones created |

After Phase 8, Forge transitions automatically to development mode.

### 12.2 Development (continuous, parallel)

Stories are pulled, not assigned. The engine polls the board for stories in "pull states." When it finds one, it claims the story (optimistic lock via state transition serialized through FIFO queue), creates an agent session, and injects a prompt with story context + handoff comment + skill loop contract.

```
ready-for-dev → in-dev → in-deskcheck → ready-for-qa → in-qa → ready-for-acceptance → in-acceptance → ready-to-deploy → done
```

Four halt states catch failures: `halted-stall`, `halted-ambiguous`, `halted-human-gate`, `halted-unsafe`.

---

## 13. Key Mechanisms

### 13.1 Pull-based work with optimistic locking
Stories are pulled from the board, not assigned centrally. A story is claimed by transitioning its state to an agent's `activeState` — serialized through the FIFO queue to prevent double-claiming. Backpressure: configurable concurrency cap blocks new claims when the limit is reached.

### 13.2 Artifact-driven inception completion
Inception phases advance only when the board document (Linear Document) exists and has content. An agent that claims completion without calling `forge_create_artifact` does not advance. No artifact → phase not retried automatically → human intervenes.

### 13.3 Failsafe state management
When a dev session settles without calling `forge_handoff`, the engine checks whether any board comment was posted after `sessionStartTime`. Recent comment → auto-advance. No comment but `forge_complete_ac` was called → auto-advance. Nothing → halt as `halted-ambiguous`.

### 13.4 Two-sided crash recovery
On startup, the engine reconciles tracked sessions vs. live sessions. Structured JSON metadata is the primary tracking mechanism. Session title parsing is a fallback for orphans not in the tracking map.

### 13.5 Guardian pre-flight (every iteration)
Before every loop iteration, a guardian checks: board/loop-state consistency, stall counter, iteration counter, wall-clock budget, and git commit existence. An AC marked GREEN without a matching `feat({STORY-ID}): AC{n}` commit is halted as `halted-stall`. In v2, the commit check is also enforced server-side by `forge_complete_ac`.

### 13.6 Recovery model: test reality over intent
When resuming after a crash, the agent runs the outer Acceptance Test before reading plan files or conversation summaries. RED → resume from last completed sub-slice. GREEN unexpectedly → story was actually complete. "Only test results determine reality; never trust the plan file."

### 13.7 Compaction context injection
When an agent's context is compacted, the engine injects: story ID, board state, agent name, pointer to loop state file, and the instruction "This is an autonomous recovery — do NOT wait for human."

### 13.8 Skill precedence hierarchy
Three override levels:
- **L1-RIGID** (resuming-sessions, running-atdd-sessions, running-tdd-loops, guarding-loops) — overrides everything
- **L2-GUIDED** — structured processes with mandatory human gates
- **L3-MECH** — mechanical execution, no decisions

### 13.9 Commit-per-AC protocol
After each AC turns GREEN: `git add → commit → push` with message `feat({STORY-ID}): AC{n} — {summary}`. The engine verifies the commit exists before recording AC completion. No commit = no proof of progress = halt.

---

## 14. Persistence

| Store | Format | Purpose |
|-------|--------|---------|
| Board (Linear) | Workflow states | Single source of truth for story state — the spine |
| Board documents | Markdown docs | Inception artifacts (authoritative) |
| `.forge/project-state.json` | JSON | Mode (inception/development) + inception phase cursor |
| `.forge/sessions.json` | JSON | Mirror of active sessions map — survives engine reload |
| `.forge/linear-auth.json` | JSON | OAuth credentials (per-project) |
| `stories/{STORY-ID}.loop.md` | Structured MD | Per-story loop state: current loop, stall counter, guardian checks |
| `docs/inception.loop.md` | Structured MD | Inception loop state: current phase, completed artifacts, pending approvals |
| `docs/iteration-board.loop.md` | Structured MD | Iteration board: active stories, completed stories, human gates |
| Filesystem `docs/` | Markdown files | Inception artifacts (convenience cache of board documents) |

All `.forge/` state is defensive: missing files default to sane empty state, corrupt files fall back gracefully. **Board wins on conflict** — local state files are a cache, not an authority.

All persistence goes through the `Persistence` interface, enabling `FilePersistence` (production) or `MemoryPersistence` (testing).

---

## 15. Setup Flow (forge init)

```
$ cd my-project
$ forge init

1. Pre-login: Opens linear.app/login in browser
   → User logs in, switches workspace, presses Enter

2. OAuth flow: Opens authorize URL with PKCE
   → User approves admin scope
   → Token exchanged, saved to .forge/linear-auth.json

3. Team discovery: Queries listTeams()
   → If 1 team: auto-select
   → If multiple: numbered list, user selects
   → Saves team_id, team_name to forge.yaml

4. Config: Creates forge.yaml from template

5. Agent/skill installation:
   → Copies bridge extension to .pi/extensions/forge-bridge.ts (thin import)
   → Copies skills/ to .pi/agent/skills/
   → Copies agents/ to .pi/agent/agents/

6. Done: "Forge initialized! Run 'pi' to start."
```

The bridge extension file is a thin import:
```typescript
// .pi/extensions/forge-bridge.ts
import forgeBridge from "@loopworx/forge";
export default forgeBridge;
```

When `npm update -g @loopworx/forge` is run, the bridge automatically uses the new version. No manual file copying of engine code.

---

## 16. Security Model

- Role isolation via permission-scoped agents (deny-by-default skill allowlists)
- Security ACs injected during story writing (not bolted on later)
- Threat modeling runs on every story after writing
- CI pipeline gets SAST, DAST, dependency scanning, secret detection in iteration zero
- Four halt states include `halted-unsafe` for threat-model-flagged stories
- Human gates: numbered gates 5 (human-gate), 6 (ambiguous), 7 (unsafe) are the escalation surface
- The `tool_call` event blocks agents from accessing the board directly — only `forge_*` custom tools are allowed

---

## 17. Human Involvement Points

1. **`forge init`** — zero-config setup: OAuth, team selection, plugin install
2. **`/forge new project`** — starts inception flow
3. **Human gates** — security reviews, architecture approvals, iteration sign-off
4. **Halt triage** — `halted-ambiguous` stories need manual board intervention
5. **Iteration PO gate** — agents never start the next iteration autonomously

---

## 18. Addressing v1 Weaknesses

| v1 Weakness | v2 Fix |
|-------------|--------|
| W1: No unit tests on orchestration | Engine is pure TypeScript with zero harness deps. All methods testable with mock interfaces. `FakeClock` makes failsafe deterministic. |
| W2: Linear is single point of failure | `StoryRepository` interface — could swap to another board provider. Retry logic is in the implementation, not the engine. |
| W3: State mutation not transactional | FIFO queue serializes all mutations. `sessionStartTime` captured before prompt. |
| W4: Comment-based failsafe is heuristic | Improved: if `forge_complete_ac` was called but `forge_handoff` wasn't, that's partial progress → auto-advance. |
| W5: Sequential inception bottleneck | Acknowledged, not fixed. Inception is inherently sequential. |
| W6: No inter-story dependency modeling | Acknowledged, future enhancement. |
| W7: Halting is a dead end | `halted-*` states can transition back to active states (manual un-halt). |
| W8: Session title convention fragile | Structured JSON metadata is primary. Title parsing is fallback. Test asserts they stay in sync. |
| W9: Limited runtime reconfigurability | `Config` interface — could implement hot-reload config. |

| v1 Threat | v2 Mitigation |
|-----------|---------------|
| T3: State drift (Linear vs filesystem) | Dual-write to Linear Documents (authoritative). Engine verifies via board, not filesystem. |
| T7: Race conditions in concurrent claims | Single-writer FIFO queue serializes all board mutations. |
| T8: Fragile session-title convention | Deterministic workflow engine owns all state transitions. Structured metadata replaces title parsing as primary. Engine is testable. |
