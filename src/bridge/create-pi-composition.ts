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

export interface ForgeComposition {
  engine: WorkflowEngine;
  runtime: AgentRuntime;
  eventBridge: DashboardEventBridge;
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
  const stories = new LinearStoryRepository(linear);
  const artifacts = new LinearDocumentRepository(linear);

  const engine = new WorkflowEngine(
    stories, artifacts, persistence, sessions,
    proof, prompts, config, clock, events, runtime,
  );

  runtime.registerTool({
    name: "forge_claim_story",
    label: "Claim Story",
    description: "Pull and claim the next available story for your agent role",
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
    description: "Mark an acceptance criterion as complete with proof",
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
    description: "Hand off a story to the next stage in the pipeline",
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
    description: "Log progress on the current story",
    parameters: { type: "object", properties: { message: { type: "string" } } },
    execute: async (_id: string, params: unknown) => {
      const p = params as { message: string };
      return { content: [{ type: "text" as const, text: `Progress logged: ${p.message}` }], details: { message: p.message }, isError: false };
    },
  });

  runtime.on("agent_settled", async (event: any) => {
    try {
      const meta = engine.getActiveSessions().find(s => s.sessionId === event?.sessionId);
      if (meta) {
        await engine.handleAgentIdle(event.sessionId, meta.storyId, meta.agentRole);
      }
    } catch (err: any) {
      events.publish({ type: "story_halted", storyId: "", reason: `agent_settled handler error: ${err.message}` });
    }
  });

  runtime.on("agent_error", async (event: any) => {
    try {
      const meta = engine.getActiveSessions().find(s => s.sessionId === event?.sessionId);
      if (meta) {
        await engine.handleAgentError(event.sessionId, meta.storyId, meta.agentRole);
      }
    } catch (err: any) {
      events.publish({ type: "story_halted", storyId: "", reason: `agent_error handler error: ${err.message}` });
    }
  });

  const sidebar = new ForgeSidebar();
  const agentPanel = new ForgeAgentPanel();
  const eventBridge = new DashboardEventBridge(sidebar, agentPanel);

  events.subscribe((event) => {
    eventBridge.handle(event as any);
  });

  runtime.on("output", async (piEvent: any) => {
    if (piEvent?.delta) {
      eventBridge.handle({
        type: "output",
        sessionId: piEvent.sessionId ?? "",
        delta: piEvent.delta,
      });
    }
  });

  return { engine, runtime, eventBridge };
}
