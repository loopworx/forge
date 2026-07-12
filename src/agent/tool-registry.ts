import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { WorkflowEngine } from "../engine/workflow-engine";
import type { ArtifactRepository } from "../engine/interfaces";
import type { AgentRole } from "../engine/types";

export class ToolRegistry {
  private toolNames: string[] = [];

  registerForgeTools(engine: WorkflowEngine, artifacts: ArtifactRepository): any[] {
    const tools = [
      {
        name: "forge_claim_story",
        label: "Claim Story",
        description: "Pull and claim the next available story for your agent role.",
        parameters: Type.Object({ agentRole: Type.String() }),
        execute: async (_id: string, params: { agentRole: string }) => {
          const story = await engine.claimStory(params.agentRole as AgentRole);
          return story
            ? { content: [{ type: "text" as const, text: `Claimed story ${story.id}: ${story.title}` }], details: story, isError: false }
            : { content: [{ type: "text" as const, text: "No stories available" }], details: null, isError: false };
        },
      },
      {
        name: "forge_complete_ac",
        label: "Complete AC",
        description: "Mark an acceptance criterion as complete with git proof.",
        parameters: Type.Object({
          storyId: Type.String(),
          acNumber: Type.Number(),
          commitSha: Type.String(),
        }),
        execute: async (_id: string, params: { storyId: string; acNumber: number; commitSha: string }) => {
          const ok = await engine.completeAc(params.storyId, params.acNumber, params.commitSha);
          return ok.success
            ? { content: [{ type: "text" as const, text: `AC ${params.acNumber} completed` }], details: { ok }, isError: false }
            : { content: [{ type: "text" as const, text: `Git proof failed` }], details: { ok: false }, isError: true };
        },
      },
      {
        name: "forge_handoff",
        label: "Handoff",
        description: "Hand off a story to the next stage.",
        parameters: Type.Object({
          storyId: Type.String(),
          agentRole: Type.String(),
          targetState: Type.String(),
          accomplishments: Type.String(),
          remaining: Type.String(),
          testLocations: Type.String(),
        }),
        execute: async (_id: string, params: {
          storyId: string; agentRole: string; targetState: string;
          accomplishments: string; remaining: string; testLocations: string;
        }) => {
          const result = await engine.handoff(params.storyId, params.agentRole as AgentRole, {
            targetState: params.targetState as any,
            accomplishments: params.accomplishments,
            remaining: params.remaining,
            testLocations: params.testLocations,
          });
          return result.success
            ? { content: [{ type: "text" as const, text: `Handed off to ${params.targetState}` }], details: result, isError: false }
            : { content: [{ type: "text" as const, text: `Handoff failed: ${result.error}` }], details: result, isError: true };
        },
      },
      {
        name: "forge_create_artifact",
        label: "Create Artifact",
        description: "Create an artifact document in Linear.",
        parameters: Type.Object({ title: Type.String(), content: Type.String() }),
        execute: async (_id: string, params: { title: string; content: string }) => {
          const id = await artifacts.createArtifact(params.title, params.content);
          return { content: [{ type: "text" as const, text: `Artifact created: ${id}` }], details: { id }, isError: false };
        },
      },
      {
        name: "forge_log_progress",
        label: "Log Progress",
        description: "Log a progress message.",
        parameters: Type.Object({ message: Type.String() }),
        execute: async (_id: string, params: { message: string }) => {
          return { content: [{ type: "text" as const, text: `Progress: ${params.message}` }], details: { message: params.message }, isError: false };
        },
      },
    ];

    this.toolNames = tools.map((t) => t.name);
    return tools.map((t) => defineTool(t as any));
  }

  getToolNames(): string[] {
    return [...this.toolNames];
  }
}
