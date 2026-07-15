# Fix Model Resolution + Agent Profiles Plan

**Goal:** Fix 3 remaining gaps preventing end-to-end forge usage: model resolution pipeline broken, model catalog never populated, agent profiles in wrong directory.

**Tech Stack:** Bun, TypeScript, OpenTUI, pi-coding-agent SDK, TDD with bun test

## Global Constraints

- Bun runtime, TypeScript strict mode
- TDD: write failing test first, verify it fails, implement, verify it passes, commit
- SDK's `createAgentSession({ model, thinkingLevel, ... })` accepts a `Model<any>` object from pi-ai
- `AuthStorage.inMemory(data?)` — no file needed, API keys set via `setRuntimeApiKey(provider, key)`
- `ModelRegistry.inMemory(authStorage)` — in-memory registry, built-in catalog auto-loaded on construction
- `ModelRegistry.registerProvider(name, ProviderConfigInput)` — registers custom provider with `baseUrl`, `apiKey`, `api`, and `models[]` array
- `ModelRegistry.find(provider, modelId): Model<Api> | undefined` — model lookup
- `ProviderConfigInput.models` requires: `{ id, name, api?, baseUrl?, provider, reasoning, input, cost: {input, output, cacheRead, cacheWrite}, contextWindow, maxTokens, headers?, compat? }`
- `getBuiltinProviders()` from `@earendil-works/pi-ai/providers/all` — returns list of built-in provider names
- `fetch` is available globally in Bun
- OpenAI-compatible `/models` endpoint returns `{ "data": [{ "id": "model-id", ... }] }`
- `ModelResolver` will be DELETED — replaced entirely by `ModelRegistry`
- `parseModelRef(ref: string)` — 3-line inline function, replaces `ModelResolver.parseModelRef()`

---

## Task 1: Create ModelFetcher — fetch models from /models endpoint (TDD)

**New file:** `src/agent/model-fetcher.ts`
**New test:** `tests/agent/model-fetcher.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
1. Parses OpenAI-compatible `/models` response → returns `[{ id, name }]`
2. Returns empty array on 404 error (graceful failure)
3. Returns empty array on network error (fetch throws)
4. Returns empty array on timeout (5s)
5. Returns empty array on malformed JSON
6. Handles providers that return bare array vs `{ data: [...] }`

For tests, use `mock()` from `bun:test` to mock `globalThis.fetch`. Each test sets up a different response and verifies the return value.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `fetchModels`**

```typescript
export interface FetchedModel {
  id: string;
  name: string;
}

export async function fetchModels(baseUrl: string, apiKey: string): Promise<FetchedModel[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const json = await response.json();
    const models = Array.isArray(json) ? json : json.data;
    if (!Array.isArray(models)) return [];
    return models
      .filter((m: any) => m && typeof m.id === "string")
      .map((m: any) => ({ id: m.id as string, name: (m.name ?? m.id) as string }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Run all tests + typecheck + commit**

---

## Task 2: Wire ModelRegistry into session-manager (Gaps 1 + 2)

**Modify:** `src/agent/session-manager.ts`
**Modify:** `tests/agent/session-manager.test.ts`

- [ ] **Step 1: Write failing tests**

1. Constructor accepts `ModelRegistry`, `defaultModelRef`, `defaultThinkingLevel` and stores them
2. `createSession` resolves model ref from `agentModels[role]` fallback to `defaultModelRef`
3. `createSession` calls `modelRegistry.find(providerName, modelId)` (mock ModelRegistry)
4. `createSession` passes resolved `model` + `thinkingLevel` to `createAgentSession` (verify via mock)

For tests, mock `ModelRegistry` as a simple `{ find: () => mockModel }` object. The constructor signature change will cause existing tests to fail unless updated.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update `AgentSessionManager` constructor**

Replace `import type { ModelResolver }` with `import type { ModelRegistry }` from `@earendil-works/pi-coding-agent`.

Constructor signature:
```typescript
constructor(
  private cwd: string,
  private agentModels: Record<string, { model: string; thinkingLevel: string }>,
  private modelRegistry: ModelRegistry,
  private defaultModelRef?: string,
  private defaultThinkingLevel?: string,
  private customTools?: any[],
) {}
```

- [ ] **Step 4: Update `createSession()` to resolve and pass model**

```typescript
const modelRef = this.agentModels[config.agentRole]?.model ?? this.defaultModelRef ?? "";
const thinkingLevel = this.agentModels[config.agentRole]?.thinkingLevel ?? this.defaultThinkingLevel ?? "medium";
const slashIndex = modelRef.indexOf("/");
const providerName = slashIndex < 0 ? "" : modelRef.slice(0, slashIndex);
const modelId = slashIndex < 0 ? modelRef : modelRef.slice(slashIndex + 1);
const model = this.modelRegistry.find(providerName, modelId);
if (!model) throw new Error(`Model "${modelId}" not found for provider "${providerName}". Check your forge.yaml agentModels config.`);
```

Then pass `model` and `thinkingLevel` to `createAgentSession()`:
```typescript
const { session } = await createAgentSession({
  cwd: config.cwd,
  resourceLoader: loader,
  sessionManager: SdkSessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory(),
  customTools: this.customTools ?? [],
  tools: config.tools,
  model,
  thinkingLevel: thinkingLevel as any,
});
```

Remove the old `const _resolved = this.modelResolver.resolveAgentModel(...)` line.

- [ ] **Step 5: Update existing tests for new constructor signature**

Update existing tests in `tests/agent/session-manager.test.ts` to pass a mock `ModelRegistry` instead of `{} as any` for the 3rd arg. The mock should have a `find()` method.

- [ ] **Step 6: Run test to verify it passes**

- [ ] **Step 7: Run all tests + typecheck + commit**

---

## Task 3: Wire ModelRegistry creation in launchTui()

**Modify:** `bin/forge.ts` — `launchTui()` function

- [ ] **Step 1: Replace ModelResolver section with ModelRegistry**

Remove:
- `const { ModelResolver } = await import("../src/agent/model-resolver");`
- `const agentDir = joinPath(FORGE_CONFIG_DIR, "agent");`
- `const modelResolver = new ModelResolver(agentDir);`
- The `modelResolver.registerProvider()` loop

Add:
- `const { AuthStorage, ModelRegistry } = await import("@earendil-works/pi-coding-agent");`
- `const { getBuiltinProviders } = await import("@earendil-works/pi-ai/providers/all");`
- `const { fetchModels } = await import("../src/agent/model-fetcher");`
- Create `AuthStorage.inMemory()` + `ModelRegistry.inMemory(authStorage)`
- For each provider in global config:
  - If built-in (in `getBuiltinProviders()` list): `modelRegistry.registerProvider(name, { apiKey, baseUrl })`
  - If custom: call `fetchModels(baseUrl, apiKey)`, construct `ProviderConfigInput` with `models[]` array, call `modelRegistry.registerProvider(name, { baseUrl, apiKey, api, models })`
- Pass `modelRegistry`, `globalConfig.defaultModel`, `globalConfig.defaultThinkingLevel` to `AgentSessionManager` constructor

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Run all tests + commit**

---

## Task 4: Fix agent profiles directory (Gap 3)

**Modify:** `src/cli/project-initializer.ts`
**Modify:** `bin/forge.ts` — `runInit()`
**Modify:** `tests/cli/project-initializer.test.ts`

- [ ] **Step 1: Write failing tests**

1. `initProject` copies agents to `opts.agentDir` when provided
2. `initProject` creates `agentDir` if it doesn't exist
3. `initProject` falls back to `cwd/agents/` when `agentDir` not provided

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update `ProjectInitializer.initProject()`**

Add `agentDir?: string` to `InitOptions`. Change agents copy:
```typescript
const agentsSrc = join(this.templatesDir, "agents");
const agentsDst = opts.agentDir ?? join(cwd, "agents");
if (existsSync(agentsSrc)) {
  mkdirSync(agentsDst, { recursive: true });
  cpSync(agentsSrc, agentsDst, { recursive: true });
}
```

- [ ] **Step 4: Update `runInit()` in `bin/forge.ts`**

Pass `agentDir` to `initProject()`:
```typescript
init.initProject(cwd, { agentDir: join(FORGE_CONFIG_DIR, "agent") });
```

- [ ] **Step 5: Run test to verify it passes**

- [ ] **Step 6: Run all tests + typecheck + commit**

---

## Task 5: Delete ModelResolver + clean up

- [ ] **Step 1: Delete `src/agent/model-resolver.ts`**
- [ ] **Step 2: Delete `tests/agent/model-resolver.test.ts`**
- [ ] **Step 3: Run typecheck** — verify no dangling imports
- [ ] **Step 4: Run all tests**
- [ ] **Step 5: Run lint**
- [ ] **Step 6: Commit**

---

## Task 6: Full verification

- [ ] **Step 1:** `bun test` — all pass
- [ ] **Step 2:** `tsc --noEmit` — 0 errors
- [ ] **Step 3:** `npx oxlint src/ tests/ bin/` — 0 warnings
- [ ] **Step 4:** `bun run build` — dist/forge.js created
- [ ] **Step 5:** `gitnexus detect_changes` — verify impact scope
- [ ] **Step 6:** Push to origin/main

---

## Issue Coverage Checklist

| Gap | Fixed in Task | How |
|---|---|---|
| 1. Resolved model never passed to SDK | Task 2 | `modelRegistry.find()` → `createAgentSession({ model })` |
| 2. Model catalog never populated | Task 1+3 | `fetchModels()` from `/models` endpoint → `modelRegistry.registerProvider({ models })` |
| 3. Agent profiles in wrong directory | Task 4 | `initProject({ agentDir })` → copies to `~/.config/forge/agent/` |
