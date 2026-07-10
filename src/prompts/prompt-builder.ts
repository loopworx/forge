import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Story, WorkflowState, AgentRole, InceptionPhase } from "../engine/types";

export interface BuildPromptParams {
  story: Story;
  agentRole: AgentRole;
  linearState: WorkflowState;
  primarySkill: string;
  workdir: string;
  failureContext?: { reason: string; previousState: WorkflowState };
  budgetUsd?: number;
  handoffComment?: string | null;
}

export interface BuildLoopPromptParams {
  story: Story;
  agentName: AgentRole;
  linearState: WorkflowState;
  workdir: string;
}

export interface BuildInceptionPromptParams {
  phase: InceptionPhase;
  workdir: string;
}

export function readLoopMd(workdir: string, skillName: string): string {
  const loopPath = join(workdir, "skills", skillName, "LOOP.md");
  if (!existsSync(loopPath)) return "";
  return readFileSync(loopPath, "utf-8");
}

export function buildPrompt(params: BuildPromptParams): string {
  const { story, agentRole, linearState, primarySkill, workdir, failureContext, budgetUsd, handoffComment } = params;
  const loopMd = readLoopMd(workdir, primarySkill);
  const lines: string[] = [];

  lines.push(`You are the ${agentRole}.`);
  lines.push("");
  lines.push(`Story: ${story.id}`);
  lines.push(`Title: ${story.title}`);
  lines.push(`Linear state: ${linearState}`);
  if (story.featureFlag) lines.push(`Feature flag: ${story.featureFlag}`);
  lines.push("");

  if (handoffComment) {
    lines.push("--- HANDOFF COMMENT FROM PREVIOUS AGENT ---");
    lines.push(handoffComment);
    lines.push("--- END HANDOFF COMMENT ---");
    lines.push("");
  }

  if (failureContext) {
    lines.push(`This story is returning from a failed ${failureContext.previousState}.`);
    lines.push(`Failure reason: "${failureContext.reason}"`);
    lines.push(`Read the Linear comments for ${story.id} for full details.`);
    lines.push("");
  }

  lines.push("Read these files before anything else:");
  lines.push(`1. stories/${story.id}.md`);
  lines.push("2. CONTEXT.md");
  if (existsSync(join(workdir, "project.constraints.yaml"))) lines.push("3. project.constraints.yaml");
  if (existsSync(join(workdir, "design-system", "MASTER.md"))) lines.push("4. design-system/MASTER.md");
  lines.push("");
  lines.push("Then load the skill: using-forge");
  lines.push(`Follow the using-forge protocol. Your Linear state is ${linearState}.`);
  lines.push("");

  if (loopMd) {
    lines.push(`--- LOOP CONTRACT: ${primarySkill} ---`);
    lines.push(loopMd);
    lines.push("--- END LOOP CONTRACT ---");
    lines.push("");
  }

  if (budgetUsd !== undefined) {
    lines.push("--- COST TRACKING ---");
    lines.push(`Budget: $${budgetUsd.toFixed(2)} (from project.constraints.yaml)`);
    lines.push("--- END COST TRACKING ---");
    lines.push("");
  }

  lines.push("--- LOOP RUN LOG ---");
  lines.push(`After each loop iteration, update stories/${story.id}.loop.md`);
  lines.push("--- END LOOP RUN LOG ---");
  lines.push("");

  lines.push("--- COMMIT PROTOCOL ---");
  lines.push("After each AC is GREEN and verified by forge_complete_ac:");
  lines.push(`git add -A && git commit -m "feat(${story.id}): AC{n} — {summary}" && git push`);
  lines.push("--- END COMMIT PROTOCOL ---");
  lines.push("");

  lines.push("--- HANDOFF PROTOCOL ---");
  lines.push("When your work is complete, call forge_handoff with:");
  lines.push("- targetState: the next Linear state (e.g., ready-for-qa)");
  lines.push("- accomplishments: what you achieved");
  lines.push("- remaining: what's left for the next agent");
  lines.push("- testLocations: where your tests are");
  lines.push("- blockers (optional): anything blocking progress");
  lines.push("Do NOT use Linear MCP tools directly. Use Forge custom tools.");
  lines.push("--- END HANDOFF PROTOCOL ---");

  return lines.join("\n");
}

export function buildLoopPrompt(params: BuildLoopPromptParams): string {
  const { story, agentName, linearState } = params;
  const lines: string[] = [];

  lines.push(`You are the ${agentName}.`);
  lines.push("");
  lines.push("A previous session for this story crashed or was compacted.");
  lines.push("You are resuming work on a story that was in progress.");
  lines.push("");
  lines.push(`Story: ${story.id}`);
  lines.push(`Title: ${story.title}`);
  lines.push(`Linear state: ${linearState}`);
  lines.push("");
  lines.push("Resume protocol:");
  lines.push(`1. Verify Linear assignment: story still in ${linearState}`);
  lines.push("2. Run the outer Acceptance Test — do not read anything else first");
  lines.push(`3. Read stories/${story.id}.loop.md for your current loop state`);
  lines.push(`4. Read stories/${story.id}.md for the story snapshot`);
  lines.push("5. Read CONTEXT.md");
  lines.push("6. Continue the ATDD loop from the last completed sub-slice");
  lines.push("");
  lines.push("If the outer Acceptance Test is RED:");
  lines.push("  Resume the ATDD loop from the first failing AC. Do NOT wait for human.");
  lines.push("");
  lines.push("If the outer Acceptance Test is GREEN:");
  lines.push("  The story was already complete (previous session crashed).");
  lines.push("  Call forge_handoff to move the story to ready-for-qa.");
  lines.push("  End the session.");
  lines.push("");
  lines.push("This is an autonomous recovery. Do NOT wait for human.");
  lines.push("Only test results determine reality; never trust the plan file.");

  return lines.join("\n");
}

export function buildInceptionPrompt(params: BuildInceptionPromptParams): string {
  const { phase, workdir } = params;
  const lines: string[] = [];

  lines.push(`You are the ${phase.agent}.`);
  lines.push("");
  lines.push(`--- FORGE INCEPTION: Phase ${phase.phase} ---`);
  lines.push(`Phase name: ${phase.name}`);
  lines.push(`Skill: ${phase.skill}`);
  lines.push(`Expected output: ${phase.output}`);
  lines.push("--- END FORGE INCEPTION ---");
  lines.push("");
  lines.push("You are facilitating an INTERACTIVE session with the human.");
  lines.push("Do NOT work autonomously. Ask questions, gather input, and build the artifact together.");
  lines.push("The human decides when this phase is complete.");
  lines.push("");
  lines.push("Read these files before starting (if they exist):");
  lines.push("1. CONTEXT.md");
  if (existsSync(join(workdir, "project.constraints.yaml"))) lines.push("2. project.constraints.yaml");
  lines.push("");
  lines.push(`Load the skill: ${phase.skill}`);
  lines.push("Follow the skill's protocol to guide the human through this phase.");
  lines.push("");

  if (phase.phase === 7) {
    lines.push("--- PHASE 7: STORY WRITING ---");
    lines.push("Write stories using forge_create_artifact to record them.");
    lines.push("Set each story's state to ready-for-dev.");
    lines.push("Include acceptance criteria in the story description.");
    lines.push("--- END PHASE 7 ---");
    lines.push("");
  }

  if (phase.phase === 8) {
    lines.push("--- PHASE 8: ITERATION MAPPING ---");
    lines.push("Call forge_create_artifact with the iteration map content.");
    lines.push("Map stories to iterations in the artifact.");
    lines.push("--- END PHASE 8 ---");
    lines.push("");
  }

  lines.push("--- COMPLETION PROTOCOL ---");
  lines.push(`When the human confirms this phase is complete, call forge_create_artifact with the content of ${phase.output}.`);
  lines.push("Then tell the human to type /forge-next to advance to the next phase.");
  lines.push("--- END COMPLETION PROTOCOL ---");

  return lines.join("\n");
}

import type { PromptBuilder } from "../engine/interfaces";
import type { PromptParams, LoopPromptParams, InceptionPromptParams } from "../engine/types";

export class PromptBuilderImpl implements PromptBuilder {
  buildPrompt(params: PromptParams): string {
    return buildPrompt({
      story: params.story,
      agentRole: params.agentRole,
      linearState: params.linearState,
      primarySkill: params.primarySkill,
      workdir: params.workdir,
      budgetUsd: params.budgetUsd,
      handoffComment: params.handoffComment ?? undefined,
      failureContext: params.failureContext ?? undefined,
    });
  }

  buildLoopPrompt(params: LoopPromptParams): string {
    return buildLoopPrompt({
      story: params.story,
      agentName: params.agentName,
      linearState: params.linearState,
      workdir: params.workdir,
    });
  }

  buildInceptionPrompt(params: InceptionPromptParams): string {
    return buildInceptionPrompt({
      phase: params.phase,
      workdir: params.workdir,
    });
  }
}
