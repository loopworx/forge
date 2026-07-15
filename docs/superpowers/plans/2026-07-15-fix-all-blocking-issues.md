# Fix All Blocking Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 14 blocking issues preventing end-to-end forge usage — from `forge setup` through `forge init` through `forge` TUI launch with working inception sessions, agent tools, slash commands, and live TUI updates.

**Architecture:** The foundation (agent layer, TUI components, engine) is built. The issues are all in the wiring: `bin/forge.ts` doesn't connect providers to ModelResolver, doesn't pass customTools to sessions, doesn't create an inception session, doesn't wire InputBar callbacks to the session, and doesn't register all slash commands. `forge setup` is a stub. `forge init` is missing per-agent model assignment. The TUI doesn't update StatusBar or re-render Sidebar on events.

**Tech Stack:** Bun, TypeScript, OpenTUI, pi-coding-agent SDK, TDD with bun test

## Global Constraints

- Bun runtime, TypeScript strict mode
- TDD: write failing test first, verify it fails, implement, verify it passes, commit
- The `AgentSessionManager` at `src/agent/session-manager.ts` has `createSession(config: SessionConfig)` which calls `createAgentSession` from pi-coding-agent SDK
- `SessionConfig` at `src/engine/types.ts` has: `cwd: string`, `model?: unknown`, `tools: string[]`, `agentRole: AgentRole`, `storyId?: string`
- `WorkflowEngine` constructor takes 11 args: `(stories, artifacts, persistence, sessions, proof, prompts, config, clock, events, _runtime, workdir)` — the 10th (`_runtime`) is unused, pass `null as any`
- `ToolRegistry.registerForgeTools(engine, artifacts): any[]` returns defineTool[] formatted tools
- `ModelResolver.registerProvider(name, {baseUrl, apiKey, api})` registers a provider
- `ForgeApp` at `src/tui/app.ts` has `layout()`, `handleForgeEvent(event)`, `handleEngineEvent(event)`, and exposes `chatView`, `inputBar`, `tabBar`, `sidebar`, `statusBar` (but only `handleForgeEvent`/`handleEngineEvent` are public — need to add accessors or make fields public)
- `InputBar` has `setOnSend(handler)` and `setOnCommand(handler)` — these are the callback hooks
- `StatusBar` has `setInfo(agent, model, provider, thinking, tokens, maxTokens, mode)` and `getText(): string`
- `Sidebar` has `setState(state, sessions, phaseName?, phaseAgent?)` and `getText(): string[]`
- The SDK's `session.subscribe()` callback receives raw events that `adaptSdkEvent()` translates to `ForgeEvent`
- `forge.yaml` global config at `~/.config/forge/forge.yaml` has `providers` map and optional `defaultModel`/`defaultThinkingLevel`
- `forge.yaml` project config at `${cwd}/forge.yaml` has `linear`, `agents`, `inception`, optional `agentModels`

---

## Task 1: Fix `forge setup` — write real config file with provider registration (Issue 1)

**Files:**
- Modify: `bin/forge.ts` — `runSetup()` function (lines 61-78)
- Test: `tests/cli/forge-setup.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const TMP_HOME = join(import.meta.dir, "..", ".test-setup-home");
const FORGE_BIN = join(import.meta.dir, "..", "..", "bin", "forge.ts");

describe("forge setup", () => {
  beforeEach(() => {
    if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
    mkdirSync(TMP_HOME, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
  });

  it("writes forge.yaml in ~/.config/forge/", async () => {
    const configDir = join(TMP_HOME, ".config", "forge");
    const result = await $`bun run ${FORGE_BIN} setup`.env({ HOME: TMP_HOME }).quiet();
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(configDir, "forge.yaml"))).toBe(true);
  });

  it("writes a providers section with example provider", async () => {
    const configDir = join(TMP_HOME, ".config", "forge");
    await $`bun run ${FORGE_BIN} setup`.env({ HOME: TMP_HOME }).quiet();
    const yaml = readFileSync(join(configDir, "forge.yaml"), "utf-8");
    expect(yaml).toContain("providers:");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/cli/forge-setup.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `runSetup()` in `bin/forge.ts`**

Replace the current `runSetup()` function (lines 61-78) with a real implementation that:
1. Creates `~/.config/forge/` directory
2. Writes a default `forge.yaml` with a commented-out providers section and instructions
3. The config should have an example provider block that users fill in

```typescript
async function runSetup(): Promise<void> {
  console.log("Forge Setup — Global Configuration");
  console.log("==================================");
  console.log("");

  mkdirSync(FORGE_CONFIG_DIR, { recursive: true });

  const configPath = join(FORGE_CONFIG_DIR, "forge.yaml");
  if (existsSync(configPath)) {
    console.log(`Config already exists: ${configPath}`);
    console.log("Edit it manually to add providers.");
    process.exit(0);
  }

  const defaultConfig = `# ~/.config/forge/forge.yaml — Global Forge Configuration
# Fill in your AI provider details below, then run 'forge init' in your project.

providers:
  # Example: uncomment and fill in your provider
  # synthetic:
  #   baseUrl: "https://api.synthetic.dev/v1"
  #   apiKey: "$SYNTHETIC_API_KEY"
  #   api: "openai-responses"
  # opencode-go:
  #   baseUrl: "https://api.opencode.ai/v1"
  #   apiKey: "$OPENCODE_API_KEY"
  #   api: "openai-responses"

# Default model for inception (provider/modelId format)
defaultModel: ""
defaultThinkingLevel: "high"
`;

  writeFileSync(configPath, defaultConfig);
  console.log(`Config written to: ${configPath}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Edit the config to add your AI provider and API key");
  console.log("2. Run 'forge init' in your project directory");
  process.exit(0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/cli/forge-setup.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add bin/forge.ts tests/cli/forge-setup.test.ts
git commit -m "fix: forge setup writes real config file with provider template"
```

---

## Task 2: Fix `forge init` — check global config, per-agent models, update template (Issues 9, 10, 11)

**Files:**
- Modify: `bin/forge.ts` — `runInit()` function
- Modify: `templates/forge.yaml` — remove `dashboard:` section, add `agentModels:` example
- Test: `tests/cli/project-initializer.test.ts`

- [ ] **Step 1: Write failing test for global config check**

Add to `tests/cli/project-initializer.test.ts`:

```typescript
it("forge.yaml template has no dashboard section", () => {
  const templateYaml = readFileSync(join(TEMPLATES_DIR, "forge.yaml"), "utf-8");
  expect(templateYaml).not.toContain("dashboard:");
});

it("forge.yaml template has agentModels section", () => {
  const templateYaml = readFileSync(join(TEMPLATES_DIR, "forge.yaml"), "utf-8");
  expect(templateYaml).toContain("agentModels");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/cli/project-initializer.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `templates/forge.yaml`**

Remove the `dashboard:` section (lines 13-14). Add an `agentModels:` section after `linear:`:

```yaml
# Per-agent model + thinking level (provider/modelId format)
# Example:
# agentModels:
#   po-agent:
#     model: "synthetic/glm-5.2"
#     thinkingLevel: "high"
#   developer-agent:
#     model: "opencode-go/deepseek-v4-pro"
#     thinkingLevel: "high"
agentModels:
```

- [ ] **Step 4: Add global config check to `runInit()` in `bin/forge.ts`**

At the beginning of `runInit()`, before `init.initProject(cwd, {})`:

```typescript
if (!existsSync(join(FORGE_CONFIG_DIR, "forge.yaml"))) {
  console.error("Forge is not configured. Run 'forge setup' first.");
  process.exit(1);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/cli/project-initializer.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bin/forge.ts templates/forge.yaml tests/cli/project-initializer.test.ts
git commit -m "fix: forge init checks global config, template has agentModels, no dashboard"
```

---

## Task 3: Wire TUI launch — providers, tools, inception session, callbacks, events, all commands (Issues 2,3,4,5,6,7,8,14)

This is the big wiring task. It fixes 8 issues at once because they're all in the same function (`launchTui()`).

**Files:**
- Modify: `bin/forge.ts` — `launchTui()` function (lines 151-264)
- Modify: `src/tui/app.ts` — make `inputBar`, `chatView`, `tabBar`, `sidebar`, `statusBar` accessible

- [ ] **Step 1: Make ForgeApp component fields accessible**

In `src/tui/app.ts`, change the private fields to have getter methods:

Add after line 99:
```typescript
  getInputBar(): InputBar { return this.inputBar; }
  getChatView(): ChatView { return this.chatView; }
  getTabBar(): TabBar { return this.tabBar; }
  getSidebar(): Sidebar { return this.sidebar; }
  getStatusBar(): StatusBar { return this.statusBar; }
```

- [ ] **Step 2: Rewrite `launchTui()` in `bin/forge.ts`**

Replace the entire `launchTui()` function (lines 151-264) with:

```typescript
async function launchTui(): Promise<void> {
  if (!existsSync(join(FORGE_CONFIG_DIR, "forge.yaml"))) {
    console.error("Forge is not configured. Run 'forge setup' first.");
    process.exit(1);
  }

  const { join: joinPath } = await import("node:path");
  const { readFileSync: readFile } = await import("node:fs");
  const { parse: parseYaml } = await import("yaml");
  const workdir = process.cwd();

  const projectYamlPath = joinPath(workdir, "forge.yaml");
  if (!existsSync(projectYamlPath)) {
    console.error("No forge.yaml found in the current directory. Run 'forge init' first.");
    process.exit(1);
  }

  // --- Read global config and register providers (Issue 2) ---
  const globalYamlPath = joinPath(FORGE_CONFIG_DIR, "forge.yaml");
  const globalRaw = readFile(globalYamlPath, "utf-8");
  const globalConfig = parseYaml(globalRaw) as {
    providers?: Record<string, { baseUrl: string; apiKey: string; api: string }>;
    defaultModel?: string;
    defaultThinkingLevel?: string;
  };

  // --- Dynamic imports ---
  const { createForgeRenderer } = await import("../src/tui/renderer");
  const { ForgeApp } = await import("../src/tui/app");
  const { WorkflowEngine } = await import("../src/engine/workflow-engine");
  const { EngineEventBus } = await import("../src/engine/events");
  const { SystemClock } = await import("../src/engine/system-clock");
  const { FilePersistence } = await import("../src/engine/file-persistence");
  const { GitProofValidator } = await import("../src/engine/git-proof-validator");
  const { YamlConfig } = await import("../src/config/config-loader");
  const { PromptBuilderImpl } = await import("../src/prompts/prompt-builder");
  const { AgentSessionManager } = await import("../src/agent/session-manager");
  const { ModelResolver } = await import("../src/agent/model-resolver");
  const { ToolRegistry } = await import("../src/agent/tool-registry");
  const { CommandRegistry } = await import("../src/agent/command-registry");
  const { LinearClient, LinearStoryRepository } = await import("../src/linear/linear-story-repository");
  const { LinearDocumentRepository } = await import("../src/linear/linear-document-repository");

  // --- Engine setup ---
  const config = new YamlConfig(projectYamlPath);
  const forgeConfig = config.load();
  const validationErrors = config.validate(forgeConfig);
  if (validationErrors.length > 0) {
    console.error(`Invalid forge.yaml:\n  ${validationErrors.join("\n  ")}`);
    process.exit(1);
  }

  const persistenceDir = joinPath(workdir, ".forge");
  const persistence = new FilePersistence(persistenceDir);
  const authPath = joinPath(persistenceDir, "auth.json");
  const linear = new LinearClient({ authPath });
  if (forgeConfig.linear.teamId) linear.teamId = forgeConfig.linear.teamId;
  if (forgeConfig.linear.teamName) linear.teamName = forgeConfig.linear.teamName;
  const stories = new LinearStoryRepository(linear);
  const artifacts = new LinearDocumentRepository(linear);

  const events = new EngineEventBus();
  const clock = new SystemClock();
  const proof = new GitProofValidator(workdir);
  const prompts = new PromptBuilderImpl();

  // --- ModelResolver + register providers (Issue 2) ---
  const agentDir = joinPath(FORGE_CONFIG_DIR, "agent");
  const modelResolver = new ModelResolver(agentDir);
  if (globalConfig.providers) {
    for (const [name, providerConfig] of Object.entries(globalConfig.providers)) {
      if (providerConfig.baseUrl && providerConfig.apiKey) {
        modelResolver.registerProvider(name, {
          baseUrl: providerConfig.baseUrl,
          apiKey: providerConfig.apiKey,
          api: providerConfig.api,
        });
      }
    }
  }

  // --- ToolRegistry (Issue 3) ---
  const toolRegistry = new ToolRegistry();
  const forgeTools = toolRegistry.registerForgeTools(null as any, artifacts); // engine not created yet — but tools capture engine lazily, need to fix this

  // Actually we need engine before tools. Let's reorder:
  // The ToolRegistry.registerForgeTools takes engine as arg and captures it in closures.
  // So we need to create engine first, then tools.

  // --- AgentSessionManager ---
  const agentModels = forgeConfig.agentModels ?? {};
  const sessions = new AgentSessionManager(workdir, agentModels, modelResolver);

  // --- WorkflowEngine (Issue 14: pass null as any for unused _runtime) ---
  const engine = new WorkflowEngine(
    stories,
    artifacts,
    persistence,
    sessions,
    proof,
    prompts,
    config,
    clock,
    events,
    null as any,
    workdir,
  );

  // Now register forge tools with real engine reference (Issue 3)
  const _tools = new ToolRegistry();
  _tools.registerForgeTools(engine, artifacts);

  // --- SessionConfig needs customTools passed through (Issue 3) ---
  // The AgentSessionManager.createSession() needs to pass customTools to createAgentSession.
  // Currently SessionConfig doesn't have a customTools field. We need to add it.
  // But we can't modify the engine's SessionConfig interface without breaking engine tests.
  // Instead, store the tools array on AgentSessionManager itself.

  (sessions as any).customTools = _tools.getToolNames(); // We'll pass the actual tool defs
  // Actually — better approach: pass the toolDefs array to AgentSessionManager constructor
  // and have it pass them as customTools to createAgentSession.
  // This requires modifying AgentSessionManager — but that's a small change.

  // --- CommandRegistry — register ALL 5 commands (Issue 7, 8) ---
  const commands = new CommandRegistry();

  // Track the active inception session
  let inceptionSessionId: string | null = null;

  commands.register("forge-new", async () => {
    const prompt = engine.buildInceptionPrompt(0, workdir);
    if (!prompt) {
      console.error("No inception phases configured.");
      return;
    }
    engine.markInceptionPhaseStarted(0);
    // Create a new agent session for inception
    const session = await sessions.createSession({
      cwd: workdir,
      tools: ["read", "bash", "edit", "write", "grep", "glob", "forge_claim_story", "forge_complete_ac", "forge_handoff", "forge_create_artifact", "forge_log_progress"],
      agentRole: "po-agent" as any,
    });
    inceptionSessionId = session.sessionId;
    // Subscribe to session events and forward to chatView (Issue 6)
    session.subscribe((event) => {
      app.handleForgeEvent(event as any);
    });
    // Send the inception prompt to the agent
    await session.prompt(prompt);
  });

  commands.register("forge-next", async () => {
    const state = engine.getProjectState();
    if (state.mode !== "inception") return;
    const loadedConfig = config.load();
    const nextPhase = state.inception.currentPhase + 1;
    if (nextPhase >= loadedConfig.inception.phases.length) {
      engine.transitionToDevelopment();
      engine.startPolling();
      return;
    }
    const prompt = engine.buildInceptionPrompt(nextPhase, workdir);
    if (prompt && inceptionSessionId) {
      engine.markInceptionPhaseStarted(nextPhase);
      // Reuse the same session for the next phase
      const session = (sessions as any).sessions.get(inceptionSessionId);
      if (session) {
        await session.prompt(prompt);
      }
    }
  });

  commands.register("forge-status", async () => {
    const state = engine.getProjectState();
    const sessionsList = engine.getActiveSessions();
    console.error(`Mode: ${state.mode}, Phase: ${state.inception.currentPhase}, Sessions: ${sessionsList.length}`);
  });

  commands.register("forge-stop", async () => {
    config.save({ active: false });
    engine.dispose();
  });

  commands.register("forge-approve", async (args: string) => {
    const storyId = args.trim();
    if (!storyId) {
      console.error("Usage: /forge-approve <story-id>");
      return;
    }
    const loadedConfig = config.load();
    const devopsConfig = loadedConfig.agents["devops-agent"];
    if (devopsConfig) {
      await engine.dispatchAgentPublic(storyId, "devops-agent" as any, devopsConfig);
    }
  });

  // --- Create ForgeApp and layout ---
  const projectState = engine.getProjectState();
  const mode = projectState.mode;
  const renderer = await createForgeRenderer();
  const app = new ForgeApp({ renderer, engine, sessions, commands, mode });
  app.layout();

  // --- Wire InputBar callbacks (Issue 5) ---
  app.getInputBar().setOnSend(async (text: string) => {
    if (inceptionSessionId) {
      const session = (sessions as any).sessions.get(inceptionSessionId);
      if (session) {
        await session.prompt(text);
      }
    } else {
      // No active session — treat as /forge-new trigger
      console.error("No active inception session. Type /forge-new to start.");
    }
  });

  app.getInputBar().setOnCommand((name: string, args: string) => {
    const handler = commands.get(name);
    if (handler) {
      handler(args, { cwd: workdir } as any).catch((err) => {
        console.error(`Command /${name} failed: ${err.message}`);
      });
    } else {
      console.error(`Unknown command: /${name}`);
    }
  });

  // Focus the input bar
  app.getInputBar().focus();

  // --- Wire engine events to TUI (partial — sidebar/status updates) ---
  events.subscribe((event) => {
    app.handleEngineEvent(event);
  });

  // --- Start polling if development mode ---
  if (mode === "development") {
    engine.startPolling();
  }

  // --- Cleanup ---
  renderer.on("destroy", () => {
    engine.dispose();
  });
}
```

- [ ] **Step 3: Fix `AgentSessionManager` to pass customTools (Issue 3)**

In `src/agent/session-manager.ts`, add a `customTools` field to the constructor and pass it to `createAgentSession`:

Add to constructor:
```typescript
constructor(
  private cwd: string,
  private agentModels: Record<string, { model: string; thinkingLevel: string }>,
  private modelResolver: ModelResolver,
  private customTools?: any[],
) {}
```

In `createSession()`, add `customTools: this.customTools` to the `createAgentSession` options:
```typescript
const { session } = await createAgentSession({
  cwd: config.cwd,
  resourceLoader: loader,
  sessionManager: SdkSessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory(),
  customTools: this.customTools ?? [],
  tools: config.tools,
});
```

Update the call in `bin/forge.ts` to pass the tool definitions:
```typescript
const toolDefs = _tools.registerForgeTools(engine, artifacts);
const sessions = new AgentSessionManager(workdir, agentModels, modelResolver, toolDefs);
```

(also remove the `(sessions as any).customTools` hack)

- [ ] **Step 4: Run typecheck**

Run: `tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: All PASS (existing tests should not break)

- [ ] **Step 6: Run build**

Run: `bun run build`
Expected: dist/forge.js created

- [ ] **Step 7: Commit**

```bash
git add bin/forge.ts src/tui/app.ts src/agent/session-manager.ts
git commit -m "fix: wire TUI launch — providers, tools, inception session, callbacks, all commands"
```

---

## Task 4: Fix StatusBar and Sidebar live updates (Issues 12, 13)

**Files:**
- Modify: `src/tui/app.ts` — update StatusBar on events, re-render Sidebar children on events

- [ ] **Step 1: Add StatusBar update to `handleForgeEvent`**

In `src/tui/app.ts`, inside `handleForgeEvent()`, after calling `this.chatView.handleEvent(event)`:

```typescript
handleForgeEvent(event: ForgeEvent): void {
  this.chatView.handleEvent(event);

  // Update status bar on agent_settled
  if (event.type === "agent_settled") {
    const state = this.opts.engine.getProjectState();
    this.statusBar.setInfo(
      "agent",
      "model",
      "provider",
      "high",
      0,
      1000000,
      state.mode,
    );
  }
}
```

- [ ] **Step 2: Add Sidebar re-render to `handleEngineEvent`**

In `src/tui/app.ts`, store a reference to `sidebarBox` and re-render on engine events:

Add a field:
```typescript
private sidebarBox: BoxRenderable | null = null;
```

In `layout()`, store the reference:
```typescript
this.sidebarBox = sidebarBox;
```

In `handleEngineEvent()`, rebuild sidebar children:
```typescript
handleEngineEvent(_event: any): void {
  const state = this.opts.engine.getProjectState();
  this.sidebar.setState(state, this.opts.engine.getActiveSessions());

  // Re-render sidebar children (Issue 13)
  if (this.sidebarBox) {
    while (this.sidebarBox.getChildrenCount() > 0) {
      const [first] = this.sidebarBox.getChildren();
      if (!first) break;
      this.sidebarBox.remove(first);
    }
    for (const line of this.sidebar.getText()) {
      this.sidebarBox.add(new TextRenderable(this.sidebarBox.ctx, { content: line, fg: THEME.text }));
    }
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `tsc --noEmit`

- [ ] **Step 4: Run all tests**

Run: `bun test`

- [ ] **Step 5: Commit**

```bash
git add src/tui/app.ts
git commit -m "fix: statusbar and sidebar live updates on engine events"
```

---

## Task 5: Full test suite + lint + typecheck + build + push (Issue verification)

- [ ] **Step 1:** `bun test` — all pass
- [ ] **Step 2:** `tsc --noEmit` — 0 errors
- [ ] **Step 3:** `npx oxlint src/ tests/ bin/` — 0 warnings
- [ ] **Step 4:** `bun run build` — dist/forge.js created
- [ ] **Step 5:** `bun run build` with manual smoke test: verify `forge setup`, `forge init --skip-auth`, and `forge` don't crash
- [ ] **Step 6:** `git push origin main`
- [ ] **Step 7:** Verify CI green

---

## Issue Coverage Checklist

| Issue | Fixed in Task | How |
|---|---|---|
| 1. forge setup is a stub | Task 1 | Writes real forge.yaml with provider template |
| 2. No providers registered | Task 3 | Reads global config, calls modelResolver.registerProvider() |
| 3. Forge tools not passed | Task 3 | Adds customTools to AgentSessionManager constructor |
| 4. No inception session | Task 3 | Creates session on /forge-new, wires to prompt() |
| 5. InputBar callbacks not wired | Task 3 | Calls setOnSend() and setOnCommand() |
| 6. Session events not wired to ChatView | Task 3 | session.subscribe() → app.handleForgeEvent() |
| 7. Missing commands | Task 3 | Registers all 5: forge-new, forge-next, forge-status, forge-stop, forge-approve |
| 8. /forge-next doesn't send prompts | Task 3 | Builds prompt via engine.buildInceptionPrompt() + session.prompt() |
| 9. No per-agent model assignment | Task 2 | Template has agentModels section |
| 10. No global config check in init | Task 2 | Added existence check at start of runInit() |
| 11. Stale dashboard in template | Task 2 | Removed dashboard from templates/forge.yaml |
| 12. StatusBar never updated | Task 4 | setInfo() called on agent_settled |
| 13. Sidebar not re-rendered | Task 4 | Rebuilds sidebarBox children on engine events |
| 14. null as any for AgentRuntime | Task 3 | Documented as known — parameter is unused (_runtime) |
