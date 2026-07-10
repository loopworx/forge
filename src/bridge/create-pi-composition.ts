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
  const config = new YamlConfig(join(workdir, "forge.yaml"));
  const clock = new SystemClock();
  const events = new EngineEventBus();
  const persistence = new FilePersistence(join(workdir, ".forge"));
  const proof = new GitProofValidator(workdir);
  const prompts = new PromptBuilderImpl();

  const authPath = join(workdir, ".forge", "auth.json");
  const linear = new LinearClient({ authPath });
  const loadedConfig = config.load();
  if (loadedConfig.linear.teamId) linear.teamId = loadedConfig.linear.teamId;
  if (loadedConfig.linear.teamName) linear.teamName = loadedConfig.linear.teamName;
  const stories = new LinearStoryRepository(linear);
  const artifacts = new LinearDocumentRepository(linear);

  const engine = new WorkflowEngine(
    stories, artifacts, persistence, sessions,
    proof, prompts, config, clock, events, runtime, workdir,
  );

  const uiState: { ctx: CommandContext | null } = { ctx: null };

  setupTools(runtime, engine, artifacts);
  setupLifecycleHandlers(runtime, engine, config, uiState);
  setupCommands(runtime, engine, config, stories, uiState);

  const sidebar = new ForgeSidebar();
  const agentPanel = new ForgeAgentPanel();
  const eventBridge = new DashboardEventBridge(sidebar, agentPanel);

  events.subscribe((event) => {
    eventBridge.handle(event as any);
  });

  setupDashboardNotifications(events, uiState);

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
      const story = await engine.claimStory(p.agentRole as AgentRole);
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
      const result = await engine.completeAc(p.storyId, p.acNumber, p.summary);
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
      const result = await engine.handoff(p.storyId, p.agentRole as AgentRole, {
        targetState: p.targetState as any,
        accomplishments: p.accomplishments,
        remaining: p.remaining,
        testLocations: p.testLocations,
        blockers: p.blockers,
      });
      return result.success
        ? { content: [{ type: "text" as const, text: `Handed off to ${p.targetState}` }], details: result, isError: false }
        : { content: [{ type: "text" as const, text: result.error ?? "handoff failed" }], details: result, isError: true };
    },
  });

  runtime.registerTool({
    name: "forge_create_artifact",
    label: "Create Artifact",
    description: "Create a document artifact in Linear",
    parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { title: string; content: string };
      const artifactId = await artifacts.createArtifact(p.title, p.content);
      return { content: [{ type: "text" as const, text: `Artifact created: ${artifactId}` }], details: { artifactId }, isError: false };
    },
  });

  runtime.registerTool({
    name: "forge_log_progress",
    label: "Log Progress",
    description: "Log progress on the current story. The engine records this for audit and dashboard display.",
    parameters: { type: "object", properties: { message: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { message: string };
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
  runtime.on("session_start", async (_event, ctx: any) => {
    uiState.ctx = { cwd: ctx.cwd, ui: ctx.ui };
    const loaded = config.load();
    if (!loaded.active) return;

    const projectState = engine.getProjectState();
    if (projectState.mode === "development") {
      engine.startPolling();
    }
  });

  runtime.on("session_shutdown", async () => {
    engine.dispose();
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
    const loaded = config.load();
    if (!loaded.linear.teamId) {
      ctx.ui?.notify("No teamId in forge.yaml. Run: forge init", "error");
      return;
    }
    await stories.ensureWorkflowStates();
    config.save({ active: true });
    const phases = loaded.inception.phases;
    if (phases.length > 0) {
      const sid = await engine.startInceptionPhase(phases[0].name, ctx.cwd);
      ctx.ui?.notify(`Inception started — Phase 1: ${phases[0].name}`, "info");
      if (sid) {
        uiState.ctx = { cwd: ctx.cwd, ui: ctx.ui };
      }
    } else {
      config.save({ active: true });
      engine.startPolling();
      ctx.ui?.notify("No inception phases — starting development mode.", "info");
    }
  });

  runtime.registerCommand("forge-status", async (_args: string, ctx: CommandContext & { ui?: any }) => {
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
    ctx.ui?.notify(lines.join("\n"), "info");
  });

  runtime.registerCommand("forge-stop", async (_args: string, ctx: CommandContext & { ui?: any }) => {
    config.save({ active: false });
    engine.dispose();
    ctx.ui?.notify("Forge stopped. Active sessions will finish naturally.", "info");
  });

  runtime.registerCommand("forge-approve", async (args: string, ctx: CommandContext & { ui?: any }) => {
    const storyId = args.trim();
    if (!storyId) {
      ctx.ui?.notify("Usage: /forge-approve <story-id>", "warning");
      return;
    }
    const loaded = config.load();
    const devopsConfig = loaded.agents["devops-agent"];
    if (!devopsConfig) {
      ctx.ui?.notify("No devops-agent configured", "error");
      return;
    }
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
    if (ui?.notify) ui.notify(msg, type);
  };

  events.subscribe((event: any) => {
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
