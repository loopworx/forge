# Interactive forge setup Plan

**Goal:** Replace the stub `forge setup` with an interactive wizard that lists providers, asks for API key, tests it, shows models to select as default.

## Global Constraints
- Bun runtime, TypeScript strict mode
- TDD: write failing test first, verify it fails, implement, verify it passes, commit
- NO CODE BEFORE TESTS — strictly TDD
- `bin/forge.ts` is NOT in tsconfig's `include` — verify via `bun run build`
- `fetchModels(baseUrl, apiKey)` from `src/agent/model-fetcher.ts` fetches `/models` endpoint
- `getBuiltinProviders()` + `getBuiltinModels(id)` from `@earendil-works/pi-ai/providers/all`
- `@inquirer/prompts` provides `select()`, `password()`, `confirm()`, `input()`
- Config format: `providers: { name: { baseUrl, apiKey, api } }` + `defaultModel: "provider/modelId"` + `defaultThinkingLevel`

## Task 1: Pure functions in setup-wizard.ts (TDD)

Create `src/cli/setup-wizard.ts` with testable pure functions:
- `buildProviderList(providers)` — filters to providers with baseUrl, returns options + "custom"
- `testApiKey(baseUrl, apiKey, providerId?)` — tests key via fetchModels, falls back to catalog for built-ins
- `mergeConfig(existing, newProviders, defaultModel, thinkingLevel)` — merges config
- `configToYaml(config)` — serializes to YAML

Tests in `tests/cli/setup-wizard.test.ts` — all pure, no I/O.

## Task 2: Interactive runSetup() in bin/forge.ts

Replace stub with interactive flow using `@inquirer/prompts`. Add `--non-interactive` flag for tests/CI (writes old template).

## Task 3: Update existing tests for --non-interactive

Update `tests/cli/forge-setup.test.ts` to use `--non-interactive` flag.

## Task 4: Full verification + push
