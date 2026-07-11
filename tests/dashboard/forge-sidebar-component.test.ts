import { describe, expect, it } from "bun:test";
import { ForgeSidebarComponent } from "../../src/dashboard/forge-sidebar-component";
import type { ProjectState, AgentSessionMeta } from "../../src/engine/types";

function mockProjectState(mode: string, phase: number = 0): ProjectState {
  return {
    mode: mode as "inception" | "development",
    inception: { mode: mode as any, currentPhase: phase, phaseSessionId: null, artifacts: {} },
  };
}

function mockSession(storyId: string, role: string, state: string): AgentSessionMeta {
  return {
    sessionId: `session-${storyId}`,
    storyId,
    agentRole: role as any,
    workflowState: state as any,
    sessionStartTime: Date.now() - 120000,
    isRecovery: false,
  };
}

describe("ForgeSidebarComponent", () => {
  it("renders header with 'Forge' title", () => {
    const sb = new ForgeSidebarComponent();
    const lines = sb.render(30);
    expect(lines[0]).toContain("Forge");
  });

  it("renders inception mode with phase info", () => {
    const sb = new ForgeSidebarComponent();
    sb.setState(mockProjectState("inception", 2), [], "Lean Canvas", "po-agent");
    const lines = sb.render(30);
    const joined = lines.join("\n");
    expect(joined).toContain("Inception");
    expect(joined).toContain("Phase");
    expect(joined).toContain("Lean Canvas");
  });

  it("renders development mode with active sessions", () => {
    const sb = new ForgeSidebarComponent();
    sb.setState(mockProjectState("development"), [
      mockSession("FOR-5", "developer-agent", "in-dev"),
      mockSession("FOR-8", "qa-agent", "in-qa"),
    ], undefined, undefined);
    const lines = sb.render(30);
    const joined = lines.join("\n");
    expect(joined).toContain("Development");
    expect(joined).toContain("FOR-5");
    expect(joined).toContain("FOR-8");
    expect(joined).toContain("dev");
    expect(joined).toContain("qa");
  });

  it("renders 'No active sessions' when empty in dev mode", () => {
    const sb = new ForgeSidebarComponent();
    sb.setState(mockProjectState("development"), [], undefined, undefined);
    const lines = sb.render(30);
    const joined = lines.join("\n");
    expect(joined).toContain("No active");
  });

  it("renders guardian status", () => {
    const sb = new ForgeSidebarComponent();
    sb.setState(mockProjectState("development"), [], undefined, undefined, "HALT: ambiguous");
    const lines = sb.render(30);
    const joined = lines.join("\n");
    expect(joined).toContain("Guardians");
    expect(joined).toContain("HALT");
  });

  it("all lines fit within width", () => {
    const sb = new ForgeSidebarComponent();
    sb.setState(mockProjectState("development"), [
      mockSession("FOR-5", "developer-agent", "in-dev"),
    ], undefined, undefined);
    const width = 25;
    const lines = sb.render(width);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(width);
    }
  });

  it("invalidate clears cache", () => {
    const sb = new ForgeSidebarComponent();
    sb.setState(mockProjectState("inception", 0), [], "Lean Canvas", "po-agent");
    sb.render(30);
    expect(() => sb.invalidate()).not.toThrow();
    const lines = sb.render(30);
    expect(lines.length).toBeGreaterThan(0);
  });
});
