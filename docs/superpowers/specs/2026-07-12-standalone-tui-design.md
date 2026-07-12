# Forge v0.3: Standalone TUI Design

**Date**: 2026-07-12  
**Status**: Approved  
**Author**: Forge Team  

## Overview

Forge evolves from a pi.dev extension into a standalone CLI tool. Users install `@loopworx/forge` globally and run `forge` directly — no pi.dev installation required. The TUI is built with OpenTUI (`@opentui/core`), the same library OpenCode uses. Agent execution uses `@earendil-works/pi-coding-agent` SDK in headless mode (`createAgentSession`).

## Goals

1. **One install** — `bun add -g @loopworx/forge` gives users everything: TUI, agent runtime, skills, Linear integration
2. **Full-screen TUI** — polished like OpenCode: markdown rendering, syntax highlighting, streaming, autocomplete
3. **Two modes** — Inception (interactive, human + agent) and Development (autonomous agents, steerable)
4. **Per-agent models** — each agent role uses its own model/provider/thinking level
5. **No pi.dev dependency** — forge owns the full stack from TUI to agent execution

## Non-Goals

- Mempalace integration (noted as future, not built now)
- SQLite/Turso persistence (FilePersistence/JSON sufficient for current state)
- Forking the agent loop (we use pi-coding-agent SDK as-is)

## Architecture

### Module Structure

```
bin/forge.ts              — CLI entry: `forge init` | `forge setup` | `forge` (TUI)
src/
  tui/                    — OpenTUI-based terminal UI (replaces dashboard/ + bridge/)
    renderer.ts           — createCliRenderer, alternate-screen mode, lifecycle
    app.ts                — Top-level app controller, mode switching (inception/dev)
    chat-view.ts          — ScrollBox with Markdown rendering of conversation
    input-bar.ts          — Textarea with slash command autocomplete + file completion
    sidebar.ts            — Right sidebar: phase, agent, sessions, guardians
    tab-bar.ts            — Session tabs (development mode only)
    status-bar.ts         — Bottom bar: agent, model, provider, thinking, tokens
  agent/                  — pi-coding-agent SDK wrapper (replaces bridge/)
    session-manager.ts    — createAgentSession (headless), event subscription
    tool-registry.ts       — forge_claim_story etc. via defineTool (customTools)
    command-registry.ts    — /forge-new, /forge-next, /forge-status, /forge-stop, /forge-approve
    event-adapter.ts      — Translates SDK events (message_update→text_delta, etc.)
    model-resolver.ts     — Reads config, registers providers, resolves per-agent models
  engine/                 — UNCHANGED
  linear/                 — UNCHANGED
  config/                 — UNCHANGED (YamlConfig, config-loader)
  prompts/                — UNCHANGED (PromptBuilder)
  cli/                    — UNCHANGED (ProjectInitializer) + new SetupWizard
templates/                — UNCHANGED (skills, agent profiles, forge.yaml template)
```

### What Gets Deleted

- `src/bridge/` entirely (pi-bridge.ts, pi-dev-runtime.ts, pi-dev-session-manager.ts, create-pi-composition.ts)
- `src/dashboard/` entirely (all dashboard components)
- `tests/bridge/` and `tests/dashboard/`
- `tests/integration/engine-dashboard-flow.test.ts` (rewrite without dashboard deps)

### What Stays Unchanged

- `src/engine/` — WorkflowEngine, types, interfaces, state-machine, claim-queue, persistence, clock, config-loader, git-proof-validator, session-manager interface
- `src/linear/` — LinearClient, StoryRepository, DocumentRepository, OAuth
- `src/config/` — YamlConfig
- `src/prompts/` — PromptBuilder
- `src/cli/` — ProjectInitializer (updated for new init flow)
- `templates/` — skills, agent profiles, forge.yaml

### Data Flow

```
User types in InputBar
  → App checks: slash command (/forge-*) or regular message?
  → Slash command → CommandRegistry dispatches → WorkflowEngine action
  → Regular message → AgentSessionManager.prompt(text)
    → pi-coding-agent SDK streams response
    → session.subscribe() events fire:
      → message_update (text_delta) → EventAdapter → ChatView appends text
      → tool_execution_start → ChatView shows spinner
      → tool_execution_end → ChatView clears spinner
      → agent_settled → InputBar re-enables, Sidebar updates
    → If tool is forge_claim_story etc. → ToolRegistry executes → WorkflowEngine
    → If story claimed → engine emits session_created → App switches to dev mode
```

## TUI Design

### Visual Language (inspired by OpenCode)

- **Left-only borders** with custom `╹` cap glyphs for messages and prompt
- **Markdown rendering** with concealment (hide `**`, backticks; show rendered bold/italic/headings/lists/tables/code blocks)
- **Tree-sitter syntax highlighting** in code blocks via OpenTUI's Code component
- **Streaming-native**: `MarkdownRenderable` in `streaming` mode with `internalBlockMode="top-level"`
- **Sticky scroll bottom** on conversation ScrollBox — auto-pins to bottom, pauses when user scrolls up
- **Agent-colored identity**: prompt's left border takes the active agent's color
- **Background hierarchy**: `background` (terminal) → `backgroundPanel` (sidebar) → `backgroundElement` (hover/active)
- **Spinner**: "blocks" frame style, 40ms interval, alpha fading — for tool calls and "thinking" state
- **Theme**: Semantic color system (~30 named colors). Default dark theme (tokyo-night-like). Support `system` theme that auto-generates from terminal palette.

### Inception Mode Layout

```
┌──────────────────────────────────────────┬─────────────┐
│                                          │  Forge      │
│ ╹ Welcome to Phase 1 — Lean Canvas      │  ────────   │
│ ╹ I'll walk you through the 9 blocks... │  Inception  │
│ ╹                                       │  Phase 1/8  │
│ ╹ > What product are you building?      │  Lean Canvas│
│ ╹                                       │  (po-agent) │
│ ╹ A task automation tool                │  ────────   │
│ ╹                                       │  Guardians  │
│ ╹ Great! Let's explore...               │  OK         │
│  ⚙ bash...                               │             │
├──────────────────────────────────────────┴─────────────┤
│ ╹  > _                                                  │
│ ╹  po-agent · glm-5.2 synthetic · high                  │
├────────────────────────────────────────────────────────┤
│ ~/projects/test-app · inception                        │
└────────────────────────────────────────────────────────┘
```

- **Conversation** (left, flexGrow=1): `ScrollBox` with `stickyScroll=true, stickyStart="bottom"`. Messages as Markdown with concealment. User messages have left border in agent color. Agent responses render as full markdown. Tool calls show as `⚙ toolName...` spinner, auto-hide on success, show error on failure.
- **Sidebar** (right, width=28, auto-show when >120 cols): `backgroundPanel`. Shows mode, phase, agent, guardians. Collapsible via `Ctrl+X B`.
- **Input bar** (bottom, left-bordered in agent color): `TextareaRenderable` — multi-line, grows up to 1/3 screen. Enter submits, Shift+Enter newline. `/` triggers inline autocomplete popup.
- **Status row** (below input): agent name (orange) · model (white) provider (light gray) · thinking level (orange)
- **Footer** (height=1): cwd · mode. Minimal.

### Development Mode Layout

```
┌──────────────────────────────────────────┬─────────────┐
│ *FOR-5 dev  FOR-8 qa       (auto)         │  Forge      │
├──────────────────────────────────────────┤  ────────   │
│ ╹ [FOR-5 — developer-agent]              │  Development│
│ ╹ Working on the auth module...          │  Sessions: 2│
│  ⚙ forge_claim_story...                  │  FOR-5 dev  │
│ ╹ Claimed story FOR-5                    │  FOR-8 qa   │
│ ╹                                       │  ────────   │
│ ╹ Now implementing the login flow...    │  Guardians  │
│                                          │  OK         │
├──────────────────────────────────────────┴─────────────┤
│ ╹  > [FOR-5] steer: _                                  │
│ ╹  developer-agent · deepseek-v4-pro opencode-go · high│
├────────────────────────────────────────────────────────┤
│ ~/projects/test-app · development · 2 sessions         │
└────────────────────────────────────────────────────────┘
```

- **Tab bar** (height=1): Session tabs with `*` for selected. `(auto)`/`(manual)` indicator. Arrow keys cycle. Tab toggles auto/manual.
- **Conversation**: Same rendering as inception, shows selected session's conversation. Auto-cycling switches to sessions with important activity.
- **Input bar**: Shows `[SESSION_ID]` prefix. Enter steers selected session.
- **Sidebar**: Same, but shows session list instead of phase info.

### Status Bar Format

```
po-agent · glm-5.2 synthetic · high · 12k/1M (1.2%) · inception
└orange─┘ └──white──└──light gray──┘ └orange┘ └───muted───┘
```

### Key Bindings

| Key | Action |
|---|---|
| Enter | Submit message (inception) / Steer session (dev) |
| Shift+Enter, Ctrl+Enter | Newline in input |
| `/` + text | Slash command autocomplete popup |
| `Tab` | Complete autocomplete / Toggle auto-manual (dev) |
| Arrow Up/Down | Navigate autocomplete / cycle tabs (dev) |
| `Escape` | Clear input / interrupt agent |
| `Ctrl+C` | Exit forge |
| `Ctrl+T` | Cycle models for current agent |
| `Ctrl+X T` | Cycle thinking level for current model |
| `Ctrl+X B` | Toggle sidebar |
| `Ctrl+X N` | New session (dev) |
| `Ctrl+X S` | Session list |
| `Ctrl+P` | Command palette (all commands) |

### Theme

Default dark theme (tokyo-night-like). Colors:
- `background`: terminal default (transparent)
- `backgroundPanel`: `#1a1b26` (sidebar, input bar bg)
- `backgroundElement`: `#24283b` (hover, active)
- `border`: `#3b4261` (subtle), `borderActive`: `#7aa2f7` (focused)
- `primary`: `#7aa2f7` (blue), `success`: `#9ece6a` (green), `warning`: `#e0af68` (amber), `error`: `#f7768e` (red)
- `text`: `#c0caf5`, `textMuted`: `#565f89`
- Agent colors: po=blue, architect=green, developer=cyan, qa=magenta, devops=orange, guardian=yellow

## CLI Commands

### `forge setup` — Global Configuration (run once)

```
$ forge setup

Step 1: Configure AI Providers
  Available providers:
    > Synthetic (api.synthetic.dev) — Recommended for GLM models
      OpenCode (api.opencode.ai) — Multi-model proxy
      Anthropic (api.anthropic.com) — Claude models
      OpenAI (api.openai.com) — GPT models
      OpenRouter (openrouter.ai) — Multiple providers
      Custom (enter base URL)

  Select providers (space to toggle, enter to confirm)

Step 2: API Keys
  Synthetic API Key: sk-********************
  OpenCode API Key: sk-********************

Step 3: Discovering models...
  ✓ Synthetic: 12 models discovered
  ✓ OpenCode: 8 models discovered

Step 4: Default model for interactive inception
  > synthetic/glm-5.2

Step 5: Verification
  ✓ Global config saved to ~/.config/forge/forge.yaml
  ✓ Models cached to ~/.config/forge/agent/models.json

  Forge is ready! Run `forge init` in your project directory.
```

Guard: `forge` (TUI launch) checks `~/.config/forge/forge.yaml` exists with at least one provider. If not: `Forge is not configured. Run \`forge setup\` first.`

### `forge init` — Project Initialization (per project)

```
$ forge init

Step 1: Linear Authentication (OAuth PKCE)
Step 2: Creating Linear workflow states
Step 3: Project configuration (forge.yaml, .forge/ directory)
Step 4: .gitignore (add .forge/ if not present)
Step 5: Skills (extract 24 skills to ./skills/)
Step 6: Agent profiles (extract 7 profiles to ./agents/)
Step 7: Per-agent model assignment
  Suggested:
    Agent              Model                        Thinking
    po-agent           synthetic/glm-5.2            high
    developer-agent    opencode-go/deepseek-v4-pro  high
    qa-agent           opencode-go/deepseek-v4-flash  medium
    ...
  Accept? [Y/n/edit]
Step 8: Mempalace (optional, future — skipped)
```

### .gitignore Handling

On `forge init`:
1. Check if `.gitignore` exists in project root
2. If not: create `.gitignore` with `.forge/` as first entry
3. If yes: check if `.forge` is already ignored. If not, append `\n.forge/\n`
4. Log: `Created .gitignore` or `Added .forge/ to .gitignore`

## Configuration

### Global Config (`~/.config/forge/forge.yaml`)

```yaml
providers:
  synthetic:
    baseUrl: "https://api.synthetic.dev/v1"
    apiKey: "$SYNTHETIC_API_KEY"
    api: "openai-responses"
  opencode-go:
    baseUrl: "https://api.opencode.ai/v1"
    apiKey: "$OPENCODE_API_KEY"
    api: "openai-responses"

defaultModel: "synthetic/glm-5.2"
defaultThinkingLevel: "high"
```

### Project Config (`${PROJECT}/.forge/forge.yaml`)

```yaml
linear:
  teamId: "..."
  teamName: "..."
  pollIntervalSeconds: 30

active: false
maxConcurrentStories: 1

agentModels:
  po-agent:
    model: "synthetic/glm-5.2"
    thinkingLevel: "high"
  architect-agent:
    model: "synthetic/glm-5.2"
    thinkingLevel: "high"
  developer-agent:
    model: "opencode-go/deepseek-v4-pro"
    thinkingLevel: "high"
  qa-agent:
    model: "opencode-go/deepseek-v4-flash"
    thinkingLevel: "medium"
  devops-agent:
    model: "opencode-go/deepseek-v4-pro"
    thinkingLevel: "high"
  guardian-agent:
    model: "synthetic/glm-5.2"
    thinkingLevel: "medium"

agents:
  developer-agent:
    pullStates: [ready-for-dev]
    activeState: in-dev
    primarySkill: running-atdd-sessions
    interactive: false
    humanGate: false
  qa-agent:
    pullStates: [ready-for-qa]
    activeState: in-qa
    primarySkill: running-regression-suite
    interactive: true
    humanGate: false

inception:
  phases:
    - phase: 1
      name: Lean Canvas
      skill: facilitating-inception
      agent: po-agent
      output: docs/lean-canvas.md
    # ... 8 phases total
```

### Model Auto-Discovery

`GET {provider.baseUrl}/models` (OpenAI-compatible):
- Parse `data[].id` as model ID
- Infer `reasoning` from model ID (contains "thinking", "o1", "reasoning" → true)
- Infer `contextWindow` from model metadata or fallback to 1M
- Infer `maxTokens` from model metadata or fallback to 16384
- Infer `input` types (default: `["text"]`, add "image" if model name suggests vision)
- Cache to `~/.config/forge/agent/models.json` with 24h staleness
- Fallback to hardcoded known models if `/models` endpoint unavailable

### Model Format: `provider/modelId`

Models referenced as `{providerName}/{modelId}` to disambiguate when multiple providers offer the same model ID.

## Agent Layer

### Session Manager

Uses `createAgentSession` headlessly:

```typescript
const { session } = await createAgentSession({
  cwd: workdir,
  model: resolvedModel,         // from agentModels config
  authStorage,
  modelRegistry,
  resourceLoader: forgeLoader,  // skills + forge tools, no pi.dev extensions
  sessionManager: SessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory(),
  customTools: forgeTools,
  tools: ["read", "bash", "edit", "write", "grep", "glob", ...forgeToolNames],
});
```

**Inception**: Single interactive session. `session.prompt(text)` sends user input. Subscribe to events for TUI.

**Development**: Multiple autonomous sessions via `createAgentSession` per story. Headless — TUI shows conversation via `session.subscribe()` events. User steers via `session.steer(text)`.

### Event Adapter

Translates SDK events to unified Forge events:

```typescript
type ForgeEvent =
  | { type: "text_delta"; delta: string }
  | { type: "message_end"; role: string }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_end"; toolName: string; isError: boolean }
  | { type: "agent_settled" }
  | { type: "agent_error"; message: string }
```

Fixes existing bug where SDK events were forwarded un-translated (e.g., `agent_start` vs `agent_started`, `tool_execution_*` vs `tool_call`/`tool_result`).

### Tool Registry

Forge tools via `defineTool`:

```typescript
const forgeClaimStory = defineTool({
  name: "forge_claim_story",
  label: "Claim Story",
  description: "Pull and claim the next available story for your agent role.",
  parameters: Type.Object({ agentRole: Type.String() }),
  execute: async (_id, params) => {
    const story = await engine.claimStory(params.agentRole);
    return { content: [...], details: story, isError: false };
  },
});
```

Passed as `customTools` to `createAgentSession`. No extension system needed.

### Command Registry

Slash commands handled directly in TUI:

```typescript
const commands = new Map<string, CommandHandler>();
commands.set("forge-new", forgeNewHandler);
commands.set("forge-next", forgeNextHandler);
commands.set("forge-status", forgeStatusHandler);
commands.set("forge-stop", forgeStopHandler);
commands.set("forge-approve", forgeApproveHandler);
```

TUI input bar detects `/` prefix, shows autocomplete, dispatches on Enter.

### Resource Loader

```typescript
const loader = new DefaultResourceLoader({
  cwd: workdir,
  agentDir: forgeAgentDir,    // ~/.config/forge/agent
  noExtensions: true,         // no pi.dev extensions
  noSkills: false,            // YES skills — from ./skills/
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: false,      // AGENTS.md etc.
});
```

Fixes existing bug where `noExtensions: true` was passed to `createAgentSession` (ignored) instead of `DefaultResourceLoader`.

### Auth & Model Resolution

```typescript
const authStorage = AuthStorage.create("~/.config/forge/agent");
const modelRegistry = ModelRegistry.create(authStorage, "~/.config/forge/agent/models.json");
// Register providers from global config
for (const [name, providerConfig] of Object.entries(globalConfig.providers)) {
  modelRegistry.registerProvider(name, {
    baseUrl: providerConfig.baseUrl,
    apiKey: providerConfig.apiKey,
    api: providerConfig.api,
  });
}
```

## Engine Integration

Engine module (`src/engine/`) stays **completely unchanged**. The agent layer adapts between SDK and engine.

- **Tool Registry → Engine**: Forge tools call `WorkflowEngine` methods directly (`engine.claimStory()`, `engine.completeAc()`, etc.)
- **Engine Events → TUI**: `EngineEventBus.subscribe()` feeds the TUI (`session_created` → switch to dev mode, `story_claimed` → update sidebar, etc.)
- **Session Manager → Engine**: `WorkflowEngine.dispatchAgent()` calls `AgentSessionManager.createSession()` which wraps `createAgentSession`

### Session Recovery

On `forge` launch in development mode:
1. `engine.getProjectState()` → if `mode === "development"`, read `activeSessionCount`
2. Sessions are in-memory (no persistence) — they're gone
3. Log: `N sessions were active. Re-polling Linear for stories.`
4. `engine.startPolling()` — re-claims stories from Linear

Linear is the source of truth for story state. FilePersistence stores only project mode, current phase, and (optionally) last-known session IDs for diagnostics.

## Persistence

**FilePersistence** (JSON files in `.forge/`). No SQLite/Turso.

State stored:
- `state.json`: `{ mode: "inception" | "development", currentPhase: number, activeSessions: string[] }`
- `auth.json`: Linear OAuth tokens

The `Persistence` interface is designed to support SQLite later if needed (swap implementation). No architectural change required.

## Testing Strategy

### TUI Testing — All via OpenTUI VirtualTerminal (headless renderer)

All TUI component tests use `createTestRenderer` from `@opentui/core/testing`. No real terminal output. Tests are deterministic, fast, and run in CI.

```typescript
import { createTestRenderer } from "@opentui/core/testing"
import { Text } from "@opentui/core"

const { renderer, renderOnce, captureCharFrame, mockInput, resize } =
  await createTestRenderer({ width: 80, height: 24 })

renderer.root.add(chatView)
await renderOnce()
expect(captureCharFrame()).toContain("Welcome to Phase 1")

mockInput({ name: "return" })
await renderOnce()
expect(captureCharFrame()).toContain("...")
```

**Test helpers available:**

| Helper | Purpose |
|---|---|
| `renderer` | CliRenderer instance (no real terminal) |
| `renderOnce()` | Run one render pass |
| `flush()` | Wait until scheduled rendering settles |
| `waitFor(predicate)` | Retry until condition passes |
| `waitForFrame(predicate)` | Retry against captured frame text |
| `waitForVisualIdle()` | Wait for quiet native frames |
| `captureCharFrame()` | Read current frame as text (assert on content) |
| `captureSpans()` | Read styled span lines + cursor state (assert on colors/styles) |
| `mockInput(key)` | Simulate keyboard input (KeyEvent) |
| `mockMouse(event)` | Simulate mouse input |
| `resize(width, height)` | Simulate terminal resize |

**Key principle:** Every TUI test renders to a virtual frame buffer, asserts on `captureCharFrame()` or `captureSpans()`, and simulates input via `mockInput()`. No real terminal, no flakiness, deterministic.

### Test Coverage by Layer

| Layer | Test Focus | Framework |
|---|---|---|
| `src/engine/` | Unchanged — existing tests stay | `bun test` |
| `src/agent/` | Session manager, tool registry, command registry, event adapter, model resolver | `bun test` + mocks |
| `src/tui/` | Component rendering, input handling, autocomplete, tab cycling — all via OpenTUI VirtualTerminal | `bun test` + `@opentui/core/testing` |
| `src/cli/` | `forge init`, `forge setup` flows | `bun test` + temp dirs |
| Integration | Engine → agent → tool dispatch → event flow | `bun test` + stubs |

### New Test Files

```
tests/
  agent/
    session-manager.test.ts       — createAgentSession wrapper, model resolution
    tool-registry.test.ts         — forge tools call engine correctly
    command-registry.test.ts      — slash commands dispatch to engine
    event-adapter.test.ts         — SDK events → Forge events translation
    model-resolver.test.ts        — Provider registration, model discovery, per-agent resolution
  tui/
    app.test.ts                   — Mode switching (inception ↔ development), engine event → TUI update
    chat-view.test.ts             — Conversation rendering, markdown, sticky scroll, spinner display
    input-bar.test.ts             — Text input, Enter submit, slash command autocomplete, Tab complete, Shift+Enter newline
    sidebar.test.ts               — Phase/agent/sessions/guardians rendering, collapse toggle
    tab-bar.test.ts               — Session tabs, auto/manual cycling, auto-switch on important activity
    status-bar.test.ts            — Agent (orange), model (white), provider (gray), thinking (orange), tokens, mode
    autocomplete.test.ts          — `/` triggers popup, filtering, arrow navigation, Tab complete, Enter dispatch
  cli/
    forge-setup.test.ts           — Provider setup, model discovery
    forge-init.test.ts            — Project init, per-agent model assignment, .gitignore handling
```

### What Gets Deleted

- `tests/bridge/` — all tests (bridge/ deleted)
- `tests/dashboard/` — all tests (dashboard/ deleted)
- `tests/integration/engine-dashboard-flow.test.ts` — rewritten without dashboard deps

### What Stays

- All `tests/engine/` — unchanged
- All `tests/linear/` — unchanged
- All `tests/config/` — unchanged
- All `tests/prompts/` — unchanged
- `tests/cli/project-initializer.test.ts` — updated for new init flow

## Package & Distribution

### Dependencies

```json
{
  "dependencies": {
    "@opentui/core": "^0.4.3",
    "@earendil-works/pi-coding-agent": ">=0.80.0",
    "@earendil-works/pi-ai": ">=0.80.0",
    "typebox": ">=0.32.0",
    "yaml": "^2.9.0",
    "open": "^11.0.0"
  }
}
```

Key changes from v0.2:
- `@opentui/core` added (new TUI library)
- `@earendil-works/pi-coding-agent` moves from peerDependency to dependency
- `@earendil-works/pi-tui` removed (replaced by OpenTUI)
- No peer dependencies — forge is self-contained

### Install

```bash
bun add -g @loopworx/forge
forge setup    # one-time global config
forge init     # per-project setup
forge          # launch TUI
```

### CI

Unchanged: `build → (typecheck ‖ lint) → test → release`. Auto-publish to npm.

## Future: Mempalace Integration (Noted, Not Built)

Engine event system has hook points for future mempalace integration:
- `phase_started` / `phase_completed` — capture inception decisions
- `story_claimed` / `story_halted` — capture agent patterns
- `ac_completed` — capture AC completion context
- `agent_settled` — capture session summaries

A future `--mempalace` flag would connect to a mempalace MCP server and auto-ingest these events as memories. `Persistence` interface and `EngineEventBus` already provide the hook points.
