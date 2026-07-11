import type { AgentRole } from "../engine/types";
import type { AgentRuntime, SessionManager, CommandContext, CommandHandler } from "../engine/interfaces";
import { WorkflowEngine } from "../engine/workflow-engine";
import { FilePersistence } from "../engine/file-persistence";
import { SystemClock } from "../engine/system-clock";
import { EngineEventBus } from "../engine/events";
import { GitProofValidator } from "../engine/git-proof-validator";
import { YamlConfig } from "../config/config-loader";
import { PromptBuilderImpl } from "../prompts/prompt-builder";
import { LinearClient } from "../linear/linear-story-repository";
import { LinearStoryRepository } from "../linear/linear-story-repository";
import { LinearDocumentRepository } from "../linear/linear-document-repository";
import { ForgeSidebarComponent } from "../dashboard/forge-sidebar-component";
import { TabManager } from "../dashboard/tab-manager";
import { AgentConversationBuffer } from "../dashboard/agent-conversation-buffer";
import { ForgeDevDashboard } from "../dashboard/forge-dev-dashboard";
import { ForgeInceptionDashboard } from "../dashboard/forge-inception-dashboard";
import { join } from "node:path";

function log(tag: string, msg: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  console.error(`[forge ${ts}] ${tag}: ${msg}`, ...args.length ? args : []);
}

export interface ForgeComposition {
  engine: WorkflowEngine;
  runtime: AgentRuntime;
  uiState: { ctx: CommandContext | null };
}

export function createForgeComposition(
  workdir: string,
  runtime: AgentRuntime,
  sessions: SessionManager,
  sendUserMessage: (content: string) => void,
): ForgeComposition {
  log("composition", `createForgeComposition (workdir=${workdir})`);

  const config = new YamlConfig(join(workdir, "forge.yaml"));
  const clock = new SystemClock();
  const events = new EngineEventBus();
  const persistence = new FilePersistence(join(workdir, ".forge"));
  const proof = new GitProofValidator(workdir);
  const prompts = new PromptBuilderImpl();

  const authPath = join(workdir, ".forge", "auth.json");
  const linear = new LinearClient({ authPath });
  const loadedConfig = config.load();
  log("composition", `config loaded: active=${loadedConfig.active} teamId=${loadedConfig.linear.teamId ?? "(none)"} mode=${loadedConfig.inception.phases?.length ?? 0} phases`);
  if (loadedConfig.linear.teamId) linear.teamId = loadedConfig.linear.teamId;
  if (loadedConfig.linear.teamName) linear.teamName = loadedConfig.linear.teamName;
  const stories = new LinearStoryRepository(linear);
  const artifacts = new LinearDocumentRepository(linear);

  const engine = new WorkflowEngine(
    stories, artifacts, persistence, sessions,
    proof, prompts, config, clock, events, runtime, workdir,
  );
  log("composition", "WorkflowEngine constructed");

  const uiState: { ctx: CommandContext | null } = { ctx: null };

  const sidebarComponent = new ForgeSidebarComponent();
  const tabManager = new TabManager();
  const conversationBuffers = new Map<string, AgentConversationBuffer>();
  const inceptionBuffer = new AgentConversationBuffer("inception");
  const commandHandlers = new Map<string, CommandHandler>();

  let inceptionDashboard: ForgeInceptionDashboard | null = null;
  let devDashboard: ForgeDevDashboard | null = null;
  let inceptionHandle: { hide: () => void } | null = null;
  let devHandle: { hide: () => void } | null = null;
  let storedTui: { requestRender: () => void } | null = null;

  log("composition", "registering tools...");
  setupTools(runtime, engine, artifacts);

  log("composition", "registering lifecycle handlers...");
  runtime.on("session_start", async (_event: any, ctx: any) => {
    log("lifecycle", `session_start — cwd=${ctx?.cwd} ui=${!!ctx?.ui}`);
    uiState.ctx = { cwd: ctx.cwd, ui: ctx.ui };
    const loaded = config.load();
    const projectState = engine.getProjectState();
    const phases = loaded.inception.phases;
    const phase = phases[projectState.inception.currentPhase - 1];
    sidebarComponent.setState(projectState, [], phase?.name, phase?.agent);

    showInceptionDashboard();

    if (!loaded.active) {
      log("lifecycle", "session_start: config not active, staying dormant");
      return;
    }
    if (projectState.mode === "development") {
      log("lifecycle", "session_start: starting polling (development mode)");
      engine.startPolling();
    }
  });

  runtime.on("session_shutdown", async (event: any) => {
    const reason = event?.reason ?? "quit";
    log("lifecycle", `session_shutdown — reason=${reason}`);
    hideInceptionDashboard();
    hideDevDashboard();
    if (reason === "quit" || reason === "reload") {
      engine.dispose();
    }
  });

  runtime.on("resources_discover", async () => {
    const skillsPath = join(workdir, "skills");
    log("lifecycle", `resources_discover: contributing skillPaths=[${skillsPath}]`);
    return { skillPaths: [skillsPath] };
  });

  log("composition", "subscribing to pi.dev message events for inception buffer...");
  runtime.on("message_update", async (event: any) => {
    if (engine.getProjectState().mode !== "inception") return;
    const am = event?.assistantMessageEvent;
    if (am?.type === "text_delta" && am?.delta) {
      inceptionBuffer.handleEvent({ type: "text_delta", sessionId: "inception", delta: am.delta });
      inceptionDashboard?.invalidate();
      storedTui?.requestRender();
    }
  });

  runtime.on("message_end", async (event: any) => {
    if (engine.getProjectState().mode !== "inception") return;
    const msg = event?.message;
    if (msg?.role === "assistant") {
      inceptionBuffer.handleEvent({ type: "message_end", sessionId: "inception" });
      inceptionDashboard?.invalidate();
      storedTui?.requestRender();
    }
  });

  runtime.on("tool_execution_start", async (event: any) => {
    if (engine.getProjectState().mode !== "inception") return;
    inceptionBuffer.handleEvent({ type: "tool_call", sessionId: "inception", toolName: event?.toolName });
    inceptionDashboard?.invalidate();
    storedTui?.requestRender();
  });

  runtime.on("tool_execution_end", async (event: any) => {
    if (engine.getProjectState().mode !== "inception") return;
    inceptionBuffer.handleEvent({ type: "tool_result", sessionId: "inception", toolName: event?.toolName, isError: event?.isError });
    inceptionDashboard?.invalidate();
    storedTui?.requestRender();
  });

  log("composition", "subscribing to engine events...");
  events.subscribe((event: any) => {
    if (event?.type === "session_created") {
      tabManager.addTab(event.sessionId, event.storyId, event.agentRole);
      conversationBuffers.set(event.sessionId, new AgentConversationBuffer(event.sessionId));
      sidebarComponent.setState(engine.getProjectState(), engine.getActiveSessions());
      hideInceptionDashboard();
      showDevDashboard();
    }
    if (event?.type === "story_claimed" || event?.type === "story_halted") {
      sidebarComponent.setState(engine.getProjectState(), engine.getActiveSessions());
      inceptionDashboard?.invalidate();
      storedTui?.requestRender();
    }
    if (event?.type === "phase_started") {
      const phases = config.load().inception.phases;
      const phase = phases[event.phase - 1];
      sidebarComponent.setState(engine.getProjectState(), [], phase?.name, phase?.agent);
      inceptionDashboard?.invalidate();
      storedTui?.requestRender();
    }
  });

  log("composition", "registering commands...");
  setupCommands(runtime, engine, config, stories, uiState, commandHandlers);

  function showInceptionDashboard(): void {
    if (inceptionDashboard || !uiState.ctx) return;
    const ui = (uiState.ctx as any)?.ui;
    if (!ui?.custom) return;
    inceptionDashboard = new ForgeInceptionDashboard(sidebarComponent, inceptionBuffer);
    inceptionDashboard.setOnSend((text: string) => sendUserMessage(text));
    inceptionDashboard.setOnCommand((name: string, args: string) => {
      const handler = commandHandlers.get(name);
      if (handler) {
        handler(args, { cwd: uiState.ctx!.cwd, ui: uiState.ctx!.ui, sendUserMessage } as CommandContext);
      }
    });
    inceptionDashboard.setOnExit(() => hideInceptionDashboard());
    log("composition", "showing ForgeInceptionDashboard via ctx.ui.custom()");
    void ui.custom(
      (tui: any, _theme: any) => { storedTui = tui; return inceptionDashboard!; },
      { overlay: true, onHandle: (h: any) => { inceptionHandle = h; } },
    );
  }

  function hideInceptionDashboard(): void {
    if (inceptionHandle) { inceptionHandle.hide(); inceptionHandle = null; }
    inceptionDashboard = null;
  }

  function showDevDashboard(): void {
    if (devDashboard || !uiState.ctx) return;
    const ui = (uiState.ctx as any)?.ui;
    if (!ui?.custom) return;
    devDashboard = new ForgeDevDashboard(tabManager, sidebarComponent, conversationBuffers);
    devDashboard.setOnSteer((sessionId: string, text: string) => {
      const session = (sessions as any).activeMap?.get(sessionId);
      if (session?.steer) session.steer(text);
    });
    devDashboard.setOnExit(() => hideDevDashboard());
    log("composition", "showing ForgeDevDashboard via ctx.ui.custom()");
    void ui.custom(
      (tui: any, _theme: any) => { storedTui = tui; return devDashboard!; },
      { overlay: true, onHandle: (h: any) => { devHandle = h; } },
    );
  }

  function hideDevDashboard(): void {
    if (devHandle) { devHandle.hide(); devHandle = null; }
    devDashboard = null;
  }

  log("composition", "createForgeComposition complete");
  return { engine, runtime, uiState };
}

function setupTools(
  runtime: AgentRuntime,
  engine: WorkflowEngine,
  artifacts: LinearDocumentRepository,
): void {
  runtime.registerTool({
    name: "forge_claim_story",
    label: "Claim Story",
    description: "Pull and claim the next available story for your agent role. The engine controls which story you get — you do not choose.",
    parameters: { type: "object", properties: { agentRole: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { agentRole: AgentRole };
      log("tool", `forge_claim_story: agentRole=${p.agentRole}`);
      const story = await engine.claimStory(p.agentRole as AgentRole);
      if (story) log("tool", `forge_claim_story: claimed ${story.id}`);
      return story
        ? { content: [{ type: "text" as const, text: `Claimed story ${story.id}: ${story.title}` }], details: story, isError: false }
        : { content: [{ type: "text" as const, text: "No stories available to claim" }], details: null, isError: false };
    },
  });

  runtime.registerTool({
    name: "forge_complete_ac",
    label: "Complete AC",
    description: "Mark an acceptance criterion as complete with git proof. The engine verifies the commit before accepting.",
    parameters: { type: "object", properties: { storyId: { type: "string" }, acNumber: { type: "number" }, commitSha: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { storyId: string; acNumber: number; commitSha: string };
      log("tool", `forge_complete_ac: storyId=${p.storyId} ac=${p.acNumber} sha=${p.commitSha}`);
      const ok = await engine.completeAc(p.storyId, p.acNumber, p.commitSha);
      return ok
        ? { content: [{ type: "text" as const, text: `AC ${p.acNumber} for ${p.storyId} completed` }], details: { ok }, isError: false }
        : { content: [{ type: "text" as const, text: `Git proof failed for AC ${p.acNumber}` }], details: { ok: false }, isError: true };
    },
  });

  runtime.registerTool({
    name: "forge_handoff",
    label: "Handoff",
    description: "Hand off a story to the next stage in the pipeline. The engine validates the transition and posts the handoff comment.",
    parameters: { type: "object", properties: { storyId: { type: "string" }, agentRole: { type: "string" }, targetState: { type: "string" }, accomplishments: { type: "string" }, remaining: { type: "string" }, testLocations: { type: "string" }, blockers: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { storyId: string; agentRole: string; targetState: string; accomplishments: string; remaining: string; testLocations: string; blockers?: string };
      log("tool", `forge_handoff: storyId=${p.storyId} targetState=${p.targetState}`);
      const result = await engine.handoff(p.storyId, p.agentRole as AgentRole, {
        targetState: p.targetState as any,
        accomplishments: p.accomplishments,
        remaining: p.remaining,
        testLocations: p.testLocations,
        blockers: p.blockers,
      });
      log("tool", `forge_handoff: success=${result.success}`);
      return result.success
        ? { content: [{ type: "text" as const, text: `Handed off ${p.storyId} to ${p.targetState}` }], details: result, isError: false }
        : { content: [{ type: "text" as const, text: `Handoff failed: ${result.error ?? "unknown"}` }], details: result, isError: true };
    },
  });

  runtime.registerTool({
    name: "forge_create_artifact",
    label: "Create Artifact",
    description: "Create an artifact document (e.g., lean-canvas.md, architecture.md) in Linear.",
    parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { title: string; content: string };
      if (!p.title || !p.content) {
        return { content: [{ type: "text" as const, text: "title and content are required" }], details: null, isError: true };
      }
      log("tool", `forge_create_artifact: title=${p.title}`);
      try {
        const id = await artifacts.createArtifact(p.title, p.content);
        return { content: [{ type: "text" as const, text: `Artifact created: ${id}` }], details: { id }, isError: false };
      } catch (err) {
        const msg = (err as Error).message;
        log("tool", `forge_create_artifact ERROR: ${msg}`);
        return { content: [{ type: "text" as const, text: `Failed to create artifact: ${msg}` }], details: { error: msg }, isError: true };
      }
    },
  });

  runtime.registerTool({
    name: "forge_log_progress",
    label: "Log Progress",
    description: "Log a progress message to the forge dashboard.",
    parameters: { type: "object", properties: { message: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { message: string };
      log("tool", `forge_log_progress: ${p.message?.slice(0, 80)}`);
      return { content: [{ type: "text" as const, text: `Progress logged: ${p.message}` }], details: { message: p.message }, isError: false };
    },
  });
}

function setupCommands(
  runtime: AgentRuntime,
  engine: WorkflowEngine,
  config: YamlConfig,
  stories: LinearStoryRepository,
  _uiState: { ctx: CommandContext | null },
  commandHandlers: Map<string, CommandHandler>,
): void {
  const forgeNew: CommandHandler = async (_args: string, ctx: CommandContext & { ui?: any }) => {
    log("cmd", "/forge-new invoked");
    try {
      const loaded = config.load();
      if (!loaded.linear.teamId) {
        log("cmd", "/forge-new: no teamId in config");
        ctx.ui?.notify("No teamId in forge.yaml. Run: forge init", "error");
        return;
      }
      log("cmd", "/forge-new: ensureWorkflowStates...");
      ctx.ui?.notify("Starting inception flow...", "info");
      await stories.ensureWorkflowStates();
      log("cmd", "/forge-new: saving config active=true");
      config.save({ active: true });
      const phases = loaded.inception.phases;
      if (phases.length > 0) {
        const prompt = engine.buildInceptionPrompt(0, ctx.cwd);
        if (!prompt) {
          ctx.ui?.notify("Failed to build inception prompt", "error");
          return;
        }
        log("cmd", `/forge-new: sending phase 1 prompt: ${phases[0].name} (interactive, current session)`);
        engine.markInceptionPhaseStarted(0);
        ctx.ui?.notify(`Inception Phase 1: ${phases[0].name} (${phases[0].agent})`, "info");
        if (ctx.sendUserMessage) {
          ctx.sendUserMessage(prompt);
        } else {
          log("cmd", "/forge-new: no sendUserMessage available");
          ctx.ui?.notify("Cannot send inception prompt — sendUserMessage unavailable", "error");
        }
      } else {
        log("cmd", "/forge-new: no phases, starting polling");
        engine.startPolling();
        ctx.ui?.notify("No inception phases — starting development mode.", "info");
      }
    } catch (err) {
      const msg = (err as Error).message;
      log("cmd", `/forge-new ERROR: ${msg}`);
      ctx.ui?.notify(`Forge error: ${msg}`, "error");
      console.error("[forge-new] error:", err);
    }
  };
  runtime.registerCommand("forge-new", forgeNew);
  commandHandlers.set("forge-new", forgeNew);

  const forgeNext: CommandHandler = async (_args: string, ctx: CommandContext & { ui?: any }) => {
    log("cmd", "/forge-next invoked");
    try {
      const loaded = config.load();
      const phases = loaded.inception.phases;
      const state = engine.getProjectState();
      const currentPhase = state.inception.currentPhase;
      const nextPhase = currentPhase + 1;

      if (nextPhase >= phases.length) {
        log("cmd", `/forge-next: inception complete (currentPhase=${currentPhase}, phases=${phases.length})`);
        engine.transitionToDevelopment();
        engine.startPolling();
        ctx.ui?.notify("Inception complete! Starting development mode — polling Linear.", "info");
        return;
      }

      const prompt = engine.buildInceptionPrompt(nextPhase, ctx.cwd);
      if (!prompt) {
        ctx.ui?.notify(`Phase ${nextPhase + 1} not found`, "error");
        return;
      }
      log("cmd", `/forge-next: sending phase ${nextPhase + 1} prompt: ${phases[nextPhase].name} (interactive, current session)`);
      engine.markInceptionPhaseStarted(nextPhase);
      ctx.ui?.notify(`Phase ${nextPhase + 1}: ${phases[nextPhase].name} (${phases[nextPhase].agent})`, "info");
      if (ctx.sendUserMessage) {
        ctx.sendUserMessage(prompt);
      } else {
        log("cmd", "/forge-next: no sendUserMessage available");
      }
    } catch (err) {
      const msg = (err as Error).message;
      log("cmd", `/forge-next ERROR: ${msg}`);
      ctx.ui?.notify(`Forge error: ${msg}`, "error");
      console.error("[forge-next] error:", err);
    }
  };
  runtime.registerCommand("forge-next", forgeNext);
  commandHandlers.set("forge-next", forgeNext);

  const forgeStatus: CommandHandler = async (_args: string, ctx: CommandContext & { ui?: any }) => {
    log("cmd", "/forge-status invoked");
    const loaded = config.load();
    const state = engine.getProjectState();
    const sessions = engine.getActiveSessions();
    const lines: string[] = [
      `Active: ${loaded.active}`,
      `Mode: ${state.mode}`,
    ];
    if (state.mode === "inception") {
      lines.push(`Phase: ${state.inception.currentPhase}`);
    }
    lines.push(`Sessions: ${sessions.length}`);
    for (const s of sessions) {
      lines.push(`  ${s.storyId} — ${s.agentRole} (${s.workflowState})`);
    }
    log("cmd", `/forge-status: active=${loaded.active} mode=${state.mode} sessions=${sessions.length}`);
    ctx.ui?.notify(lines.join("\n"), "info");
  };
  runtime.registerCommand("forge-status", forgeStatus);
  commandHandlers.set("forge-status", forgeStatus);

  const forgeStop: CommandHandler = async (_args: string, ctx: CommandContext & { ui?: any }) => {
    log("cmd", "/forge-stop invoked");
    config.save({ active: false });
    engine.dispose();
    ctx.ui?.notify("Forge stopped. Active sessions will finish naturally.", "info");
  };
  runtime.registerCommand("forge-stop", forgeStop);
  commandHandlers.set("forge-stop", forgeStop);

  const forgeApprove: CommandHandler = async (args: string, ctx: CommandContext & { ui?: any }) => {
    const storyId = args.trim();
    log("cmd", `/forge-approve invoked: storyId=${storyId}`);
    if (!storyId) {
      ctx.ui?.notify("Usage: /forge-approve <story-id>", "warning");
      return;
    }
    const loaded = config.load();
    const devopsConfig = loaded.agents["devops-agent"];
    if (!devopsConfig) {
      log("cmd", "/forge-approve: no devops-agent configured");
      ctx.ui?.notify("No devops-agent configured", "error");
      return;
    }
    log("cmd", `/forge-approve: dispatching devops-agent for ${storyId}`);
    await engine.dispatchAgentPublic(storyId, "devops-agent", devopsConfig);
    ctx.ui?.notify(`DevOps agent dispatched for ${storyId}`, "info");
  };
  runtime.registerCommand("forge-approve", forgeApprove);
  commandHandlers.set("forge-approve", forgeApprove);
}
