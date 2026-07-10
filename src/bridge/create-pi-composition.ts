import type { AgentRole } from "../engine/types";
import type { AgentRuntime, SessionManager } from "../engine/interfaces";
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
import { join } from "node:path";
import type { CommandContext } from "../engine/interfaces";

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

  log("composition", "registering tools...");
  setupTools(runtime, engine, artifacts);
  log("composition", "registering lifecycle handlers...");
  setupLifecycleHandlers(runtime, engine, config, uiState);
  log("composition", "registering commands...");
  setupCommands(runtime, engine, config, stories, uiState);

  const sidebar = new ForgeSidebar();
  const agentPanel = new ForgeAgentPanel();
  const eventBridge = new DashboardEventBridge(sidebar, agentPanel);

  events.subscribe((event) => {
    eventBridge.handle(event as any);
  });

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
): void {
  runtime.on("session_start", async (_event: any, ctx: any) => {
    log("lifecycle", `session_start — cwd=${ctx?.cwd} ui=${!!ctx?.ui}`);
    uiState.ctx = { cwd: ctx.cwd, ui: ctx.ui };
    const loaded = config.load();
    if (!loaded.active) {
      log("lifecycle", "session_start: config not active, staying dormant");
      return;
    }
    const projectState = engine.getProjectState();
    log("lifecycle", `session_start: mode=${projectState.mode} phase=${projectState.inception?.currentPhase}`);
    if (projectState.mode === "development") {
      log("lifecycle", "session_start: starting polling (development mode)");
      engine.startPolling();
    }
  });

  runtime.on("session_shutdown", async (event: any) => {
    const reason = event?.reason ?? "quit";
    log("lifecycle", `session_shutdown — reason=${reason}`);
    if (reason === "quit" || reason === "reload") {
      engine.dispose();
    }
  });
}

function setupCommands(
  runtime: AgentRuntime,
  engine: WorkflowEngine,
  config: YamlConfig,
  stories: LinearStoryRepository,
  uiState: { ctx: CommandContext | null },
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
        log("cmd", `/forge-new: starting phase 1: ${phases[0].name} (interactive)`);
        ctx.ui?.notify(`Inception Phase 1: ${phases[0].name} (${phases[0].agent})`, "info");
        if (ctx.newSession) {
          await ctx.newSession({
            withSession: async (newCtx: any) => {
              uiState.ctx = { cwd: newCtx.cwd, ui: newCtx.ui, newSession: newCtx.newSession, sendUserMessage: newCtx.sendUserMessage };
              if (newCtx.sendUserMessage) {
                await newCtx.sendUserMessage(prompt);
              }
            },
          });
        } else {
          log("cmd", "/forge-new: no newSession available — using sendUserMessage on current session");
          if (ctx.sendUserMessage) await ctx.sendUserMessage(prompt);
        }
        engine.markInceptionPhaseStarted(0);
        log("cmd", "/forge-new: inception phase 0 started");
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
      log("cmd", `/forge-next: starting phase ${nextPhase + 1}: ${phases[nextPhase].name} (interactive)`);
      ctx.ui?.notify(`Phase ${nextPhase + 1}: ${phases[nextPhase].name} (${phases[nextPhase].agent})`, "info");
      if (ctx.newSession) {
        await ctx.newSession({
          withSession: async (newCtx: any) => {
            uiState.ctx = { cwd: newCtx.cwd, ui: newCtx.ui, newSession: newCtx.newSession, sendUserMessage: newCtx.sendUserMessage };
            if (newCtx.sendUserMessage) {
              await newCtx.sendUserMessage(prompt);
            }
          },
        });
      } else {
        if (ctx.sendUserMessage) await ctx.sendUserMessage(prompt);
      }
      engine.markInceptionPhaseStarted(nextPhase);
      log("cmd", `/forge-next: phase ${nextPhase} started`);
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
