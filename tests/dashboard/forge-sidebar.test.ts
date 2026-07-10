import { describe, expect, it, beforeEach } from "bun:test";
import { ForgeSidebar } from "../../src/dashboard/forge-sidebar";
import type { Sidebar } from "../../src/dashboard/split-layout";

describe("ForgeSidebar", () => {
  let sidebar: Sidebar;

  beforeEach(() => {
    sidebar = new ForgeSidebar();
  });

  it("implements Sidebar", () => {
    expect(typeof sidebar.render).toBe("function");
    expect(typeof sidebar.handleInput).toBe("function");
    expect(typeof sidebar.invalidate).toBe("function");
    expect(typeof sidebar.setSessions).toBe("function");
    expect(typeof sidebar.setTransitions).toBe("function");
    expect(typeof sidebar.setGuardianStatus).toBe("function");
  });

  it("renders a header", () => {
    const lines = sidebar.render(20);
    expect(lines.some(l => l.includes("Forge"))).toBe(true);
  });

  it("shows sessions when set", () => {
    sidebar.setSessions([
      { sessionId: "s1", storyId: "F-1", agentRole: "developer-agent", isBusy: true, elapsedTime: 120 },
      { sessionId: "s2", storyId: "F-2", agentRole: "qa-agent", isBusy: false, elapsedTime: 300 },
    ]);

    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("F-1");
    expect(text).toContain("dev");
    expect(text).toContain("F-2");
    expect(text).toContain("qa");
  });

  it("shows empty state when no sessions", () => {
    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("No active sessions");
  });

  it("shows transitions when set", () => {
    sidebar.setTransitions([
      { timestamp: "2026-01-01", storyId: "F-1", fromState: "in-dev", toState: "ready-for-qa", agentRole: "developer-agent", reason: "ACs complete" },
    ]);

    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("F-1");
    expect(text).toContain("ready-for-qa");
  });

  it("shows guardian status", () => {
    sidebar.setGuardianStatus("OK");
    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("OK");
  });

  it("shows warning guardian status differently", () => {
    sidebar.setGuardianStatus("STALL DETECTED");
    const lines = sidebar.render(30);
    const text = lines.join("\n");
    expect(text).toContain("STALL");
  });

  it("handles navigation input", () => {
    sidebar.setSessions([
      { sessionId: "s1", storyId: "F-1", agentRole: "developer-agent", isBusy: true, elapsedTime: 120 },
      { sessionId: "s2", storyId: "F-2", agentRole: "qa-agent", isBusy: false, elapsedTime: 300 },
    ]);
    expect(() => sidebar.handleInput("\x1b[A")).not.toThrow();
  });
});
