import { parseArgs } from "node:util";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { ProjectInitializer } from "../src/cli/project-initializer";
import { FilePersistence } from "../src/engine/file-persistence";
import { LinearClient } from "../src/linear/linear-story-repository";
import { runOAuth } from "../src/linear/linear-oauth";
import { buildProviderList, buildSelectChoices, testApiKey, mergeConfig, configToYaml, type ProviderEntry, type ModelChoice, type ConfigYaml } from "../src/cli/setup-wizard";
import { createForgeLogger } from "../src/cli/forge-logger";
import { buildStartupBanner } from "../src/cli/startup-banner";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");
const FORGE_CONFIG_DIR = join(homedir(), ".config", "forge");

const TEMPLATE_CONFIG = `# ~/.config/forge/forge.yaml — Global Forge Configuration
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
  --non-interactive  Write a template config without prompts (setup only, CI/tests)
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
      "non-interactive": { type: "boolean", default: false },
    },
  });

  const command = args.positionals[0];

  if (command === "setup") {
    await runSetup(args.values["non-interactive"] ?? false);
    return;
  }

  if (command === "init") {
    await runInit(args.values.cwd ?? process.cwd(), args.values["skip-auth"] ?? false, args.values["re-auth"] ?? false);
    return;
  }

  if (!command || command === "help") {
    await launchTui();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
}

async function runSetup(nonInteractive: boolean): Promise<void> {
  mkdirSync(FORGE_CONFIG_DIR, { recursive: true });
  const configPath = join(FORGE_CONFIG_DIR, "forge.yaml");

  // Non-interactive path: write the template config for CI/tests.
  if (nonInteractive) {
    if (existsSync(configPath)) {
      console.log(`Config already exists: ${configPath}`);
      console.log("Edit it manually to add providers, or re-run 'forge setup' (interactive) to merge new providers.");
      process.exit(0);
    }
    writeFileSync(configPath, TEMPLATE_CONFIG);
    console.log(`Config written to: ${configPath}`);
    console.log("");
    console.log("Next steps:");
    console.log("1. Edit the config to add your AI provider and API key");
    console.log("2. Run 'forge init' in your project directory");
    process.exit(0);
  }

  const { select, password, confirm, input } = await import("@inquirer/prompts");
  const { builtinProviders, getBuiltinModels } = await import("@earendil-works/pi-ai/providers/all");

  console.log("Forge Setup — Global Configuration");
  console.log("==================================");
  console.log("");

  // 1. Read existing config (if any) so new providers can be merged in.
  let existingConfig: ConfigYaml | null = null;
  if (existsSync(configPath)) {
    try {
      const { parse: parseYaml } = await import("yaml");
      const raw = readFileSync(configPath, "utf-8");
      const parsed = parseYaml(raw) as Partial<ConfigYaml> | null;
      if (parsed && parsed.providers) {
        existingConfig = {
          providers: parsed.providers as Record<string, ProviderEntry>,
          defaultModel: parsed.defaultModel ?? "",
          defaultThinkingLevel: parsed.defaultThinkingLevel ?? "high",
        };
        console.log(`Found existing config: ${configPath}`);
        console.log("New providers will be merged with existing ones.\n");
      }
    } catch {
      console.log("Existing config is unreadable; starting fresh.\n");
    }
  }

  // 2. Build the provider option list from the built-in catalog.
  const allProviders = builtinProviders();
  const providerOptions = buildProviderList(
    allProviders as { id: string; name: string; baseUrl?: string }[],
    (id: string) => getBuiltinModels(id as never) as unknown[],
  );

  // Convert a built-in provider's catalog to ModelChoice[] for the testApiKey fallback.
  const catalogToChoices = (id: string): ModelChoice[] => {
    const models = getBuiltinModels(id as never);
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      providerId: id,
      api: m.api as string,
    }));
  };

  const THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;

  const newProviders: Record<string, ProviderEntry> = {};
  const providerDefaults: { configKey: string; providerName: string; modelId: string; modelName: string }[] = [];

  // 3. Add-provider loop.
  const providerChoices = [
    ...buildSelectChoices(providerOptions),
    { name: "Done adding providers", value: "__done__" },
  ];

  while (true) {
    const providerChoice = await select<string>({
      message: "Select a provider to configure:",
      choices: providerChoices as any,
      pageSize: Math.min(providerChoices.length, 30),
      loop: false,
    });

    if (providerChoice === "__done__") break;

    const isCustom = providerChoice === "custom";
    const selected = providerOptions.find((o) => o.id === providerChoice);
    const displayName = isCustom ? "Custom Provider" : (selected?.name ?? providerChoice);

    let baseUrl: string;
    let api: string;
    let configKey: string;

    if (isCustom) {
      // 3b. Custom provider: prompt for Base URL, API type, and a config key.
      baseUrl = (await input({
        message: "Base URL:",
        validate: (v) => (v.trim() ? true : "Required"),
      })).trim();

      api = (await input({
        message: "API type",
        default: "openai-responses",
        validate: (v) => (v.trim() ? true : "Required"),
      })).trim() || "openai-responses";

      configKey = (await input({
        message: "Provider name (key in config):",
        default: "custom",
        validate: (v) => (v.trim() ? true : "Required"),
      })).trim();
    } else {
      baseUrl = selected!.baseUrl;
      api = selected!.api || "openai-responses";
      configKey = selected!.id;
    }

    // 3c-d. Enter and test the API key.
    const apiKey = await password({ message: `Enter API key for ${displayName}:` });

    console.log("Testing API key...");
    const testResult = await testApiKey(baseUrl, apiKey, configKey, isCustom ? undefined : catalogToChoices);

    if (testResult.success && testResult.models.length > 0) {
      // 3f. Select this provider's default model.
      const modelId = await select<string>({
        message: `Select default model for ${displayName}:`,
        choices: testResult.models.map((m) => ({ name: m.name, value: m.id })),
        loop: false,
      });
      const chosen = testResult.models.find((m) => m.id === modelId);
      providerDefaults.push({
        configKey,
        providerName: displayName,
        modelId,
        modelName: chosen?.name ?? modelId,
      });
      newProviders[configKey] = { baseUrl, apiKey, api };
      console.log(`✓ ${displayName} configured with model ${modelId}\n`);
    } else if (testResult.success) {
      // 3g. Key works but no models surfaced.
      console.log("API key works but no models found.\n");
      newProviders[configKey] = { baseUrl, apiKey, api };
    } else {
      // 3h. Key test failed — optionally keep anyway.
      console.error(`API key test failed: ${testResult.error ?? "unknown error"}`);
      const keep = await confirm({ message: "Continue anyway?", default: false });
      if (keep) {
        newProviders[configKey] = { baseUrl, apiKey, api };
      }
    }

    // 3i. Add another provider?
    if (!(await confirm({ message: "Add another provider?", default: true }))) break;
  }

  // 4. No providers configured.
  if (Object.keys(newProviders).length === 0) {
    console.log("No providers configured. Run 'forge setup' again to add providers.");
    const minimal = mergeConfig(
      existingConfig,
      {},
      existingConfig?.defaultModel ?? "",
      existingConfig?.defaultThinkingLevel ?? "high",
    );
    writeFileSync(configPath, configToYaml(minimal));
    console.log(`Config written to: ${configPath}`);
    process.exit(0);
  }

  // 5. Select the global default model from each provider's selected model.
  const defaultModelChoices = providerDefaults.map((d) => ({
    name: `${d.providerName} / ${d.modelName}`,
    value: `${d.configKey}/${d.modelId}`,
  }));
  const existingDefault = existingConfig?.defaultModel ?? "";
  if (existingDefault && !defaultModelChoices.some((c) => c.value === existingDefault)) {
    defaultModelChoices.unshift({ name: `${existingDefault} (current)`, value: existingDefault });
  }

  let defaultModel: string;
  if (defaultModelChoices.length > 0) {
    const initialDefault =
      existingDefault && defaultModelChoices.some((c) => c.value === existingDefault)
        ? existingDefault
        : undefined;
    defaultModel = await select<string>({
      message: "Select your default model:",
      default: initialDefault,
      choices: defaultModelChoices,
      loop: false,
    });
  } else {
    defaultModel = existingDefault;
    console.log("No models available to select; keeping existing default.");
  }

  // 6. Thinking level.
  const currentThinking = existingConfig?.defaultThinkingLevel ?? "high";
  const thinkingLevel = await select<string>({
    message: "Thinking level:",
    default: (THINKING_LEVELS as readonly string[]).includes(currentThinking) ? currentThinking : "high",
    choices: THINKING_LEVELS.map((lvl) => ({ name: lvl, value: lvl })),
    loop: false,
  });

  // 7-8. Merge and write.
  const merged = mergeConfig(existingConfig, newProviders, defaultModel, thinkingLevel);
  writeFileSync(configPath, configToYaml(merged));

  // 9-10. Success.
  console.log(`\n✓ Config written to ${configPath}`);
  console.log("Next steps: Run 'forge init' in your project directory");
  process.exit(0);
}

async function runInit(cwd: string, skipAuth: boolean, reAuth: boolean): Promise<void> {
  if (!existsSync(join(FORGE_CONFIG_DIR, "forge.yaml"))) {
    console.error("Forge is not configured. Run 'forge setup' first.");
    process.exit(1);
  }

  const persistenceDir = join(cwd, ".forge");
  const persistence = new FilePersistence(persistenceDir);
  const init = new ProjectInitializer(TEMPLATES_DIR, persistence);

  if (init.isInitialized(cwd)) {
    console.error("Forge already initialized in this directory.");
    process.exit(1);
  }

  console.log("Initializing Forge project...");
  init.initProject(cwd, { agentDir: join(FORGE_CONFIG_DIR, "agent") });

  if (!skipAuth) {
    console.log("\nLinear Authentication");
    console.log("=====================");
    const authPath = join(persistenceDir, "auth.json");

    if (reAuth) {
      try { rmSync(authPath, { force: true }); } catch {}
    }

    try {
      console.log("Opening browser for Linear OAuth...");
      console.log("If the browser doesn't open, visit:");
      console.log("  https://linear.app/login");
      console.log("Then switch your workspace (top-right dropdown).");
      console.log("\nWaiting for authentication...");
      await runOAuth(authPath);
      console.log("Linear authenticated successfully!");

      const linear = new LinearClient({ authPath });
      const team = await linear.discoverTeam();
      if (team) {
        console.log(`Discovered team: ${team.name} (${team.id})`);
        const yamlPath = join(cwd, "forge.yaml");
        let yaml = readFileSync(yamlPath, "utf-8");
        yaml = yaml.replace(/teamId:\s*""/, `teamId: "${team.id}"`);
        yaml = yaml.replace(/teamName:\s*""/, `teamName: "${team.name}"`);
        writeFileSync(yamlPath, yaml);

        console.log("\nCreating Linear workflow states...");
        const result = await linear.ensureWorkflowStates();
        console.log(`  Created: ${result.created.length} states`);
        console.log(`  Existing: ${result.existing.length} states`);
        if (result.skipped.length > 0) {
          console.log(`  Skipped: ${result.skipped.length}`);
        }
      } else {
        const teams = await linear.listTeams();
        if (teams.length > 1) {
          console.log("\nMultiple teams found:");
          teams.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} (${t.id})`));
          console.log("\nPlease re-run with --team-id <id> to select a team.");
        } else {
          console.log("No teams found in your Linear account.");
        }
      }
    } catch (err) {
      console.error(`Linear auth failed: ${(err as Error).message}`);
      console.error("You can re-run with --re-auth later.");
      console.error("Continuing without auth...\n");
    }
  }

  // --- Per-agent model assignment ---
  await assignAgentModels(cwd);

  console.log("\nForge initialized successfully.");
  console.log("Run 'forge' to start the TUI.");
  process.exit(0);
}

async function assignAgentModels(cwd: string): Promise<void> {
  const { select } = await import("@inquirer/prompts");
  const { parse: parseYaml, stringify: stringifyYaml } = await import("yaml");
  const { loadAgentProfiles, buildAgentModelChoices, formatAgentModelsYaml } = await import("../src/cli/agent-model-assigner");
  const { getBuiltinProviders, getBuiltinModels } = await import("@earendil-works/pi-ai/providers/all");
  const { fetchModels } = await import("../src/agent/model-fetcher");

  const globalConfigPath = join(FORGE_CONFIG_DIR, "forge.yaml");
  if (!existsSync(globalConfigPath)) return;
  const globalRaw = readFileSync(globalConfigPath, "utf-8");
  const globalConfig = parseYaml(globalRaw) as {
    providers?: Record<string, { baseUrl: string; apiKey: string; api: string }>;
  };
  if (!globalConfig.providers) return;

  const allModels: Array<{ providerId: string; modelId: string; name: string }> = [];
  const builtinProviders = getBuiltinProviders();
  for (const [name, providerConfig] of Object.entries(globalConfig.providers)) {
    if (!providerConfig.baseUrl || !providerConfig.apiKey) continue;
    if (builtinProviders.includes(name as any)) {
      const models = getBuiltinModels(name as never);
      for (const m of models) {
        allModels.push({ providerId: name, modelId: m.id, name: m.name });
      }
    } else {
      const fetched = await fetchModels(providerConfig.baseUrl, providerConfig.apiKey);
      for (const m of fetched) {
        allModels.push({ providerId: name, modelId: m.id, name: m.name });
      }
    }
  }

  if (allModels.length === 0) {
    console.log("\nNo models available. Skipping per-agent model assignment.");
    console.log("You can manually configure agentModels in forge.yaml later.");
    return;
  }

  console.log("\nPer-Agent Model Assignment");
  console.log("==========================");

  const profiles = loadAgentProfiles(TEMPLATES_DIR);
  if (profiles.length === 0) {
    console.log("No agent profiles found. Skipping.");
    return;
  }

  const choices = buildAgentModelChoices(profiles, allModels);
  const assignments: Record<string, { model: string; thinkingLevel: string }> = {};

  for (const profile of profiles) {
    console.log(`\n${profile.name}: ${profile.description}`);
    const modelValue = await select({
      message: `Select model for ${profile.role}:`,
      choices: choices[profile.role],
      loop: false,
    });
    const thinkingLevel = await select({
      message: `Thinking level for ${profile.role}:`,
      choices: [
        { name: "minimal", value: "minimal" },
        { name: "low", value: "low" },
        { name: "medium", value: "medium" },
        { name: "high", value: "high" },
        { name: "xhigh", value: "xhigh" },
        { name: "max", value: "max" },
      ],
      default: "high",
      loop: false,
    });
    assignments[profile.role] = { model: modelValue, thinkingLevel };
  }

  const yamlPath = join(cwd, "forge.yaml");
  let yamlContent = readFileSync(yamlPath, "utf-8");
  const agentModelsYaml = formatAgentModelsYaml(assignments);
  const parsed = parseYaml(yamlContent) as any;
  parsed.agentModels = parseYaml(agentModelsYaml).agentModels;
  writeFileSync(yamlPath, stringifyYaml(parsed));
  console.log("\n\u2713 Agent models written to forge.yaml");
}

async function launchTui(): Promise<void> {
  // --- Guard: global config (Issue 2 source) ---
  if (!existsSync(join(FORGE_CONFIG_DIR, "forge.yaml"))) {
    console.error("Forge is not configured. Run 'forge setup' first.");
    process.exit(1);
  }

  const logPath = join(FORGE_CONFIG_DIR, "forge.log");
  const logger = createForgeLogger(logPath);
  logger.info("=== Forge TUI starting ===");

  // --- Guard: project config ---
  const { join: joinPath } = await import("node:path");
  const workdir = process.cwd();
  const projectYamlPath = joinPath(workdir, "forge.yaml");
  if (!existsSync(projectYamlPath)) {
    console.error("No forge.yaml found in the current directory. Run 'forge init' first.");
    process.exit(1);
  }

  // --- Dynamic imports ---
  const { readFileSync: readFile } = await import("node:fs");
  const { parse: parseYaml } = await import("yaml");
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
  const { AuthStorage, ModelRegistry } = await import("@earendil-works/pi-coding-agent");
  const { getBuiltinProviders } = await import("@earendil-works/pi-ai/providers/all");
  const { fetchModels } = await import("../src/agent/model-fetcher");
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

  // --- AuthStorage + ModelRegistry (replaces ModelResolver) ---
  const globalYamlPath = joinPath(FORGE_CONFIG_DIR, "forge.yaml");
  const globalRaw = readFile(globalYamlPath, "utf-8");
  const globalConfig = parseYaml(globalRaw) as {
    providers?: Record<string, { baseUrl: string; apiKey: string; api: string }>;
    defaultModel?: string;
    defaultThinkingLevel?: string;
  };

  const authStorage = AuthStorage.inMemory();
  const modelRegistry = ModelRegistry.inMemory(authStorage);

  const builtinProviders = getBuiltinProviders();

  if (globalConfig.providers) {
    for (const [name, providerConfig] of Object.entries(globalConfig.providers)) {
      if (!providerConfig.baseUrl || !providerConfig.apiKey) continue;

      logger.info(`Registering provider: ${name} (${providerConfig.baseUrl})`);
      authStorage.setRuntimeApiKey(name, providerConfig.apiKey);

      if (builtinProviders.includes(name as any)) {
        // Built-in provider — catalog already loaded, just override baseUrl + apiKey
        modelRegistry.registerProvider(name, {
          apiKey: providerConfig.apiKey,
          baseUrl: providerConfig.baseUrl,
        });
      } else {
        // Custom provider — fetch models from /models endpoint
        const fetched = await fetchModels(providerConfig.baseUrl, providerConfig.apiKey);
        const modelDefs = fetched.map((m) => ({
          id: m.id,
          name: m.name,
          api: (providerConfig.api || "openai-responses") as any,
          provider: name,
          baseUrl: providerConfig.baseUrl,
          reasoning: true,
          input: ["text"] as ("text" | "image")[],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1000000,
          maxTokens: 16384,
        }));

        if (modelDefs.length === 0) {
          console.error(`Warning: No models found for provider "${name}" at ${providerConfig.baseUrl}/models. Sessions using this provider will fail.`);
        }

        modelRegistry.registerProvider(name, {
          baseUrl: providerConfig.baseUrl,
          apiKey: providerConfig.apiKey,
          api: (providerConfig.api || "openai-responses") as any,
          models: modelDefs,
        });
      }
    }
  }

  // --- AgentSessionManager (engine needs to exist before forge tools, see below) ---
  const agentModels = forgeConfig.agentModels ?? {};
  const sessions = new AgentSessionManager(
    workdir,
    agentModels,
    modelRegistry,
    globalConfig.defaultModel || undefined,
    globalConfig.defaultThinkingLevel || undefined,
    undefined,
    authStorage,
  );

  // --- WorkflowEngine (Issue 14: null as any for unused _runtime param — acceptable) ---
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

  // --- ToolRegistry: register forge tools with REAL engine reference, then pass defs to sessions (Issue 3) ---
  // Construction-order cycle: engine needs `sessions`; forge tools need `engine`.
  // So build sessions (empty) -> engine -> register tools -> inject defs into sessions via setter.
  const toolRegistry = new ToolRegistry();
  const customTools = toolRegistry.registerForgeTools(engine, artifacts);
  sessions.setCustomTools(customTools);

  // --- CommandRegistry with ALL 5 commands (Issue 7, 8) ---
  const commands = new CommandRegistry();

  // Track the active inception session across commands
  let inceptionSessionId: string | null = null;

  commands.register("forge-new", async () => {
    const { resolveInceptionPhase } = await import("../src/cli/inception-resolver");
    const state = engine.getProjectState();
    const loadedConfig = config.load();
    let resolution;
    try {
      resolution = resolveInceptionPhase(state, loadedConfig.inception.phases);
    } catch (err) {
      const msg = (err as Error).message;
      app.getChatView().displayMessage(`\u2717 ${msg}`);
      logger.error(`forge-new: ${msg}`);
      return;
    }
    const { phaseIndex, agentRole } = resolution;
    const phase = loadedConfig.inception.phases[phaseIndex];
    app.getChatView().displayMessage(`\u2699 Starting inception phase ${phaseIndex + 1}/${loadedConfig.inception.phases.length}: ${phase?.name ?? "Unknown"}...`);
    logger.info(`forge-new: starting phase ${phaseIndex} (${phase?.name}), agent=${agentRole}`);

    const prompt = engine.buildInceptionPrompt(phaseIndex, workdir);
    if (!prompt) {
      app.getChatView().displayMessage("\u2717 No inception phases configured.");
      logger.error("forge-new: no inception phases configured");
      return;
    }
    engine.markInceptionPhaseStarted(phaseIndex);

    let session;
    try {
      session = await sessions.createSession({
        cwd: workdir,
        tools: ["read", "bash", "edit", "write", "grep", "glob", "forge_claim_story", "forge_complete_ac", "forge_handoff", "forge_create_artifact", "forge_log_progress"],
        agentRole: agentRole as any,
      });
    } catch (err) {
      const msg = (err as Error).message;
      app.getChatView().displayMessage(`\u2717 Failed to create session: ${msg}`);
      logger.error(`forge-new: createSession failed: ${msg}`, err as Error);
      return;
    }

    inceptionSessionId = session.sessionId;
    let model, thinkingLevel;
    try {
      const resolved = sessions.resolveModel(agentRole);
      model = resolved.model;
      thinkingLevel = resolved.thinkingLevel;
      app.setModelInfo(agentRole, model.id, model.provider, thinkingLevel, model.maxTokens);
    } catch (err) {
      const msg = (err as Error).message;
      app.getChatView().displayMessage(`\u2717 Model resolution failed: ${msg}`);
      logger.error(`forge-new: resolveModel failed: ${msg}`, err as Error);
      return;
    }

    app.getChatView().displayMessage(`\u2713 Session created (model: ${model.id}, provider: ${model.provider})`);
    logger.info(`forge-new: session created, model=${model.id}, provider=${model.provider}`);

    session.subscribe((event) => {
      logger.info(`SDK event: type=${event.type}`);
      app.handleForgeEvent(event as any);
    });
    app.getChatView().setThinking(true);

    // --- Context usage poller: refreshes the right-aligned status segment ---
    // The SDK exposes `session.getContextUsage()` returning
    // `{ tokens, contextWindow, percent }`. We poll every 750ms while a
    // session is active and reflect the live numbers in the status bar
    // (replaces the static "0.0%" that used to be shown).
    const usageTimer = setInterval(() => {
      try {
        const usage = session.getContextUsage?.();
        if (usage && usage.tokens !== null && usage.percent !== null) {
          app.updateContextUsage(usage.tokens, usage.contextWindow, usage.percent);
        }
      } catch (err) {
        logger.debug(`usage poller: ${(err as Error).message}`);
      }
    }, 750);
    logger.info("forge-new: usage poller started");

    logger.info("forge-new: sending prompt to agent...");
    try {
      await session.prompt(prompt);
      logger.info("forge-new: prompt completed successfully");
    } catch (err) {
      const msg = (err as Error).message;
      app.getChatView().displayMessage(`\u2717 Agent prompt failed: ${msg}`);
      logger.error(`forge-new: prompt failed: ${msg}`, err as Error);
    } finally {
      // One final synchronous poll so the status bar reflects the latest
      // usage snapshot after `agent_settled` before tearing down the timer.
      try {
        const usage = session.getContextUsage?.();
        if (usage && usage.tokens !== null && usage.percent !== null) {
          app.updateContextUsage(usage.tokens, usage.contextWindow, usage.percent);
        }
      } catch {}
      clearInterval(usageTimer);
    }
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
    // Build the prompt for the next phase and dispatch to the existing session (Issues 7, 8)
    const prompt = engine.buildInceptionPrompt(nextPhase, workdir);
    if (!prompt || !inceptionSessionId) return;
    engine.markInceptionPhaseStarted(nextPhase);
    const session = sessions.getSession(inceptionSessionId);
    if (session) {
      await session.prompt(prompt);
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

  // --- Show startup banner ---
  const loadedConfig = config.load();
  app.getChatView().displayMessage(buildStartupBanner(projectState, loadedConfig.inception.phases));
  logger.info(`TUI launched. Mode: ${mode}, Phase: ${projectState.inception.currentPhase}`);

  // --- Question modal: detect questions in agent responses ---
  // Uses the native SelectOverlay instead of @inquirer/prompts select() —
  // the readline-based inquirer select fights with OpenTUI for stdin
  // ownership (raw mode toggling) and previously caused forge to exit on
  // selection (OpenTUI's SIGINT handler fired while stdin was being
  // restored by inquirer). SelectOverlay is an OpenTUI native renderable
  // that shares the render loop's input model — no conflict.
  app.setOnQuestion(async (agentText: string) => {
    const { extractSuggestions } = await import("../src/tui/question-modal");
    const { SelectOverlay } = await import("../src/tui/select-overlay");
    const suggestions = extractSuggestions(agentText);
    app.getChatView().displayMessage("\u2753 Question detected — select an answer:");
    const overlay = new SelectOverlay(app.getRenderer(), {
      title: "Your answer:",
      options: suggestions.map(s => ({ name: s, description: "", value: s })),
    });
    try {
      const answer = await overlay.showAsPromise();
      if (answer === "Write your own answer") {
        app.getInputBar().focus();
      } else {
        app.getInputBar().setInput(answer);
        app.getInputBar().focus();
      }
    } catch {
      // User pressed ESC — just return focus to the input bar.
      app.getInputBar().focus();
    }
  });

  // --- /help command (needs app reference to display in ChatView) ---
  commands.register("help", async () => {
    const allCommands = commands.getAll().sort();
    app.getChatView().displayMessage("Available commands: " + allCommands.map(c => `/${c}`).join(", "));
  });

  // --- /exit command: gracefully dispose engine + renderer ---
  commands.register("exit", async () => {
    logger.info("user requested exit via /exit command");
    try {
      engine.dispose();
    } catch (err) {
      logger.error(`engine.dispose() failed during /exit: ${(err as Error).message}`);
    }
    try {
      renderer.destroy();
    } catch (err) {
      logger.error(`renderer.destroy() failed during /exit: ${(err as Error).message}`);
    }
    process.exit(0);
  });

  // --- /sessions command: list and resume sessions ---
  // Uses native SelectOverlay (not @inquirer/prompts select()) — see the
  // question-modal comment above for why.
  commands.register("sessions", async () => {
    const { SelectOverlay } = await import("../src/tui/select-overlay");
    app.getChatView().displayMessage("\u2699 Loading sessions...");
    const sessionList = await sessions.listSessions(workdir);
    if (sessionList.length === 0) {
      app.getChatView().displayMessage("No sessions found. Type /forge-new to start.");
      return;
    }

    const overlayOptions = sessionList.map(s => ({
      name: s.name,
      description: `${s.modified.toLocaleDateString()} ${s.modified.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}`,
      value: s.path,
    }));
    const overlay = new SelectOverlay(app.getRenderer(), {
      title: "Resume session:",
      options: overlayOptions,
    });

    let selectedPath: string | null = null;
    try {
      selectedPath = await overlay.showAsPromise();
    } catch {
      // ESC — user cancelled.
      app.getChatView().displayMessage("Session resume cancelled.");
      app.getInputBar().focus();
      return;
    }

    if (!selectedPath) {
      app.getInputBar().focus();
      return;
    }

    app.getChatView().displayMessage(`\u21bb Resuming session ${selectedPath.split("/").pop()}...`);
    logger.info(`sessions: resuming ${selectedPath}`);

    // Determine which agent role to use. The project state tells us whether
    // we're in inception (use the current phase's agent) or development
    // (developer-agent). For now, since resume was primarily designed for
    // inception sessions (per the plan), use the current inception phase's
    // agent role when in inception mode, and developer-agent otherwise.
    const projectState = engine.getProjectState();
    const loadedConfig = config.load();
    let agentRole: string;
    if (projectState.mode === "inception") {
      const { resolveInceptionPhase } = await import("../src/cli/inception-resolver");
      try {
        const resolution = resolveInceptionPhase(projectState, loadedConfig.inception.phases);
        agentRole = resolution.agentRole;
      } catch {
        agentRole = "po-agent";
      }
    } else {
      agentRole = "developer-agent";
    }

    let resumedSession;
    try {
      resumedSession = await sessions.resumeSession(selectedPath, {
        cwd: workdir,
        tools: ["read", "bash", "edit", "write", "grep", "glob", "forge_claim_story", "forge_complete_ac", "forge_handoff", "forge_create_artifact", "forge_log_progress"],
        agentRole: agentRole as any,
      });
    } catch (err) {
      const msg = (err as Error).message;
      app.getChatView().displayMessage(`\u2717 Failed to resume session: ${msg}`);
      logger.error(`sessions: resumeSession failed: ${msg}`, err as Error);
      app.getInputBar().focus();
      return;
    }

    inceptionSessionId = resumedSession.sessionId;

    // Wire model info into the status bar.
    try {
      const resolved = sessions.resolveModel(agentRole);
      app.setModelInfo(agentRole, resolved.model.id, resolved.model.provider, resolved.thinkingLevel, resolved.model.maxTokens);
      // Refresh the status bar immediately so the resumed session's model
      // appears in the bar without waiting for the first agent_settled
      // event (which only fires after the user types something).
      app.refreshStatusBar();
    } catch (err) {
      logger.error(`sessions: resolveModel failed during resume: ${(err as Error).message}`);
    }

    // Update project state so the sidebar shows the correct inception phase
    // for the resumed session. Find the phase whose agent matches the
    // resolved agent role, mark it as started (this updates
    // projectState.inception.currentPhase + phaseSessionId AND publishes a
    // "phase_started" engine event → handleEngineEvent fires → sidebar
    // refreshes automatically). Then call app.refreshSidebar() as a safety
    // net for cases where the engine event doesn't fire (e.g. agent role
    // not found in phases, or development mode).
    const phaseIndex = loadedConfig.inception.phases.findIndex(
      (p: any) => p.agent === agentRole,
    );
    if (phaseIndex >= 0 && projectState.mode === "inception") {
      engine.markInceptionPhaseStarted(phaseIndex, resumedSession.sessionId);
      logger.info(`sessions: marked inception phase ${phaseIndex} as started for resumed session`);
    }
    app.refreshSidebar();

    // Subscribe to the resumed session's events.
    resumedSession.subscribe((event) => {
      logger.info(`SDK event (resumed): type=${event.type}`);
      app.handleForgeEvent(event as any);
    });

    // Replay the existing session history into ChatView so the user sees
    // the full conversation structure (user prompts, assistant responses,
    // tool calls, compaction summaries, model changes) — not just a blank
    // chat. Uses the SDK's sessionManager.buildContextEntries() exposed via
    // our Session.getHistory() extension.
    try {
      const entries = resumedSession.getHistory?.() ?? [];
      if (entries.length > 0) {
        const { replaySessionHistory } = await import("../src/tui/session-history");
        replaySessionHistory(app.getChatView(), entries);
        logger.info(`sessions: replayed ${entries.length} history entries`);
      } else {
        logger.info("sessions: no history entries to replay");
      }
    } catch (err) {
      logger.error(`sessions: history replay failed: ${(err as Error).message}`);
      app.getChatView().displayMessage(`(history replay failed: ${(err as Error).message})`);
    }

    // Start the context-usage poller for the resumed session.
    const usageTimer = setInterval(() => {
      try {
        const usage = resumedSession.getContextUsage?.();
        if (usage && usage.tokens !== null && usage.percent !== null) {
          app.updateContextUsage(usage.tokens, usage.contextWindow, usage.percent);
        }
      } catch (err) {
        logger.debug(`usage poller (resumed): ${(err as Error).message}`);
      }
    }, 750);

    // Clear timer on renderer destroy (e.g. /exit, Ctrl+C).
    renderer.on("destroy", () => clearInterval(usageTimer));

    app.getChatView().displayMessage(`\u2713 Session resumed (${resumedSession.sessionId.slice(0, 8)}...)`);
    app.getInputBar().focus();
  });

  // --- Wire InputBar callbacks (Issue 5) ---
  app.getInputBar().setOnSend(async (text: string) => {
    if (inceptionSessionId) {
      const session = sessions.getSession(inceptionSessionId);
      if (session) {
        app.getChatView().displayUserMessage(text);
        app.getChatView().setThinking(true);
        try {
          await session.prompt(text);
        } catch (err) {
          app.getChatView().displayMessage(`\u2717 Failed to send message: ${(err as Error).message}`);
          logger.error(`setOnSend: prompt failed: ${(err as Error).message}`, err as Error);
        }
      }
    } else {
      app.getChatView().displayMessage("No active session. Type /forge-new to start.");
    }
  });

  app.getInputBar().setOnCommand((name: string, args: string) => {
    const handler = commands.get(name);
    if (handler) {
      handler(args, { cwd: workdir } as any).catch((err: Error) => {
        app.getChatView().displayMessage(`\u2717 Command /${name} failed: ${err.message}`);
        logger.error(`Command /${name} failed: ${err.message}`, err);
      });
    } else {
      app.getChatView().displayMessage(`Unknown command: /${name}. Type /help for available commands.`);
    }
  });

  app.getInputBar().focus();

  // --- Wire engine events to TUI (sidebar/statusbar refresh) ---
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

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
