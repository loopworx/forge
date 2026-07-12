import { parseArgs } from "node:util";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { ProjectInitializer } from "../src/cli/project-initializer";
import { FilePersistence } from "../src/engine/file-persistence";
import { LinearClient } from "../src/linear/linear-story-repository";
import { runOAuth } from "../src/linear/linear-oauth";

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

async function runSetup(): Promise<void> {
  console.log("Forge Setup — Global Configuration");
  console.log("==================================");
  console.log("");
  console.log("This will configure your AI providers and discover available models.");
  console.log("(Full setup wizard coming soon — for now, create ~/.config/forge/forge.yaml manually)");
  console.log("");
  console.log("Example config:");
  console.log("  providers:");
  console.log("    synthetic:");
  console.log('      baseUrl: "https://api.synthetic.dev/v1"');
  console.log('      apiKey: "$SYNTHETIC_API_KEY"');
  console.log('      api: "openai-responses"');
  console.log("");
  mkdirSync(FORGE_CONFIG_DIR, { recursive: true });
  console.log(`Config directory: ${FORGE_CONFIG_DIR}`);
  console.log("Run 'forge init' in your project directory after setup.");
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
  if (!existsSync(join(FORGE_CONFIG_DIR, "forge.yaml"))) {
    console.error("Forge is not configured. Run 'forge setup' first.");
    process.exit(1);
  }

  const { join: joinPath } = await import("node:path");
  const workdir = process.cwd();

  const projectYamlPath = joinPath(workdir, "forge.yaml");
  if (!existsSync(projectYamlPath)) {
    console.error("No forge.yaml found in the current directory. Run 'forge init' first.");
    process.exit(1);
  }

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

  const agentDir = joinPath(FORGE_CONFIG_DIR, "agent");
  const modelResolver = new ModelResolver(agentDir);
  const agentModels = forgeConfig.agentModels ?? {};
  const sessions = new AgentSessionManager(workdir, agentModels, modelResolver);

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

  const tools = new ToolRegistry();
  tools.registerForgeTools(engine, artifacts);

  const commands = new CommandRegistry();
  commands.register("forge-next", async () => {
    const state = engine.getProjectState();
    if (state.mode === "inception") {
      const next = state.inception.currentPhase + 1;
      const cfg = config.load();
      const lastPhase = cfg.inception.phases.at(-1)?.phase ?? 0;
      if (next > lastPhase) {
        engine.transitionToDevelopment();
      } else {
        engine.markInceptionPhaseStarted(next);
      }
    }
  });
  commands.register("forge-status", async () => {});
  commands.register("help", async () => {});

  const projectState = engine.getProjectState();
  const mode = projectState.mode;

  const renderer = await createForgeRenderer();

  const app = new ForgeApp({ renderer, engine, sessions, commands, mode });
  app.layout();

  events.subscribe((event) => {
    app.handleEngineEvent(event);
  });

  if (mode === "development") {
    engine.startPolling();
  }

  renderer.on("destroy", () => {
    engine.dispose();
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
