export interface InceptionPhaseResolution {
  phaseIndex: number;
  agentRole: string;
}

/**
 * Resolve which inception phase `/forge-new` should start or resume from.
 *
 * - If an inception session is already in flight (`phaseSessionId != null`),
 *   the caller should use `/forge-next` instead — throw to surface the misuse.
 * - If already in inception mode, resume from `currentPhase`. Otherwise start
 *   fresh at phase 0.
 * - `currentPhase` is a 0-based index into `phases` (matches
 *   `WorkflowEngine.buildInceptionPrompt` / `markInceptionPhaseStarted`).
 */
export function resolveInceptionPhase(
  state: { mode: string; inception: { currentPhase: number; phaseSessionId: string | null } },
  phases: Array<{ phase: number; name: string; agent: string }>,
): InceptionPhaseResolution {
  if (state.mode === "inception" && state.inception.phaseSessionId !== null) {
    throw new Error("Inception phase already in progress. Use /forge-next to advance.");
  }

  const phaseIndex = state.mode === "inception" ? state.inception.currentPhase : 0;
  const phase = phases[phaseIndex];
  if (!phase) {
    throw new Error(`No inception phase at index ${phaseIndex}.`);
  }

  return { phaseIndex, agentRole: phase.agent };
}
