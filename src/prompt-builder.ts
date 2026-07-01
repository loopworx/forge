import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Story, LinearState, AgentRole, InceptionPhase } from "./types";

export interface FailureContext {
  reason: string;
  previousState: LinearState;
}

export interface BuildPromptParams {
  agentName: AgentRole;
  story: Story;
  linearState: LinearState;
  primarySkill: string;
  workdir: string;
  failureContext?: FailureContext;
  budgetUsd?: number;
  handoffComment?: string | null;
}

export function readLoopMd(workdir: string, skillName: string): string {
  const loopPath = join(workdir, "skills", skillName, "LOOP.md");
  if (!existsSync(loopPath)) {
    return "";
  }
  return readFileSync(loopPath, "utf-8");
}

export function buildPrompt(params: BuildPromptParams): string {
  const { agentName, story, linearState, primarySkill, workdir, failureContext, budgetUsd, handoffComment } = params;

  const loopMd = readLoopMd(workdir, primarySkill);
  const hasDesignSystem = existsSync(join(workdir, "design-system", "MASTER.md"));

  const lines: string[] = [];

  lines.push(`You are the ${agentName}.`);
  lines.push("");
  lines.push(`Story: ${story.id}`);
  lines.push(`Title: ${story.title}`);
  lines.push(`Linear state: ${linearState}`);
  if (story.featureFlag) {
    lines.push(`Feature flag: ${story.featureFlag}`);
  }
  lines.push("");

  if (handoffComment) {
    lines.push("--- HANDOFF COMMENT FROM PREVIOUS AGENT ---");
    lines.push(handoffComment);
    lines.push("--- END HANDOFF COMMENT ---");
    lines.push("");
  }

  if (failureContext) {
    lines.push("⚠️ This story is returning from a failed " + failureContext.previousState + ".");
    lines.push("   Failure reason: \"" + failureContext.reason + "\"");
    lines.push("");
    lines.push("   Read the Linear comments for " + story.id + " for full details.");
    lines.push("   Fix the failing flow before proceeding with new ACs.");
    lines.push("");
  }

  lines.push("Read these files before anything else:");
  lines.push(`1. stories/${story.id}.md (story snapshot)`);
  lines.push("2. CONTEXT.md (ubiquitous language)");
  if (existsSync(join(workdir, "project.constraints.yaml"))) {
    lines.push("3. project.constraints.yaml (priorities and loop budgets)");
  }
  if (hasDesignSystem) {
    lines.push("4. design-system/MASTER.md (design system — for UI work)");
  }
  lines.push("");
  lines.push("Then load the skill: using-forge");
  lines.push("Follow the using-forge protocol. Your Linear state is " + linearState + ".");
  lines.push("");

  if (loopMd) {
    lines.push("--- LOOP CONTRACT: " + primarySkill + " ---");
    lines.push(loopMd);
    lines.push("--- END LOOP CONTRACT ---");
    lines.push("");
  }

  if (budgetUsd !== undefined) {
    lines.push("--- COST TRACKING ---");
    lines.push("This session has a budget of $" + budgetUsd.toFixed(2) + " (from project.constraints.yaml).");
    lines.push("The process manager is tracking your token usage.");
    lines.push("If you approach the budget, guarding-loops will halt with halted-cost.");
    lines.push("--- END COST TRACKING ---");
    lines.push("");
  }

  lines.push("--- LOOP RUN LOG ---");
  lines.push("After each loop iteration, update stories/" + story.id + ".loop.md with:");
  lines.push("- current_loop, current_ac, current_subslice");
  lines.push("- fe_status, be_status");
  lines.push("- stall_counter, iteration_counter");
  lines.push("- last_proof_result");
  lines.push("- guardian_check array (timestamp, outcome, reason)");
  lines.push("--- END LOOP RUN LOG ---");
  lines.push("");

  lines.push("--- HANDOFF PROTOCOL ---");
  lines.push("When your work is complete:");
  lines.push("1. Update the story state in Linear using linear_save_issue (e.g. move to ready-for-qa)");
  lines.push("2. Post a COMPACT handoff comment on " + story.id + " using linear_save_comment:");
  lines.push("   - What you accomplished (which ACs are GREEN/skipped)");
  lines.push("   - What remains for the next agent");
  lines.push("   - Test file locations");
  lines.push("   - Feature flag name (if any)");
  lines.push("   - Any blockers or warnings");
  lines.push("3. End your session. The next agent will read your comment for context.");
  lines.push("--- END HANDOFF PROTOCOL ---");

  return lines.join("\n");
}

export interface BuildLoopPromptParams {
  agentName: AgentRole;
  story: Story;
  linearState: LinearState;
  workdir: string;
}

export function buildLoopPrompt(params: BuildLoopPromptParams): string {
  const { agentName, story, linearState, workdir } = params;

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
  lines.push("1. Query Linear → verify story is still assigned to you and in " + linearState);
  lines.push("2. Run the outer Acceptance Test — do not read anything else first");
  lines.push("3. Read stories/" + story.id + ".loop.md for your current loop state");
  lines.push("4. Read stories/" + story.id + ".md for the story snapshot");
  lines.push("5. Read CONTEXT.md");
  lines.push("6. Continue the ATDD loop from the last completed sub-slice");
  lines.push("");
  lines.push("If the outer Acceptance Test is RED:");
  lines.push("  - Resume the ATDD loop from the first failing AC");
  lines.push("  - Do NOT wait for human");
  lines.push("");
  lines.push("If the outer Acceptance Test is GREEN:");
  lines.push("  - The story was already fully implemented (previous session crashed before completing)");
  lines.push("  - Post to Linear: 'All ACs GREEN on resume — story complete'");
  lines.push("  - Move the story to ready-for-qa");
  lines.push("  - End the session");
  lines.push("");
  lines.push("This is an autonomous recovery. Do NOT wait for human.");
  lines.push("Only test results determine reality; never trust the plan file.");

  return lines.join("\n");
}

export interface BuildInceptionPromptParams {
  phase: InceptionPhase;
  workdir: string;
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

  lines.push("Read these files before starting:");
  lines.push("1. CONTEXT.md (ubiquitous language — if it exists)");
  const hasConstraints = existsSync(join(workdir, "project.constraints.yaml"));
  if (hasConstraints) {
    lines.push("2. project.constraints.yaml (priorities and loop budgets)");
  }
  lines.push("");

  lines.push("Load the skill: " + phase.skill);
  lines.push("Follow the skill instructions to complete this phase.");
  lines.push("");

  lines.push("Your output artifact: " + phase.output);
  lines.push("When this phase is complete, the artifact must exist at that path.");
  lines.push("");

  if (phase.phase === 6) {
    lines.push("--- PHASE 6 SPECIAL: STORY WRITING ---");
    lines.push("Write stories in Linear using linear_save_issue.");
    lines.push("Set each story's state to 'ready-for-dev'.");
    lines.push("Include acceptance criteria in the story description.");
    lines.push("Use linear_list_issues to verify stories were created.");
    lines.push("--- END PHASE 6 SPECIAL ---");
    lines.push("");
  }

  if (phase.phase === 8) {
    lines.push("--- PHASE 8 SPECIAL: ITERATION MAPPING ---");
    lines.push("Create Linear Projects using linear_save_project.");
    lines.push("Create milestones using linear_save_milestone.");
    lines.push("Map stories to iterations by assigning project/milestone.");
    lines.push("--- END PHASE 8 SPECIAL ---");
    lines.push("");
  }

  lines.push("--- HANDOFF PROTOCOL ---");
  lines.push("When this phase is complete:");
  lines.push("1. Verify the output artifact exists at " + phase.output);
  lines.push("2. Post a compact summary of what was produced");
  lines.push("3. End your session. The plugin will verify the artifact and start Phase " + (phase.phase + 1) + ".");
  lines.push("--- END HANDOFF PROTOCOL ---");

  return lines.join("\n");
}
