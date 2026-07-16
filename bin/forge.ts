import { parseArgs } from "node:util";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { ProjectInitializer } from "../src/cli/project-initializer";
import { FilePersistence } from "../src/engine/file-persistence";
import { LinearClient } from "../src/linear/linear-story-repository";
import { runOAuth } from "../src/linear/linear-oauth";
import { buildProviderList, testApiKey, mergeConfig, configToYaml, type ProviderEntry, type ModelChoice, type ConfigYaml } from "../src/cli/setup-wizard";

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
  while (true) {
    const providerChoice = await select<string>({
      message: "Select a provider to configure:",
      choices: [
        ...providerOptions.map((o) => ({
          name: `${o.name}${o.modelCount > 0 ? ` (${o.modelCount} models)` : ""}`,
          value: o.id,
        })),
        { name: "Done adding providers", value: "__done__" },
      ],
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
      // Built-in provider: baseUrl + api come from the catalog.
      baseUrl = selected!.baseUrl;
      const catalog = getBuiltinModels(providerChoice as never);
      api = catalog.length > 0 ? (catalog[0].api as string) : "openai-responses";
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

  console.log("\nForge initialized successfully.");
  console.log("Run 'forge' to start the TUI.");
  process.exit(0);
}

async function launchTui(): Promise<void> {
  // --- Guard: global config (Issue 2 source) ---
  if (!existsSync(join(FORGE_CONFIG_DIR, "forge.yaml"))) {
    console.error("Forge is not configured. Run 'forge setup' first.");
    process.exit(1);
  }

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
    // Resolve the inception phase to start/resume from (Task 2: previously hardcoded phase 0 + "po-agent")
    const { resolveInceptionPhase } = await import("../src/cli/inception-resolver");
    const state = engine.getProjectState();
    const loadedConfig = config.load();
    let resolution;
    try {
      resolution = resolveInceptionPhase(state, loadedConfig.inception.phases);
    } catch (err) {
      console.error((err as Error).message);
      return;
    }
    const { phaseIndex, agentRole } = resolution;
    const prompt = engine.buildInceptionPrompt(phaseIndex, workdir);
    if (!prompt) {
      console.error("No inception phases configured.");
      return;
    }
    engine.markInceptionPhaseStarted(phaseIndex);
    const session = await sessions.createSession({
      cwd: workdir,
      tools: ["read", "bash", "edit", "write", "grep", "glob", "forge_claim_story", "forge_complete_ac", "forge_handoff", "forge_create_artifact", "forge_log_progress"],
      agentRole: agentRole as any,
    });
    inceptionSessionId = session.sessionId;
    const { model, thinkingLevel } = sessions.resolveModel(agentRole);
    app.setModelInfo(agentRole, model.id, model.provider, thinkingLevel, model.maxTokens);
    session.subscribe((event) => {
      app.handleForgeEvent(event as any);
    });
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

  // --- /help command (needs app reference to display in ChatView) ---
  commands.register("help", async () => {
    const allCommands = commands.getAll().sort();
    app.getChatView().displayMessage("Available commands: " + allCommands.map(c => `/${c}`).join(", "));
  });

  // --- Wire InputBar callbacks (Issue 5) ---
  app.getInputBar().setOnSend(async (text: string) => {
    if (inceptionSessionId) {
      const session = sessions.getSession(inceptionSessionId);
      if (session) {
        await session.prompt(text);
      }
    } else {
      console.error("No active inception session. Type /forge-new to start.");
    }
  });

  app.getInputBar().setOnCommand((name: string, args: string) => {
    const handler = commands.get(name);
    if (handler) {
      handler(args, { cwd: workdir } as any).catch((err: Error) => {
        console.error(`Command /${name} failed: ${err.message}`);
      });
    } else {
      console.error(`Unknown command: /${name}`);
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
