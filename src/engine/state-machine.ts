import type { WorkflowState } from "./types";

const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  "in-analysis":          ["ready-for-dev", "halted-ambiguous"],
  "ready-for-dev":        ["in-dev"],
  "in-dev":               ["in-deskcheck", "ready-for-qa", "halted-stall", "halted-ambiguous", "halted-unsafe"],
  "in-deskcheck":         ["ready-for-qa", "in-dev"],
  "ready-for-qa":         ["in-qa"],
  "in-qa":                ["ready-for-acceptance", "halted-stall", "halted-ambiguous"],
  "ready-for-acceptance": ["in-acceptance"],
  "in-acceptance":        ["ready-to-deploy", "ready-for-dev", "halted-ambiguous"],
  "ready-to-deploy":      ["done", "halted-unsafe"],
  "done":                 [],
  "halted-stall":         ["ready-for-dev", "in-dev", "in-qa", "in-acceptance"],
  "halted-ambiguous":     ["ready-for-dev", "in-dev", "in-qa", "in-acceptance"],
  "halted-human-gate":    ["ready-for-dev", "in-dev", "ready-for-qa", "ready-to-deploy"],
  "halted-unsafe":        ["ready-for-dev"],
};

export function validateTransition(from: WorkflowState, to: WorkflowState): boolean {
  const valid = VALID_TRANSITIONS[from] ?? [];
  return valid.includes(to);
}

export function getValidTransitions(from: WorkflowState): WorkflowState[] {
  return VALID_TRANSITIONS[from] ?? [];
}

export function isHaltState(state: WorkflowState): boolean {
  return state.startsWith("halted-");
}

export function isTerminalState(state: WorkflowState): boolean {
  return state === "done";
}
