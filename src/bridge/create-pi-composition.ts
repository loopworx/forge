import type { AgentRole } from "../engine/types";
import type { AgentRuntime, SessionManager, CommandContext } from "../engine/interfaces";
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
import { ForgeSidebar } from "../dashboard/forge-sidebar";
import { ForgeAgentPanel } from "../dashboard/forge-agent-panel";
import { DashboardEventBridge } from "../dashboard/dashboard-event-bridge";
import { ForgeSidebarComponent } from "../dashboard/forge-sidebar-component";
import { TabManager } from "../dashboard/tab-manager";
import { AgentConversationBuffer } from "../dashboard/agent-conversation-buffer";
import { ForgeDevDashboard } from "../dashboard/forge-dev-dashboard";
import { join } from "node:path";

function log(tag: string, msg: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  console.error(`[forge ${ts}] ${tag}: ${msg}`, ...args.length ? args : []);
}

export interface ForgeComposition {
  engine: WorkflowEngine;
  runtime: AgentRuntime;
  eventBridge: DashboardEventBridge;
  uiState: { ctx: CommandContext | null };
}

export function createForgeComposition(
  workdir: string,
  runtime: AgentRuntime,
  sessions: SessionManager,
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

  const sidebar = new ForgeSidebar();
  const agentPanel = new ForgeAgentPanel();
  const eventBridge = new DashboardEventBridge(sidebar, agentPanel);

  const sidebarComponent = new ForgeSidebarComponent();
  const tabManager = new TabManager();
  const conversationBuffers = new Map<string, AgentConversationBuffer>();
  let devDashboard: ForgeDevDashboard | null = null;
  let customHandle: { close: () => void; requestRender: () => void } | null = null;

  log("composition", "registering tools...");
  setupTools(runtime, engine, artifacts);

  log("composition", "registering lifecycle handlers...");
  setupLifecycleHandlers(runtime, engine, config, uiState, workdir, sidebarComponent);

  log("composition", "registering commands...");
  setupCommands(runtime, engine, config, stories, uiState);

  events.subscribe((event: any) => {
    eventBridge.handle(event as any);

    if (event?.type === "session_created") {
      tabManager.addTab(event.sessionId, event.storyId, event.agentRole);
      conversationBuffers.set(event.sessionId, new AgentConversationBuffer(event.sessionId));
      sidebarComponent.setState(engine.getProjectState(), engine.getActiveSessions());
      showDevDashboard();
    }
    if (event?.type === "story_claimed" || event?.type === "story_halted") {
      sidebarComponent.setState(engine.getProjectState(), engine.getActiveSessions());
    }
    if (event?.type === "phase_started") {
      const phases = config.load().inception.phases;
      const phase = phases[event.phase - 1];
      sidebarComponent.setState(engine.getProjectState(), [], phase?.name, phase?.agent);
    }
  });

  function showDevDashboard(): void {
    if (devDashboard || !uiState.ctx) return;
    const ui = (uiState.ctx as any)?.ui;
    if (!ui?.custom) return;
    devDashboard = new ForgeDevDashboard(tabManager, sidebarComponent, conversationBuffers);
    devDashboard.setOnSteer((sessionId: string, text: string) => {
      const session = (sessions as any).activeMap?.get(sessionId);
      if (session?.steer) session.steer(text);
    });
    devDashboard.setOnExit(() => {
      if (customHandle) {
        customHandle.close();
        customHandle = null;
      }
      devDashboard = null;
    });
    log("composition", "showing ForgeDevDashboard via ctx.ui.custom()");
    customHandle = ui.custom(devDashboard, { overlay: true });
  }

  log("composition", "setting up dashboard notifications...");
  setupDashboardNotifications(events, uiState);

  log("composition", "createForgeComposition complete");
  return { engine, runtime, eventBridge, uiState };
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
    parameters: { type: "object", properties: { storyId: { type: "string" }, acNumber: { type: "number" }, summary: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { storyId: string; acNumber: number; summary: string };
      log("tool", `forge_complete_ac: storyId=${p.storyId} ac=${p.acNumber}`);
      const result = await engine.completeAc(p.storyId, p.acNumber, p.summary);
      log("tool", `forge_complete_ac: success=${result.success}`);
      return result.success
        ? { content: [{ type: "text" as const, text: `AC${p.acNumber} completed` }], details: result, isError: false }
        : { content: [{ type: "text" as const, text: result.error ?? "unknown error" }], details: result, isError: true };
    },
  });

  runtime.registerTool({
    name: "forge_handoff",
    label: "Handoff Story",
    description: "Hand off a story to the next stage in the pipeline. The engine validates the transition and posts the handoff comment.",
    parameters: { type: "object", properties: { storyId: { type: "string" }, agentRole: { type: "string" }, targetState: { type: "string" }, accomplishments: { type: "string" }, remaining: { type: "string" }, testLocations: { type: "string" }, blockers: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { storyId: string; agentRole: AgentRole; targetState: string; accomplishments: string; remaining: string; testLocations: string; blockers?: string };
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
        ? { content: [{ type: "text" as const, text: `Handed off to ${p.targetState}` }], details: result, isError: false }
        : { content: [{ type: "text" as const, text: result.error ?? "handoff failed" }], details: result, isError: true };
    },
  });

  runtime.registerTool({
    name: "forge_create_artifact",
    label: "Create Artifact",
    description: "Create a document artifact in Linear. Both title and content are required.",
    parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title", "content"] },
    execute: async (_id: string, params: unknown) => {
      const p = params as { title: string; content: string };
      if (!p?.title || typeof p.title !== "string" || p.title.trim().length === 0) {
        log("tool", "forge_create_artifact: missing or empty title");
        return { content: [{ type: "text" as const, text: "Error: title is required and must be a non-empty string" }], details: null, isError: true };
      }
      if (!p?.content || typeof p.content !== "string" || p.content.trim().length === 0) {
        log("tool", "forge_create_artifact: missing or empty content");
        return { content: [{ type: "text" as const, text: "Error: content is required and must be a non-empty string" }], details: null, isError: true };
      }
      log("tool", `forge_create_artifact: title=${p.title}`);
      try {
        const artifactId = await artifacts.createArtifact(p.title, p.content);
        log("tool", `forge_create_artifact: created ${artifactId}`);
        return { content: [{ type: "text" as const, text: `Artifact created: ${artifactId}` }], details: { artifactId }, isError: false };
      } catch (err) {
        log("tool", `forge_create_artifact ERROR: ${(err as Error).message}`);
        return { content: [{ type: "text" as const, text: `Error creating artifact: ${(err as Error).message}` }], details: null, isError: true };
      }
    },
  });

  runtime.registerTool({
    name: "forge_log_progress",
    label: "Log Progress",
    description: "Log progress on the current story. The engine records this for audit and dashboard display.",
    parameters: { type: "object", properties: { message: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { message: string };
      log("tool", `forge_log_progress: ${p.message?.slice(0, 80)}`);
      return { content: [{ type: "text" as const, text: `Progress logged: ${p.message}` }], details: { message: p.message }, isError: false };
    },
  });
}

function setupLifecycleHandlers(
  runtime: AgentRuntime,
  engine: WorkflowEngine,
  config: YamlConfig,
  uiState: { ctx: CommandContext | null },
  workdir: string,
  sidebarComponent: ForgeSidebarComponent,
): void {
  runtime.on("session_start", async (_event: any, ctx: any) => {
    log("lifecycle", `session_start — cwd=${ctx?.cwd} ui=${!!ctx?.ui}`);
    uiState.ctx = { cwd: ctx.cwd, ui: ctx.ui };
    const loaded = config.load();
    const projectState = engine.getProjectState();

    const phases = loaded.inception.phases;
    const phase = phases[projectState.inception.currentPhase - 1];
    sidebarComponent.setState(projectState, [], phase?.name, phase?.agent);

    if (ctx.ui?.setWidget) {
      log("lifecycle", "session_start: registering sidebar widget");
      ctx.ui.setWidget("forge-sidebar", (_tui: any, _theme: any) => {
        return {
          render: (width: number) => sidebarComponent.render(width),
          invalidate: () => sidebarComponent.invalidate(),
          handleInput: (_data: string) => {},
        };
      }, { placement: "aboveEditor" });
    }

    if (ctx.ui?.setStatus) {
      if (projectState.mode === "inception") {
        const p = phases[projectState.inception.currentPhase - 1];
        ctx.ui.setStatus("forge", `Inception Phase ${projectState.inception.currentPhase}/8${p ? ` — ${p.name} (${p.agent})` : ""}`);
      } else if (loaded.active) {
        const n = engine.activeSessionCount;
        ctx.ui.setStatus("forge", n > 0 ? `${n} active session${n > 1 ? "s" : ""}` : "Development mode — polling");
      }
    }

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
    const ui = (uiState.ctx as any)?.ui;
    if (ui?.setWidget) ui.setWidget("forge-sidebar", undefined);
    if (ui?.setStatus) ui.setStatus("forge", undefined);
    if (reason === "quit" || reason === "reload") {
      engine.dispose();
    }
  });

  runtime.on("resources_discover", async (_event: any, _ctx: any) => {
    const skillsPath = join(workdir, "skills");
    log("lifecycle", `resources_discover: contributing skillPaths=[${skillsPath}]`);
    return { skillPaths: [skillsPath] };
  });
}

function setupCommands(
  runtime: AgentRuntime,
  engine: WorkflowEngine,
  config: YamlConfig,
  stories: LinearStoryRepository,
  _uiState: { ctx: CommandContext | null },
): void {
  runtime.registerCommand("forge-new", async (_args: string, ctx: CommandContext & { ui?: any }) => {
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
  });

  runtime.registerCommand("forge-next", async (_args: string, ctx: CommandContext & { ui?: any }) => {
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
  });

  runtime.registerCommand("forge-status", async (_args: string, ctx: CommandContext & { ui?: any }) => {
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
  });

  runtime.registerCommand("forge-stop", async (_args: string, ctx: CommandContext & { ui?: any }) => {
    log("cmd", "/forge-stop invoked");
    config.save({ active: false });
    engine.dispose();
    ctx.ui?.notify("Forge stopped. Active sessions will finish naturally.", "info");
  });

  runtime.registerCommand("forge-approve", async (args: string, ctx: CommandContext & { ui?: any }) => {
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
  });
}

function setupDashboardNotifications(
  events: EngineEventBus,
  uiState: { ctx: CommandContext | null },
): void {
  const notify = (msg: string, type: "info" | "warning" | "error" = "info") => {
    const ui = (uiState.ctx as any)?.ui;
    if (ui?.notify) {
      ui.notify(msg, type);
    } else {
      log("dashboard", `notify (no ui): ${msg}`);
    }
  };

  events.subscribe((event: any) => {
    log("events", `engine event: ${event?.type}`, { storyId: event?.storyId, agentRole: event?.agentRole });
    switch (event?.type) {
      case "story_claimed":
        notify(`Claimed ${event.storyId} for ${event.agentRole}`);
        break;
      case "session_created":
        notify(`${event.storyId} → ${event.agentRole} session started`);
        break;
      case "story_halted":
        notify(`${event.storyId} halted: ${event.reason}`, "error");
        break;
      case "phase_started":
        notify(`Inception Phase ${event.phase}: ${event.name}`);
        break;
    }
  });
}
