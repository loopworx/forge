# Fix Remaining UX Gaps Plan

**Goal:** Fix 5 remaining non-blocking UX gaps with TDD.

## Global Constraints
- Bun runtime, TypeScript strict mode
- TDD: write failing test first, verify it fails, implement, verify it passes, commit
- `bin/forge.ts` is NOT in tsconfig's `include` — verify via `bun run build`
- `ChatView` at `src/tui/chat-view.ts` has `lines: string[]` and `updateContent()`
- `CommandRegistry.getAll()` returns registered command names
- `AgentSessionManager.resolveModel(role)` returns `{ model: any, thinkingLevel: string }`
- `StatusBar.setInfo(agent, model, provider, thinking, tokens, maxTokens, mode)`

## Task 1: `/help` command + ChatView.displayMessage (gap 2)

Add `displayMessage(text: string)` method to `ChatView` that pushes a line and renders. Register `/help` command that lists all available commands via `app.getChatView().displayMessage()`.

**Files:** `src/tui/chat-view.ts`, `bin/forge.ts`, `tests/tui/chat-view.test.ts`

Test: `displayMessage` adds line to output, renders it.

## Task 2: `/forge-new` resume from current phase (gaps 1 + 4)

`/forge-new` should use `state.inception.currentPhase` if already in inception mode, not hardcode `0`. Also add `api` fallback: `(providerConfig.api || "openai-responses")`.

**Files:** `bin/forge.ts`

## Task 3: StatusBar real model values (gap 3)

In `/forge-new`, call `sessions.resolveModel(role)` and pass real `model.id`, `model.provider`, `thinkingLevel`, `model.maxTokens`, `model.contextWindow` to `StatusBar.setInfo()`. In `handleForgeEvent`, use stored values instead of hardcoded strings.

**Files:** `src/tui/app.ts`, `bin/forge.ts`, `tests/tui/app.test.ts`

Test: `handleForgeEvent` with `agent_settled` updates StatusBar with stored model info (not placeholder strings).

## Task 4: Full verification

`bun test`, `tsc --noEmit`, `oxlint`, `bun run build`, push.
