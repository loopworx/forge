# Forge v0.3: Standalone TUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pi.dev extension architecture with a standalone CLI tool that uses OpenTUI for TUI rendering and pi-coding-agent SDK for headless agent execution.

**Architecture:** Forge becomes a standalone CLI (`forge` command). A new `src/agent/` layer wraps `createAgentSession` from `@earendil-works/pi-coding-agent` SDK in headless mode. A new `src/tui/` layer uses `@opentui/core` for full-screen terminal rendering with Yoga flexbox layout, markdown, syntax highlighting, streaming, and autocomplete. The existing `src/engine/`, `src/linear/`, `src/config/`, `src/prompts/` modules stay unchanged. `src/bridge/` and `src/dashboard/` are deleted entirely.

**Tech Stack:** Bun runtime, TypeScript strict mode, OpenTUI (`@opentui/core`), pi-coding-agent SDK (`@earendil-works/pi-coding-agent`), TypeBox schemas, YAML config, TDD with `bun test` + `@opentui/core/testing`

## Global Constraints

- Bun runtime, TypeScript strict mode (`noEmit: true`, `skipLibCheck: true`)
- TDD (RED → GREEN → REFACTOR) enforced strictly — no production code without a failing test first
- `@opentui/core` ^0.4.3 as TUI library (Zig-native + Yoga flexbox)
- `@earendil-works/pi-coding-agent` >=0.80.0 as agent SDK (headless `createAgentSession`)
- `@earendil-works/pi-ai` >=0.80.0 (transitive, model streaming)
- `typebox` >=0.32.0 for tool parameter schemas
- `@opentui/core/testing` `createTestRenderer` for ALL TUI tests (no real terminal)
- `bunfig.toml` restricts test discovery to `tests/`
- OpenTUI components use the Renderable API (`new BoxRenderable(renderer, opts)`) or Construct API (`Box({...})`) — both are fine
- Engine module (`src/engine/`) has ZERO imports from any agent/tui/cli package
- New agent/ module imports from engine/ but NOT from tui/
- New tui/ module imports from engine/ and agent/ (for types only)
- Slash commands stored in a `Map<string, CommandHandler>` for autocomplete
- Per-agent model config stored in project `.forge/forge.yaml` under `agentModels`
- Global provider config stored in `~/.config/forge/forge.yaml`
- `forge` (TUI launch) refuses to start if `~/.config/forge/forge.yaml` is missing
- `.forge/` added to `.gitignore` on `forge init`
- Skills copied from `templates/skills/` to `./.agents/skills/` on `forge init` (SDK auto-discovers from `.agents/skills/` with project trust)
- No pi.dev, pi-tui, or `.pi/extensions/` dependency
- Frequent commits after each passing test

---

## File Structure

### New Files

```
src/
  agent/
    event-adapter.ts      — Translates SDK AgentSessionEvent → ForgeEvent
    model-resolver.ts     — Reads global/project config, registers providers, resolves per-agent models
    session-manager.ts    — Wraps createAgentSession headlessly, implements engine SessionManager interface
    tool-registry.ts      — Registers forge_claim_story etc. via defineTool as customTools
    command-registry.ts   — Stores /forge-new, /forge-next etc. in a Map for TUI autocomplete + dispatch
  tui/
    theme.ts              — Semantic color constants (tokyo-night palette, agent colors)
    renderer.ts           — createCliRenderer wrapper, lifecycle (start/stop/resize)
    app.ts                — Top-level controller: mode switching, session management, event wiring
    chat-view.ts          — ScrollBox + Markdown conversation rendering, spinner for tool calls
    input-bar.ts          — TextareaRenderable, slash command autocomplete, Enter submit
    sidebar.ts            — right panel: phase, agent, sessions, guardians
    tab-bar.ts            — session tabs (dev mode), auto/manual cycling
    status-bar.ts         — bottom bar: agent (orange), model (white), provider (gray), thinking (orange)
  cli/
    setup-wizard.ts       — forge setup: provider selection, API key entry, model discovery
bin/
  forge.ts                — CLI entry: init | setup | (TUI launch)

tests/
  agent/
    event-adapter.test.ts
    model-resolver.test.ts
    session-manager.test.ts
    tool-registry.test.ts
    command-registry.test.ts
  tui/
    theme.test.ts
    chat-view.test.ts
    input-bar.test.ts
    sidebar.test.ts
    tab-bar.test.ts
    status-bar.test.ts
    app.test.ts
  cli/
    forge-setup.test.ts
```

### Modified Files

```
src/
  cli/project-initializer.ts  — Add .gitignore handling, change skills to .agents/skills/, remove .pi/extensions
  config/config-loader.ts     — Add agentModels field to ForgeConfig type, update generateForgeYaml, remove dashboard field
  engine/types.ts             — Add agentModels to ForgeConfig, add AgentModelConfig type
bin/forge.ts                  — Add setup command, add TUI launch with guard
package.json                  — Move deps, add @opentui/core, remove pi-tui peerDep
tsconfig.json                 — No changes needed (already includes src/**, tests/**)
bunfig.toml                   — No changes needed
```

### Deleted Files (entire directories)

```
src/bridge/                   — All 8 files (pi-bridge, pi-dev-runtime, pi-dev-session-manager, create-pi-composition, claude-bridge, forge-bridge, harness-detector, opencode-bridge)
src/dashboard/                — All 6 files (agent-conversation-buffer, forge-dev-dashboard, forge-inception-dashboard, forge-sidebar-component, forge-tab-bar, tab-manager)
tests/bridge/                 — All 7 files
tests/dashboard/              — All 6 files
tests/integration/            — 1 file (engine-dashboard-flow.test.ts)
```

---

## Task 1: Delete old bridge/ and dashboard/ code

**Files:**
- Delete: `src/bridge/` (8 files)
- Delete: `src/dashboard/` (6 files)
- Delete: `tests/bridge/` (7 files)
- Delete: `tests/dashboard/` (6 files)
- Delete: `tests/integration/engine-dashboard-flow.test.ts`
- Delete: `tests/cli/forge-lifecycle.test.ts` (depends on bridge)
- Delete: `src/bridge/forge-bridge.ts`, `src/bridge/claude-bridge.ts`, `src/bridge/opencode-bridge.ts`, `src/bridge/harness-detector.ts`
- Modify: `package.json` — remove pi-tui from peerDependencies, remove pi-bridge build step from scripts

**Interfaces:**
- Produces: clean codebase with only engine/, linear/, config/, prompts/, cli/ modules

- [ ] **Step 1: Delete bridge/ and dashboard/ source files**

```bash
rm -rf src/bridge src/dashboard tests/bridge tests/dashboard tests/integration/engine-dashboard-flow.test.ts tests/cli/forge-lifecycle.test.ts
```

- [ ] **Step 2: Verify engine tests still pass without bridge/dashboard**

Run: `bun test tests/engine/`
Expected: All engine tests PASS (engine is isolated, zero imports from bridge/dashboard)

- [ ] **Step 3: Update package.json — remove pi-tui peerDep, update build script**

Replace `scripts.build` with:
```json
"build": "bun build bin/forge.ts --outfile dist/forge.js --external @earendil-works/pi-coding-agent --external @earendil-works/pi-ai --external @opentui/core --external typebox --external 'node:*'"
```

Replace `peerDependencies` with:
```json
"peerDependencies": {}
```

Remove the `main` and `exports` fields (no more pi-bridge entry point):
```json
"main": undefined,
"exports": undefined,
```

Keep `bin`: `{ "forge": "./dist/forge.js" }`

- [ ] **Step 4: Update bin/forge.ts — remove all bridge imports**

The current `bin/forge.ts` imports from `../src/bridge/*`. Since those are deleted, `forge.ts` will break. For now, stub it minimally so it compiles:

```typescript
const command = Bun.argv[2] ?? "";
if (command === "init") {
  console.log("forge init — not yet implemented in v0.3");
} else if (command === "setup") {
  console.log("forge setup — not yet implemented in v0.3");
} else {
  console.log("Usage: forge <init|setup>");
}
```

We'll replace this stub in later tasks.

- [ ] **Step 5: Verify typecheck passes**

Run: `tsc --noEmit`
Expected: 0 errors (bridge/dashboard deleted, forge.ts stubbed)

- [ ] **Step 6: Verify lint passes**

Run: `npx oxlint src/ tests/ bin/`
Expected: 0 warnings, 0 errors

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor: delete bridge/ and dashboard/ modules for v0.3 standalone architecture"
```

---

## Task 2: Add ForgeEvent type and EventAdapter

**Files:**
- Create: `src/agent/event-adapter.ts`
- Test: `tests/agent/event-adapter.test.ts`

**Interfaces:**
- Produces: `ForgeEvent` type, `adaptSdkEvent(event: any): ForgeEvent | null` function
- Consumes: nothing (converts raw SDK events to a clean union)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { adaptSdkEvent } from "../../src/agent/event-adapter";

describe("adaptSdkEvent", () => {
  it("extracts text_delta from message_update", () => {
    const event = adaptSdkEvent({
      type: "message_update",
      assistantMessageEvent: { type: "text_delta", delta: "Hello", contentIndex: 0 },
    });
    expect(event).toEqual({ type: "text_delta", delta: "Hello" });
  });

  it("returns null for message_update without text_delta", () => {
    const event = adaptSdkEvent({
      type: "message_update",
      assistantMessageEvent: { type: "text_start", contentIndex: 0 },
    });
    expect(event).toBeNull();
  });

  it("adapts message_end for assistant messages", () => {
    const event = adaptSdkEvent({
      type: "message_end",
      message: { role: "assistant" },
    });
    expect(event).toEqual({ type: "message_end", role: "assistant" });
  });

  it("returns null for message_end of non-assistant messages", () => {
    const event = adaptSdkEvent({
      type: "message_end",
      message: { role: "user" },
    });
    expect(event).toBeNull();
  });

  it("adapts tool_execution_start", () => {
    const event = adaptSdkEvent({
      type: "tool_execution_start",
      toolName: "bash",
    });
    expect(event).toEqual({ type: "tool_start", toolName: "bash" });
  });

  it("adapts tool_execution_end success", () => {
    const event = adaptSdkEvent({
      type: "tool_execution_end",
      toolName: "bash",
      isError: false,
    });
    expect(event).toEqual({ type: "tool_end", toolName: "bash", isError: false });
  });

  it("adapts tool_execution_end error", () => {
    const event = adaptSdkEvent({
      type: "tool_execution_end",
      toolName: "edit",
      isError: true,
    });
    expect(event).toEqual({ type: "tool_end", toolName: "edit", isError: true });
  });

  it("adapts agent_settled", () => {
    const event = adaptSdkEvent({ type: "agent_settled" });
    expect(event).toEqual({ type: "agent_settled" });
  });

  it("adapts message_update with error assistantMessageEvent", () => {
    const event = adaptSdkEvent({
      type: "message_update",
      assistantMessageEvent: { type: "error", error: "Auth failed" },
    });
    expect(event).toEqual({ type: "agent_error", message: "Auth failed" });
  });

  it("returns null for unknown event types", () => {
    const event = adaptSdkEvent({ type: "unknown_event" });
    expect(event).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/agent/event-adapter.test.ts`
Expected: FAIL with "Cannot find module '../../src/agent/event-adapter'"

- [ ] **Step 3: Write minimal implementation**

```typescript
export type ForgeEvent =
  | { type: "text_delta"; delta: string }
  | { type: "message_end"; role: string }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_end"; toolName: string; isError: boolean }
  | { type: "agent_settled" }
  | { type: "agent_error"; message: string };

export function adaptSdkEvent(raw: unknown): ForgeEvent | null {
  const e = raw as { type: string; assistantMessageEvent?: any; message?: { role?: string }; toolName?: string; isError?: boolean };
  switch (e.type) {
    case "message_update": {
      const am = e.assistantMessageEvent;
      if (am?.type === "text_delta" && typeof am.delta === "string") {
        return { type: "text_delta", delta: am.delta };
      }
      if (am?.type === "error" && typeof am.error === "string") {
        return { type: "agent_error", message: am.error };
      }
      return null;
    }
    case "message_end": {
      if (e.message?.role === "assistant") {
        return { type: "message_end", role: "assistant" };
      }
      return null;
    }
    case "tool_execution_start":
      return { type: "tool_start", toolName: e.toolName ?? "unknown" };
    case "tool_execution_end":
      return { type: "tool_end", toolName: e.toolName ?? "unknown", isError: e.isError ?? false };
    case "agent_settled":
      return { type: "agent_settled" };
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/agent/event-adapter.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/agent/event-adapter.ts tests/agent/event-adapter.test.ts
git commit -m "feat: event adapter translates SDK events to ForgeEvent union"
```

---

## Task 3: Add AgentModelConfig type and config update

**Files:**
- Modify: `src/engine/types.ts` — add `AgentModelConfig` type, add `agentModels` to `ForgeConfig`
- Modify: `src/config/config-loader.ts` — update `generateForgeYaml()` to include agentModels, update YAML parsing
- Test: `tests/config/config-loader.test.ts` — add tests for agentModels

**Interfaces:**
- Produces: `AgentModelConfig` type in `src/engine/types.ts`
- Produces: `agentModels` field on `ForgeConfig`
- Consumes: nothing new

- [ ] **Step 1: Write the failing test**

Add to `tests/config/config-loader.test.ts`:

```typescript
it("loads agentModels from yaml", () => {
  const yaml = `active: false
maxConcurrentStories: 1
linear: { pollIntervalSeconds: 30, teamId: "T1", teamName: "test" }
agentModels:
  po-agent:
    model: "synthetic/glm-5.2"
    thinkingLevel: "high"
  developer-agent:
    model: "opencode-go/deepseek-v4-pro"
    thinkingLevel: "high"
agents: {}
inception: { phases: [] }
dashboard: { sidebarWidth: 40 }
`;
  const tmpDir = join(import.meta.dir, "..", ".test-config-models");
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(join(tmpDir, "config-file.yaml"), yaml);
  const cfg = new YamlConfig(join(tmpDir, "config-file.yaml"));
  const loaded = cfg.load();
  expect(loaded.agentModels).toBeDefined();
  expect(loaded.agentModels["po-agent"].model).toBe("synthetic/glm-5.2");
  expect(loaded.agentModels["po-agent"].thinkingLevel).toBe("high");
  expect(loaded.agentModels["developer-agent"].model).toBe("opencode-go/deepseek-v4-pro");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/config/config-loader.test.ts`
Expected: FAIL with "agentModels" undefined on ForgeConfig

- [ ] **Step 3: Add types to `src/engine/types.ts`**

After the `ForgeConfig` interface definition, add:

```typescript
export interface AgentModelConfig {
  model: string;
  thinkingLevel: string;
}
```

Add `agentModels?: Record<string, AgentModelConfig>;` to the `ForgeConfig` interface:

```typescript
export interface ForgeConfig {
  active: boolean;
  maxConcurrentStories: number;
  linear: {
    pollIntervalSeconds: number;
    teamId: string;
    teamName: string;
  };
  agentModels?: Record<string, AgentModelConfig>;
  agents: Record<AgentRole, AgentConfig>;
  inception: {
    phases: InceptionPhase[];
  };
  dashboard: {
    sidebarWidth: number;
  };
}
```

- [ ] **Step 4: Update `src/config/config-loader.ts`**

Add `agentModels` parsing in the `load()` method. The YAML parser already parses nested objects — just ensure the type is cast correctly. Add `agentModels` to the config object returned by `load()`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/config/config-loader.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/config/config-loader.ts tests/config/config-loader.test.ts
git commit -m "feat: add agentModels to ForgeConfig for per-agent model assignment"
```

---

## Task 4: ModelResolver — reads config, registers providers, resolves models

**Files:**
- Create: `src/agent/model-resolver.ts`
- Test: `tests/agent/model-resolver.test.ts`

**Interfaces:**
- Produces: `ModelResolver` class with `resolveAgentModel(role: string): { model: Model; thinkingLevel: string }`, `registerProvider(name, config): void`, `discoverModels(providerName): Promise<void>`, `getAvailableModels(): string[]`
- Consumes: `ForgeConfig` from `src/engine/types`, `AgentModelConfig` from `src/engine/types`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ModelResolver } from "../../src/agent/model-resolver";

const TEST_DIR = join(import.meta.dir, "..", ".test-model-resolver");

describe("ModelResolver", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it("registers a provider from config", () => {
    const resolver = new ModelResolver(TEST_DIR);
    resolver.registerProvider("test-provider", {
      baseUrl: "https://api.test.com/v1",
      apiKey: "test-key",
      api: "openai-responses",
    });
    expect(resolver.hasProvider("test-provider")).toBe(true);
  });

  it("resolves agent model from agentModels config", () => {
    const resolver = new ModelResolver(TEST_DIR);
    resolver.registerProvider("synthetic", {
      baseUrl: "https://api.synthetic.dev/v1",
      apiKey: "test-key",
      api: "openai-responses",
    });
    resolver.addModel("synthetic", {
      id: "glm-5.2",
      name: "GLM 5.2",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0 },
      contextWindow: 1000000,
      maxTokens: 16384,
    });
    const result = resolver.resolveAgentModel("po-agent", {
      "po-agent": { model: "synthetic/glm-5.2", thinkingLevel: "high" },
    });
    expect(result.model.id).toBe("glm-5.2");
    expect(result.thinkingLevel).toBe("high");
  });

  it("falls back to default model when agent not in agentModels", () => {
    const resolver = new ModelResolver(TEST_DIR);
    resolver.registerProvider("synthetic", {
      baseUrl: "https://api.synthetic.dev/v1",
      apiKey: "test-key",
      api: "openai-responses",
    });
    resolver.addModel("synthetic", {
      id: "glm-5.2", name: "GLM 5.2", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0 }, contextWindow: 1000000, maxTokens: 16384,
    });
    const result = resolver.resolveAgentModel("architect-agent", {}, "synthetic/glm-5.2", "medium");
    expect(result.model.id).toBe("glm-5.2");
    expect(result.thinkingLevel).toBe("medium");
  });

  it("parses provider/modelId format", () => {
    const resolver = new ModelResolver(TEST_DIR);
    const { providerName, modelId } = resolver.parseModelRef("synthetic/glm-5.2");
    expect(providerName).toBe("synthetic");
    expect(modelId).toBe("glm-5.2");
  });

  it("lists available models as provider/modelId", () => {
    const resolver = new ModelResolver(TEST_DIR);
    resolver.registerProvider("synthetic", { baseUrl: "x", apiKey: "y", api: "openai-responses" });
    resolver.addModel("synthetic", { id: "glm-5.2", name: "GLM 5.2", reasoning: false, input: ["text"], cost: { input: 0, output: 0 }, contextWindow: 1000000, maxTokens: 16384 });
    resolver.addModel("synthetic", { id: "glm-4.5", name: "GLM 4.5", reasoning: false, input: ["text"], cost: { input: 0, output: 0 }, contextWindow: 200000, maxTokens: 8192 });
    const models = resolver.getAvailableModels();
    expect(models).toContain("synthetic/glm-5.2");
    expect(models).toContain("synthetic/glm-4.5");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/agent/model-resolver.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  api: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  cost: { input: number; output: number };
  contextWindow: number;
  maxTokens: number;
}

export interface ResolvedModel {
  model: ModelInfo;
  thinkingLevel: string;
  providerName: string;
  apiKey: string;
  baseUrl: string;
  api: string;
}

export class ModelResolver {
  private providers = new Map<string, ProviderConfig>();
  private modelsByProvider = new Map<string, ModelInfo[]>();

  constructor(private agentDir: string) {
    if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });
    this.loadCachedModels();
  }

  registerProvider(name: string, config: ProviderConfig): void {
    this.providers.set(name, config);
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  addModel(providerName: string, model: ModelInfo): void {
    if (!this.modelsByProvider.has(providerName)) {
      this.modelsByProvider.set(providerName, []);
    }
    this.modelsByProvider.get(providerName)!.push(model);
    this.saveCachedModels();
  }

  parseModelRef(ref: string): { providerName: string; modelId: string } {
    const slashIndex = ref.indexOf("/");
    if (slashIndex < 0) return { providerName: "", modelId: ref };
    return { providerName: ref.slice(0, slashIndex), modelId: ref.slice(slashIndex + 1) };
  }

  resolveAgentModel(
    role: string,
    agentModels: Record<string, { model: string; thinkingLevel: string }>,
    defaultModelRef?: string,
    defaultThinkingLevel?: string,
  ): ResolvedModel {
    const agentConfig = agentModels[role];
    const modelRef = agentConfig?.model ?? defaultModelRef ?? "";
    const thinkingLevel = agentConfig?.thinkingLevel ?? defaultThinkingLevel ?? "medium";
    const { providerName, modelId } = this.parseModelRef(modelRef);
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Provider "${providerName}" not registered`);
    const models = this.modelsByProvider.get(providerName) ?? [];
    const model = models.find(m => m.id === modelId);
    if (!model) throw new Error(`Model "${modelId}" not found for provider "${providerName}"`);
    return { model, thinkingLevel, providerName, apiKey: provider.apiKey, baseUrl: provider.baseUrl, api: provider.api };
  }

  getAvailableModels(): string[] {
    const result: string[] = [];
    for (const [providerName, models] of this.modelsByProvider) {
      for (const model of models) {
        result.push(`${providerName}/${model.id}`);
      }
    }
    return result;
  }

  private loadCachedModels(): void {
    const cachePath = join(this.agentDir, "models.json");
    if (!existsSync(cachePath)) return;
    try {
      const data = JSON.parse(readFileSync(cachePath, "utf-8"));
      if (data.modelsByProvider) {
        for (const [name, models] of Object.entries(data.modelsByProvider)) {
          this.modelsByProvider.set(name, models as ModelInfo[]);
        }
      }
    } catch {}
  }

  private saveCachedModels(): void {
    const cachePath = join(this.agentDir, "models.json");
    const data: Record<string, unknown> = {};
    for (const [name, models] of this.modelsByProvider) {
      data[name] = models;
    }
    writeFileSync(cachePath, JSON.stringify({ modelsByProvider: data }, null, 2));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/agent/model-resolver.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/agent/model-resolver.ts tests/agent/model-resolver.test.ts
git commit -m "feat: model resolver registers providers and resolves per-agent models"
```

---

## Task 5: ToolRegistry — forge tools via defineTool

**Files:**
- Create: `src/agent/tool-registry.ts`
- Test: `tests/agent/tool-registry.test.ts`

**Interfaces:**
- Produces: `ToolRegistry` class with `registerForgeTools(engine: WorkflowEngine, artifacts: ArtifactRepository): ToolDefinition[]` and `getToolNames(): string[]`
- Consumes: `WorkflowEngine` from `src/engine/workflow-engine`, `ArtifactRepository` from `src/linear/linear-document-repository`, `defineTool` from `@earendil-works/pi-coding-agent`, `Type` from `typebox`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { ToolRegistry } from "../../src/agent/tool-registry";

describe("ToolRegistry", () => {
  it("creates forge tools that call engine methods", async () => {
    const mockEngine = {
      claimStory: async (_role: string) => ({ id: "FOR-1", title: "Test", state: "in-dev", assignee: null, iteration: null, featureFlag: null, url: "" }),
      completeAc: async (_id: string, _ac: number, _sha: string) => true,
      handoff: async () => ({ success: true }),
    } as any;

    const mockArtifacts = {
      createArtifact: async (_title: string, _content: string) => "doc-1",
    } as any;

    const registry = new ToolRegistry();
    const tools = registry.registerForgeTools(mockEngine, mockArtifacts);

    const names = tools.map(t => t.name);
    expect(names).toContain("forge_claim_story");
    expect(names).toContain("forge_complete_ac");
    expect(names).toContain("forge_handoff");
    expect(names).toContain("forge_create_artifact");
    expect(names).toContain("forge_log_progress");

    const claimTool = tools.find(t => t.name === "forge_claim_story")!;
    const result = await claimTool.execute("call-1", { agentRole: "developer-agent" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("FOR-1");
  });

  it("getToolNames returns all forge tool names", () => {
    const registry = new ToolRegistry();
    registry.registerForgeTools({} as any, {} as any);
    const names = registry.getToolNames();
    expect(names).toContain("forge_claim_story");
    expect(names).toContain("forge_complete_ac");
    expect(names.length).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/agent/tool-registry.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { WorkflowEngine } from "../engine/workflow-engine";
import type { ArtifactRepository } from "../engine/interfaces";
import type { AgentRole } from "../engine/types";

export class ToolRegistry {
  private toolNames: string[] = [];

  registerForgeTools(engine: WorkflowEngine, artifacts: ArtifactRepository): any[] {
    const tools = [
      {
        name: "forge_claim_story",
        label: "Claim Story",
        description: "Pull and claim the next available story for your agent role.",
        parameters: Type.Object({ agentRole: Type.String() }),
        execute: async (_id: string, params: { agentRole: string }) => {
          const story = await engine.claimStory(params.agentRole as AgentRole);
          return story
            ? { content: [{ type: "text" as const, text: `Claimed story ${story.id}: ${story.title}` }], details: story, isError: false }
            : { content: [{ type: "text" as const, text: "No stories available" }], details: null, isError: false };
        },
      },
      {
        name: "forge_complete_ac",
        label: "Complete AC",
        description: "Mark an acceptance criterion as complete with git proof.",
        parameters: Type.Object({
          storyId: Type.String(),
          acNumber: Type.Number(),
          commitSha: Type.String(),
        }),
        execute: async (_id: string, params: { storyId: string; acNumber: number; commitSha: string }) => {
          const ok = await engine.completeAc(params.storyId, params.acNumber, params.commitSha);
          return ok
            ? { content: [{ type: "text" as const, text: `AC ${params.acNumber} completed` }], details: { ok }, isError: false }
            : { content: [{ type: "text" as const, text: `Git proof failed` }], details: { ok: false }, isError: true };
        },
      },
      {
        name: "forge_handoff",
        label: "Handoff",
        description: "Hand off a story to the next stage.",
        parameters: Type.Object({
          storyId: Type.String(),
          agentRole: Type.String(),
          targetState: Type.String(),
          accomplishments: Type.String(),
          remaining: Type.String(),
          testLocations: Type.String(),
        }),
        execute: async (_id: string, params: any) => {
          const result = await engine.handoff(params.storyId, params.agentRole as AgentRole, {
            targetState: params.targetState,
            accomplishments: params.accomplishments,
            remaining: params.remaining,
            testLocations: params.testLocations,
          });
          return result.success
            ? { content: [{ type: "text" as const, text: `Handed off to ${params.targetState}` }], details: result, isError: false }
            : { content: [{ type: "text" as const, text: `Handoff failed: ${result.error}` }], details: result, isError: true };
        },
      },
      {
        name: "forge_create_artifact",
        label: "Create Artifact",
        description: "Create an artifact document in Linear.",
        parameters: Type.Object({ title: Type.String(), content: Type.String() }),
        execute: async (_id: string, params: { title: string; content: string }) => {
          const id = await artifacts.createArtifact(params.title, params.content);
          return { content: [{ type: "text" as const, text: `Artifact created: ${id}` }], details: { id }, isError: false };
        },
      },
      {
        name: "forge_log_progress",
        label: "Log Progress",
        description: "Log a progress message.",
        parameters: Type.Object({ message: Type.String() }),
        execute: async (_id: string, params: { message: string }) => {
          return { content: [{ type: "text" as const, text: `Progress: ${params.message}` }], details: { message: params.message }, isError: false };
        },
      },
    ];

    this.toolNames = tools.map(t => t.name);
    return tools.map(defineTool);
  }

  getToolNames(): string[] {
    return [...this.toolNames];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/agent/tool-registry.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/agent/tool-registry.ts tests/agent/tool-registry.test.ts
git commit -m "feat: tool registry registers forge tools via defineTool as customTools"
```

---

## Task 6: CommandRegistry — slash commands for TUI autocomplete + dispatch

**Files:**
- Create: `src/agent/command-registry.ts`
- Test: `tests/agent/command-registry.test.ts`

**Interfaces:**
- Produces: `CommandRegistry` class with `register(name, handler): void`, `get(name): CommandHandler | undefined`, `getAll(): string[]`
- Consumes: `CommandHandler` type from `src/engine/interfaces`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { CommandRegistry } from "../../src/agent/command-registry";

describe("CommandRegistry", () => {
  it("registers and retrieves a command", () => {
    const reg = new CommandRegistry();
    const handler = async () => {};
    reg.register("forge-new", handler);
    expect(reg.get("forge-new")).toBe(handler);
  });

  it("returns undefined for unknown command", () => {
    const reg = new CommandRegistry();
    expect(reg.get("unknown")).toBeUndefined();
  });

  it("lists all registered command names", () => {
    const reg = new CommandRegistry();
    reg.register("forge-new", async () => {});
    reg.register("forge-next", async () => {});
    reg.register("forge-status", async () => {});
    const all = reg.getAll();
    expect(all).toContain("forge-new");
    expect(all).toContain("forge-next");
    expect(all).toContain("forge-status");
    expect(all.length).toBe(3);
  });

  it("filters by prefix for autocomplete", () => {
    const reg = new CommandRegistry();
    reg.register("forge-new", async () => {});
    reg.register("forge-next", async () => {});
    reg.register("forge-status", async () => {});
    reg.register("help", async () => {});
    const filtered = reg.filterByPrefix("forge");
    expect(filtered).toContain("forge-new");
    expect(filtered).toContain("forge-next");
    expect(filtered).toContain("forge-status");
    expect(filtered).not.toContain("help");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/agent/command-registry.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { CommandHandler } from "../engine/interfaces";

export class CommandRegistry {
  private commands = new Map<string, CommandHandler>();

  register(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler);
  }

  get(name: string): CommandHandler | undefined {
    return this.commands.get(name);
  }

  getAll(): string[] {
    return [...this.commands.keys()];
  }

  filterByPrefix(prefix: string): string[] {
    const lower = prefix.toLowerCase();
    return [...this.commands.keys()].filter(name => name.toLowerCase().startsWith(lower));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/agent/command-registry.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/agent/command-registry.ts tests/agent/command-registry.test.ts
git commit -m "feat: command registry stores slash commands for TUI autocomplete and dispatch"
```

---

## Task 7: AgentSessionManager — wraps createAgentSession headlessly

**Files:**
- Create: `src/agent/session-manager.ts`
- Test: `tests/agent/session-manager.test.ts`

**Interfaces:**
- Produces: `AgentSessionManager` class implementing `SessionManager` from `src/engine/interfaces`
- Produces: `createInceptionSession(workdir, modelResolver, tools, agentRole): Promise<Session>` — interactive session for inception
- Consumes: `SessionManager`, `Session`, `SessionConfig`, `SessionInfo` from `src/engine/interfaces`
- Consumes: `ModelResolver` from `src/agent/model-resolver`
- Consumes: `createAgentSession` from `@earendil-works/pi-coding-agent`
- Consumes: `adaptSdkEvent` from `src/agent/event-adapter`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { AgentSessionManager } from "../../src/agent/session-manager";

describe("AgentSessionManager", () => {
  it("tracks active sessions", () => {
    const mgr = new AgentSessionManager("/test", {}, {} as any);
    expect(mgr.getActiveSessions()).toEqual([]);
  });

  it("terminateSession removes a tracked session", async () => {
    const mgr = new AgentSessionManager("/test", {}, {} as any);
    // simulate tracked session
    (mgr as any).sessions.set("s1", { sessionId: "s1", storyId: "FOR-1", agentRole: "developer-agent", abort: async () => {} });
    expect(mgr.getActiveSessions().length).toBe(1);
    await mgr.terminateSession("s1");
    expect(mgr.getActiveSessions().length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/agent/session-manager.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { SessionManager, Session, SessionConfig, SessionInfo } from "../engine/interfaces";
import type { AgentRole } from "../engine/types";
import type { ModelResolver, ResolvedModel } from "./model-resolver";

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
  ) {}

  async createSession(config: SessionConfig): Promise<Session> {
    // Lazy import — only loaded when actually creating sessions
    const { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } = await import("@earendil-works/pi-coding-agent");
    
    const resolved = this.modelResolver.resolveAgentModel(
      config.agentRole,
      this.agentModels,
    );

    const loader = new DefaultResourceLoader({
      cwd: config.cwd,
      agentDir: forgeAgentDir,           // ~/.config/forge/agent
      noExtensions: true,                // no pi.dev extensions
      noSkills: false,                   // YES — auto-discover from .agents/skills/
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: false,             // AGENTS.md etc.
    });
    // Auto-trust project so .agents/skills/ is discovered without user prompt
    await loader.reload({ resolveProjectTrust: async () => true });

    const { session } = await createAgentSession({
      cwd: config.cwd,
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory(),
      customTools: (config as any).customTools ?? [],
      tools: config.tools,
    });

    const tracked: TrackedSession = {
      sessionId: session.sessionId,
      storyId: config.storyId,
      agentRole: config.agentRole,
      prompt: (text: string) => session.prompt(text),
      steer: (text: string) => session.steer(text),
      subscribe: (listener: (event: any) => void) => {
        return session.subscribe((event: any) => {
          const adapted = adaptSdkEventInternal(event);
          if (adapted) listener(adapted);
        });
      },
      abort: () => session.abort(),
    };

    this.sessions.set(tracked.sessionId, tracked);
    return tracked;
  }

  getActiveSessions(): SessionInfo[] {
    const now = Date.now();
    return [...this.sessions.values()].map(s => ({
      sessionId: s.sessionId,
      storyId: s.storyId ?? "",
      agentRole: s.agentRole,
      isBusy: false,
      elapsedTime: now,
    }));
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.abort();
      this.sessions.delete(sessionId);
    }
  }
}

// Import adaptSdkEvent but avoid circular dependency for type-only usage
import { adaptSdkEvent } from "./event-adapter";

function adaptSdkEventInternal(event: any): any {
  return adaptSdkEvent(event);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/agent/session-manager.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/agent/session-manager.ts tests/agent/session-manager.test.ts
git commit -m "feat: agent session manager wraps createAgentSession headlessly"
```

---

## Task 8: TUI theme constants

**Files:**
- Create: `src/tui/theme.ts`
- Test: `tests/tui/theme.test.ts`

**Interfaces:**
- Produces: `THEME` constant object with all color values, `AGENT_COLORS` map

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { THEME, AGENT_COLORS } from "../../src/tui/theme";

describe("theme", () => {
  it("has background colors", () => {
    expect(THEME.background).toBeDefined();
    expect(THEME.backgroundPanel).toBeDefined();
    expect(THEME.backgroundElement).toBeDefined();
  });

  it("has border colors", () => {
    expect(THEME.border).toBeDefined();
    expect(THEME.borderActive).toBeDefined();
  });

  it("has semantic colors", () => {
    expect(THEME.primary).toBeDefined();
    expect(THEME.success).toBeDefined();
    expect(THEME.warning).toBeDefined();
    expect(THEME.error).toBeDefined();
  });

  it("has text colors", () => {
    expect(THEME.text).toBeDefined();
    expect(THEME.textMuted).toBeDefined();
  });

  it("has agent colors for all 7 agents", () => {
    expect(AGENT_COLORS["po-agent"]).toBeDefined();
    expect(AGENT_COLORS["architect-agent"]).toBeDefined();
    expect(AGENT_COLORS["ux-agent"]).toBeDefined();
    expect(AGENT_COLORS["developer-agent"]).toBeDefined();
    expect(AGENT_COLORS["qa-agent"]).toBeDefined();
    expect(AGENT_COLORS["devops-agent"]).toBeDefined();
    expect(AGENT_COLORS["guardian-agent"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tui/theme.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
export const THEME = {
  background: "transparent",
  backgroundPanel: "#1a1b26",
  backgroundElement: "#24283b",
  border: "#3b4261",
  borderActive: "#7aa2f7",
  primary: "#7aa2f7",
  success: "#9ece6a",
  warning: "#e0af68",
  error: "#f7768e",
  text: "#c0caf5",
  textMuted: "#565f89",
  thinking: "#565f89",
  spinner: "#7aa2f7",
} as const;

export const AGENT_COLORS: Record<string, string> = {
  "po-agent": "#7aa2f7",
  "architect-agent": "#9ece6a",
  "ux-agent": "#bb9af7",
  "developer-agent": "#7dcfff",
  "qa-agent": "#ff007c",
  "devops-agent": "#e0af68",
  "guardian-agent": "#e0af68",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/tui/theme.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/theme.ts tests/tui/theme.test.ts
git commit -m "feat: TUI theme constants with tokyo-night palette and agent colors"
```

---

## Task 9: StatusBar component

**Files:**
- Create: `src/tui/status-bar.ts`
- Test: `tests/tui/status-bar.test.ts`

**Interfaces:**
- Produces: `StatusBar` class with `setInfo(agent, model, provider, thinking, tokens, maxTokens, mode): void`, `getRenderable(): TextRenderable`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { StatusBar } from "../../src/tui/status-bar";

describe("StatusBar", () => {
  it("formats agent, model, provider, thinking, tokens, mode", () => {
    const bar = new StatusBar();
    bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
    const text = bar.getText();
    expect(text).toContain("po-agent");
    expect(text).toContain("glm-5.2");
    expect(text).toContain("synthetic");
    expect(text).toContain("high");
    expect(text).toContain("1.2%");
    expect(text).toContain("inception");
  });

  it("handles zero tokens", () => {
    const bar = new StatusBar();
    bar.setInfo("developer-agent", "deepseek-v4-pro", "opencode-go", "high", 0, 1000000, "development");
    const text = bar.getText();
    expect(text).toContain("0.0%");
    expect(text).toContain("development");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tui/status-bar.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
export class StatusBar {
  private agent = "";
  private model = "";
  private provider = "";
  private thinking = "";
  private tokens = 0;
  private maxTokens = 1;
  private mode = "";

  setInfo(agent: string, model: string, provider: string, thinking: string, tokens: number, maxTokens: number, mode: string): void {
    this.agent = agent;
    this.model = model;
    this.provider = provider;
    this.thinking = thinking;
    this.tokens = tokens;
    this.maxTokens = maxTokens;
    this.mode = mode;
  }

  getText(): string {
    const pct = this.maxTokens > 0 ? (this.tokens / this.maxTokens * 100).toFixed(1) : "0.0";
    const tokensFormatted = this.tokens >= 1000 ? `${Math.floor(this.tokens / 1000)}k` : `${this.tokens}`;
    const maxFormatted = this.maxTokens >= 1000000 ? `${this.maxTokens / 1000000}M` : `${this.maxTokens}`;
    return `${this.agent} · ${this.model} ${this.provider} · ${this.thinking} · ${tokensFormatted}/${maxFormatted} (${pct}%) · ${this.mode}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/tui/status-bar.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/status-bar.ts tests/tui/status-bar.test.ts
git commit -m "feat: status bar shows agent, model, provider, thinking, tokens, mode"
```

---

## Task 10: Sidebar component

**Files:**
- Create: `src/tui/sidebar.ts`
- Test: `tests/tui/sidebar.test.ts`

**Interfaces:**
- Produces: `Sidebar` class with `setState(state, sessions, phaseName?, phaseAgent?): void`, `getText(): string[]`
- Consumes: `ProjectState`, `AgentSessionMeta` from `src/engine/types`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { Sidebar } from "../../src/tui/sidebar";
import type { ProjectState } from "../../src/engine/types";

const inceptionState: ProjectState = {
  mode: "inception",
  inception: { mode: "inception", currentPhase: 1, phaseSessionId: null, artifacts: {} },
};

describe("Sidebar", () => {
  it("renders inception mode with phase info", () => {
    const sidebar = new Sidebar();
    sidebar.setState(inceptionState, [], "Lean Canvas", "po-agent");
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("Inception"))).toBe(true);
    expect(lines.some(l => l.includes("Phase: 1/8"))).toBe(true);
    expect(lines.some(l => l.includes("Lean Canvas"))).toBe(true);
    expect(lines.some(l => l.includes("po-agent"))).toBe(true);
    expect(lines.some(l => l.includes("Guardians"))).toBe(true);
  });

  it("renders development mode with session list", () => {
    const devState: ProjectState = {
      mode: "development",
      inception: { mode: "development", currentPhase: 8, phaseSessionId: null, artifacts: {} },
    };
    const sidebar = new Sidebar();
    const sessions = [
      { sessionId: "s1", storyId: "FOR-5", agentRole: "developer-agent" as any, workflowState: "in-dev" as any, sessionStartTime: Date.now(), isRecovery: false },
    ];
    sidebar.setState(devState, sessions);
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("Development"))).toBe(true);
    expect(lines.some(l => l.includes("FOR-5"))).toBe(true);
    expect(lines.some(l => l.includes("Sessions"))).toBe(true);
  });

  it("renders empty sessions in dev mode", () => {
    const devState: ProjectState = {
      mode: "development",
      inception: { mode: "development", currentPhase: 8, phaseSessionId: null, artifacts: {} },
    };
    const sidebar = new Sidebar();
    sidebar.setState(devState, []);
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("No active"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tui/sidebar.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { ProjectState, AgentSessionMeta } from "../engine/types";

export class Sidebar {
  private lines: string[] = [];

  setState(state: ProjectState, sessions: AgentSessionMeta[], phaseName?: string, phaseAgent?: string): void {
    const lines: string[] = [];
    lines.push(" Forge");
    lines.push("─".repeat(28));
    if (state.mode === "inception") {
      lines.push(" Mode: Inception");
      lines.push(` Phase: ${state.inception.currentPhase}/8`);
      if (phaseName) lines.push(` ${phaseName}`);
      if (phaseAgent) lines.push(` (${phaseAgent})`);
    } else {
      lines.push(" Mode: Development");
    }
    lines.push("─".repeat(28));
    if (state.mode === "development") {
      lines.push(` Sessions (${sessions.length}):`);
      if (sessions.length === 0) {
        lines.push("  No active sessions");
      } else {
        for (const s of sessions) {
          lines.push(`  ${s.storyId} ${s.agentRole.replace("-agent", "")} ${s.workflowState}`);
        }
      }
      lines.push("─".repeat(28));
    }
    lines.push(" Guardians: OK");
    this.lines = lines;
  }

  getText(): string[] {
    return [...this.lines];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/tui/sidebar.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/sidebar.ts tests/tui/sidebar.test.ts
git commit -m "feat: sidebar renders forge info for inception and development modes"
```

---

## Task 11: Update ProjectInitializer — .gitignore, remove .pi/extensions, per-agent models

**Files:**
- Modify: `src/cli/project-initializer.ts`
- Test: `tests/cli/project-initializer.test.ts`

**Interfaces:**
- Produces: updated `ProjectInitializer.initProject()` that adds `.forge/` to `.gitignore` and removes `.pi/extensions/` creation

- [ ] **Step 1: Write the failing test**

```typescript
it("creates .gitignore with .forge/ if not exists", () => {
  const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
  init.initProject(tmpDir, {});
  const gitignore = readFileSync(join(tmpDir, ".gitignore"), "utf-8");
  expect(gitignore).toContain(".forge/");
});

it("appends .forge/ to existing .gitignore", () => {
  writeFileSync(join(tmpDir, ".gitignore"), "node_modules/\n");
  const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
  init.initProject(tmpDir, {});
  const gitignore = readFileSync(join(tmpDir, ".gitignore"), "utf-8");
  expect(gitignore).toContain("node_modules/");
  expect(gitignore).toContain(".forge/");
  expect(gitignore.indexOf("node_modules/")).toBeLessThan(gitignore.indexOf(".forge"));
});

it("does not create .pi/extensions directory", () => {
  const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
  init.initProject(tmpDir, {});
  expect(existsSync(join(tmpDir, ".pi"))).toBe(false);
});

it("copies skills to .agents/skills/ (not ./skills/)", () => {
  const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
  init.initProject(tmpDir, {});
  expect(existsSync(join(tmpDir, ".agents", "skills"))).toBe(true);
  expect(existsSync(join(tmpDir, "skills"))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/cli/project-initializer.test.ts`
Expected: FAIL (no .gitignore creation, .pi/extensions still created)

- [ ] **Step 3: Update `src/cli/project-initializer.ts`**

Remove the `.pi/extensions` creation block (lines 49-60). Change skills destination from `./skills/` to `./.agents/skills/`. Add `.gitignore` handling:

```typescript
private ensureGitignore(cwd: string): void {
  const gitignorePath = join(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, ".forge/\n");
  } else {
    const content = readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".forge")) {
      writeFileSync(gitignorePath, content.trimEnd() + "\n.forge/\n");
    }
  }
}
```

Call `this.ensureGitignore(cwd);` in `initProject()`.

Remove the `bundleDir` constructor parameter and all `.pi/extensions` logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/cli/project-initializer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/project-initializer.ts tests/cli/project-initializer.test.ts
git commit -m "feat: project initializer adds .gitignore, removes .pi/extensions"
```

---

## Task 12: Update bin/forge.ts — setup command, TUI launch guard

**Files:**
- Modify: `bin/forge.ts`

**Interfaces:**
- Produces: `forge setup` command stub, `forge init` updated (remove pi reference), `forge` TUI launch with setup guard

- [ ] **Step 1: Update `bin/forge.ts`**

Replace the entire file with:

```typescript
import { parseArgs } from "node:util";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { ProjectInitializer } from "../src/cli/project-initializer";
import { FilePersistence } from "../src/engine/file-persistence";
import { LinearClient } from "../src/linear/linear-story-repository";
import { runOAuth } from "../src/linear/linear-oauth";
import { ModelResolver } from "../src/agent/model-resolver";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");
const FORGE_CONFIG_DIR = join(homedir(), ".config", "forge");

function printUsage(): never {
  console.log(`Usage: forge <command> [options]

Commands:
  init    Initialize a new Forge project
  setup   Configure global AI providers (run once)
  (none)  Launch the Forge TUI

Options:
  --cwd <path>       Project directory (default: current directory)
  --skip-auth        Skip Linear OAuth flow (init only)
  --re-auth          Re-authenticate with Linear (init only)
`);
  process.exit(1);
}

async function main() {
  const args = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      cwd: { type: "string" },
      "skip-auth": { type: "boolean", default: false },
      "re-auth": { type: "boolean", default: false },
    },
  });

  const command = args.positionals[0];

  if (command === "setup") {
    await runSetup();
    return;
  }

  if (command === "init") {
    await runInit(args.values.cwd ?? process.cwd(), args.values["skip-auth"], args.values["re-auth"]);
    return;
  }

  if (!command || command === "help") {
    // No command — try to launch TUI
    if (!existsSync(join(FORGE_CONFIG_DIR, "forge.yaml"))) {
      console.error("Forge is not configured. Run 'forge setup' first.");
      process.exit(1);
    }
    console.log("Launching Forge TUI... (not yet implemented)");
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
}

async function runSetup(): Promise<void> {
  console.log("Forge Setup — Global Configuration");
  console.log("(not yet implemented — see spec)");
  process.exit(0);
}

async function runInit(cwd: string, skipAuth: boolean, reAuth: boolean): Promise<void> {
  const persistenceDir = join(cwd, ".forge");
  const persistence = new FilePersistence(persistenceDir);
  const init = new ProjectInitializer(TEMPLATES_DIR, persistence);

  if (init.isInitialized(cwd)) {
    console.error("Forge already initialized in this directory.");
    process.exit(1);
  }

  console.log("Initializing Forge project...");
  init.initProject(cwd, {});

  if (!skipAuth) {
    console.log("\nLinear Authentication");
    console.log("=====================");
    const authPath = join(persistenceDir, "auth.json");
    if (reAuth) {
      const { rmSync } = await import("node:fs");
      try { rmSync(authPath, { force: true }); } catch {}
    }
    try {
      console.log("Opening browser for Linear OAuth...");
      await runOAuth(authPath);
      console.log("Linear authenticated successfully!");
      const linear = new LinearClient({ authPath });
      const team = await linear.discoverTeam();
      if (team) {
        console.log(`Discovered team: ${team.name} (${team.id})`);
        const { readFileSync, writeFileSync } = await import("node:fs");
        const yamlPath = join(cwd, "forge.yaml");
        let yaml = readFileSync(yamlPath, "utf-8");
        yaml = yaml.replace(/teamId:\s*""/, `teamId: "${team.id}"`);
        yaml = yaml.replace(/teamName:\s*""/, `teamName: "${team.name}"`);
        writeFileSync(yamlPath, yaml);
        console.log("\nCreating Linear workflow states...");
        const result = await linear.ensureWorkflowStates();
        console.log(`  Created: ${result.created.length} states`);
        console.log(`  Existing: ${result.existing.length} states`);
      }
    } catch (err) {
      console.error(`Linear auth failed: ${(err as Error).message}`);
    }
  }

  console.log("\nForge initialized successfully.");
  console.log("Run 'forge' to start the TUI.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Verify typecheck passes**

Run: `tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run all tests**

Run: `bun test`
Expected: All existing tests PASS, no import errors

- [ ] **Step 4: Commit**

```bash
git add bin/forge.ts
git commit -m "feat: forge CLI with setup/init/launch commands, setup guard"
```

---

## Task 13: Update package.json — add @opentui/core, move deps, update build

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json**

```json
{
  "name": "@loopworx/forge",
  "version": "0.3.0",
  "description": "AI-driven software delivery orchestrator — standalone CLI with TUI",
  "type": "module",
  "license": "MIT",
  "bin": { "forge": "./dist/forge.js" },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint src/ tests/",
    "build": "bun build bin/forge.ts --outfile dist/forge.js --external @earendil-works/pi-coding-agent --external @earendil-works/pi-ai --external @opentui/core --external typebox --external 'node:*' && bun -e \"const fs=require('fs');const f='dist/forge.js';let c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env bun\\n'+c);fs.chmodSync(f,0o755)\"",
    "prepublishOnly": "bun run typecheck && bun test && bun run build"
  },
  "files": ["dist/", "templates/", "tsconfig.json", "README.md"],
  "publishConfig": { "access": "public" },
  "dependencies": {
    "@opentui/core": "^0.4.3",
    "@earendil-works/pi-coding-agent": ">=0.80.0",
    "@earendil-works/pi-ai": ">=0.80.0",
    "typebox": ">=0.32.0",
    "open": "^11.0.0",
    "yaml": "^2.9.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "oxlint": "^1.72.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Install deps**

Run: `bun install`
Expected: `@opentui/core` installed

- [ ] **Step 3: Run typecheck**

Run: `tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 5: Build**

Run: `bun run build`
Expected: `dist/forge.js` created

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "feat: v0.3 package — add @opentui/core, no peer deps, self-contained"
```

---

## Task 14: Full test suite + lint + typecheck + build + push

- [ ] **Step 1: Run all tests**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run lint**

Run: `npx oxlint src/ tests/ bin/`
Expected: 0 warnings, 0 errors

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: `dist/forge.js` created

- [ ] **Step 5: Push**

```bash
git push origin main
```

- [ ] **Step 6: Verify CI is green**

Check: GitHub Actions pipeline passes, npm publishes new version.
