import { describe, expect, it } from "bun:test";
import { buildStartupBanner } from "../../src/cli/startup-banner";

const PHASES = [
  { phase: 1, name: "Lean Canvas", agent: "po-agent", skill: "facilitating-inception", output: "docs/lean-canvas.md" },
  { phase: 2, name: "Empathy Mapping", agent: "ux-agent", skill: "facilitating-inception", output: "docs/empathy-map.md" },
  { phase: 3, name: "Trade-off Sliders", agent: "po-agent", skill: "facilitating-inception", output: "project.constraints.yaml" },
  { phase: 4, name: "Event Storming", agent: "po-agent", skill: "facilitating-event-storming", output: "docs/event-storm.yaml" },
  { phase: 5, name: "UX/UI Design", agent: "ux-agent", skill: "designing-ux", output: "design-system/MASTER.md" },
  { phase: 6, name: "Story Writing", agent: "po-agent", skill: "writing-stories", output: "stories in Linear" },
  { phase: 7, name: "Tech Stack + Architecture", agent: "architect-agent", skill: "selecting-tech-stack", output: "docs/adr/ADR-001-platform.md" },
  { phase: 8, name: "Iteration Mapping", agent: "po-agent", skill: "building-iteration-map", output: "Linear Projects + Cycle" },
];

const inceptionState = {
  mode: "inception",
  inception: { mode: "inception" as const, currentPhase: 0, phaseSessionId: null, artifacts: {} },
};

const inceptionStateInProgress = {
  mode: "inception",
  inception: { mode: "inception" as const, currentPhase: 2, phaseSessionId: "session-abc", artifacts: {} },
};

const devState = {
  mode: "development",
  inception: { mode: "development" as const, currentPhase: 8, phaseSessionId: null, artifacts: {} },
};

describe("buildStartupBanner", () => {
  it("shows Forge version in banner", () => {
    const banner = buildStartupBanner(inceptionState, PHASES);
    expect(banner).toContain("Forge v");
  });

  it("shows Mode: Inception for inception state", () => {
    const banner = buildStartupBanner(inceptionState, PHASES);
    expect(banner).toContain("Mode: Inception");
  });

  it("shows current phase number and name in inception", () => {
    const banner = buildStartupBanner(inceptionState, PHASES);
    expect(banner).toContain("Phase 1/8");
    expect(banner).toContain("Lean Canvas");
  });

  it("shows agent role for current phase", () => {
    const banner = buildStartupBanner(inceptionState, PHASES);
    expect(banner).toContain("po-agent");
  });

  it("tells user to type /forge-new when no session is active", () => {
    const banner = buildStartupBanner(inceptionState, PHASES);
    expect(banner).toContain("/forge-new");
  });

  it("tells user to type /forge-next when session is active", () => {
    const banner = buildStartupBanner(inceptionStateInProgress, PHASES);
    expect(banner).toContain("/forge-next");
  });

  it("shows Mode: Development for development state", () => {
    const banner = buildStartupBanner(devState, PHASES);
    expect(banner).toContain("Mode: Development");
  });

  it("shows monitoring message in development mode", () => {
    const banner = buildStartupBanner(devState, PHASES);
    expect(banner).toContain("Monitoring");
  });

  it("always shows /help mention", () => {
    const inceptionBanner = buildStartupBanner(inceptionState, PHASES);
    const devBanner = buildStartupBanner(devState, PHASES);
    expect(inceptionBanner).toContain("/help");
    expect(devBanner).toContain("/help");
  });

  it("uses unicode box drawing characters", () => {
    const banner = buildStartupBanner(inceptionState, PHASES);
    expect(banner).toContain("╔");
    expect(banner).toContain("╗");
    expect(banner).toContain("╚");
    expect(banner).toContain("╝");
  });
});
