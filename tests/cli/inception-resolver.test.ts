import { describe, expect, it } from "bun:test";
import { resolveInceptionPhase } from "../../src/cli/inception-resolver";

// Default 8-phase template (0-indexed in currentPhase; mirrors forge.yaml default).
const DEFAULT_PHASES = [
  { phase: 1, name: "Lean Canvas", agent: "po-agent" },
  { phase: 2, name: "Empathy Mapping", agent: "ux-agent" },
  { phase: 3, name: "Trade-off Sliders", agent: "po-agent" },
  { phase: 4, name: "Event Storming", agent: "po-agent" },
  { phase: 5, name: "UX/UI Design", agent: "ux-agent" },
  { phase: 6, name: "Story Writing", agent: "po-agent" },
  { phase: 7, name: "Tech Stack + Architecture", agent: "architect-agent" },
  { phase: 8, name: "Iteration Mapping", agent: "po-agent" },
];

describe("resolveInceptionPhase", () => {
  it("returns phase 0 for a fresh inception", () => {
    const result = resolveInceptionPhase(
      { mode: "inception", inception: { currentPhase: 0, phaseSessionId: null } },
      DEFAULT_PHASES,
    );
    expect(result).toEqual({ phaseIndex: 0, agentRole: "po-agent" });
  });

  it("resumes from the current phase when no session is active", () => {
    const result = resolveInceptionPhase(
      { mode: "inception", inception: { currentPhase: 2, phaseSessionId: null } },
      DEFAULT_PHASES,
    );
    expect(result).toEqual({ phaseIndex: 2, agentRole: "po-agent" });
  });

  it("throws if an inception phase already has an active session", () => {
    expect(() =>
      resolveInceptionPhase(
        { mode: "inception", inception: { currentPhase: 2, phaseSessionId: "sess-123" } },
        DEFAULT_PHASES,
      ),
    ).toThrow(/Inception phase already in progress/);
  });

  it("returns phase 0 when not in inception mode", () => {
    const result = resolveInceptionPhase(
      { mode: "development", inception: { currentPhase: 3, phaseSessionId: null } },
      DEFAULT_PHASES,
    );
    expect(result).toEqual({ phaseIndex: 0, agentRole: "po-agent" });
  });
});
