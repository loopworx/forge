import { describe, expect, it } from "bun:test";
import { Sidebar } from "../../src/tui/sidebar";
import type { ProjectState } from "../../src/engine/types";

const inceptionState: ProjectState = {
  mode: "inception",
  inception: { mode: "inception", currentPhase: 1, phaseSessionId: null, artifacts: {} },
};

const devState: ProjectState = {
  mode: "development",
  inception: { mode: "development", currentPhase: 8, phaseSessionId: null, artifacts: {} },
};

describe("Sidebar", () => {
  it("renders inception mode with phase info (1-based display)", () => {
    const sidebar = new Sidebar();
    sidebar.setState(inceptionState, [], "Lean Canvas", "po-agent");
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("Inception"))).toBe(true);
    // currentPhase=1 is a 0-based index; display should be 1-based = "Phase: 2/8"
    expect(lines.some(l => l.includes("Phase: 2/8"))).toBe(true);
    expect(lines.some(l => l.includes("Phase: 1/8"))).toBe(false);
    expect(lines.some(l => l.includes("Lean Canvas"))).toBe(true);
    expect(lines.some(l => l.includes("po-agent"))).toBe(true);
    expect(lines.some(l => l.includes("Guardians"))).toBe(true);
  });

  it("uses the total parameter instead of hardcoded /8", () => {
    const sidebar = new Sidebar();
    sidebar.setState(inceptionState, [], "Lean Canvas", "po-agent", 12);
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("Phase: 2/12"))).toBe(true);
    expect(lines.some(l => l.includes("Phase: 1/12"))).toBe(false);
  });

  it("falls back to /8 when total is not provided (backwards compat)", () => {
    const sidebar = new Sidebar();
    sidebar.setState(inceptionState, [], "Lean Canvas", "po-agent");
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("Phase: 2/8"))).toBe(true);
  });

  it("shows phase name on its own line when provided", () => {
    const sidebar = new Sidebar();
    sidebar.setState(inceptionState, [], "Lean Canvas", "po-agent", 8);
    const lines = sidebar.getText();
    expect(lines.some(l => l.trim() === "Lean Canvas")).toBe(true);
  });

  it("shows agent role in parens on its own line when provided", () => {
    const sidebar = new Sidebar();
    sidebar.setState(inceptionState, [], "Lean Canvas", "architect-agent", 8);
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("(architect-agent)"))).toBe(true);
  });

  it("omits phase name line when not provided", () => {
    const sidebar = new Sidebar();
    sidebar.setState(inceptionState, []);
    const lines = sidebar.getText();
    // Phase counter still shows (1-based)
    expect(lines.some(l => l.includes("Phase: 2/8"))).toBe(true);
    // But no stray "Lean Canvas" or "(...)" line
    expect(lines.some(l => l.trim() === "Lean Canvas")).toBe(false);
  });

  it("displays phase 0 (currentPhase=0) as 'Phase: 1/8' (1-based)", () => {
    const sidebar = new Sidebar();
    const freshState: ProjectState = {
      mode: "inception",
      inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} },
    };
    sidebar.setState(freshState, [], "Lean Canvas", "po-agent", 8);
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("Phase: 1/8"))).toBe(true);
    expect(lines.some(l => l.includes("Phase: 0/8"))).toBe(false);
  });

  it("renders development mode with session list", () => {
    const sidebar = new Sidebar();
    const sessions = [
      { sessionId: "s1", storyId: "FOR-5", agentRole: "developer-agent" as any, workflowState: "in-dev" as any, sessionStartTime: Date.now(), isRecovery: false },
    ];
    sidebar.setState(devState, sessions);
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("Development"))).toBe(true);
    expect(lines.some(l => l.includes("FOR-5"))).toBe(true);
    expect(lines.some(l => l.includes("Sessions"))).toBe(true);
  });

  it("renders empty sessions in dev mode", () => {
    const sidebar = new Sidebar();
    sidebar.setState(devState, []);
    const lines = sidebar.getText();
    expect(lines.some(l => l.includes("No active"))).toBe(true);
  });
});
