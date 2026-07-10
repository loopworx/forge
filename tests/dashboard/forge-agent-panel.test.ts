import { describe, expect, it, beforeEach } from "bun:test";
import { ForgeAgentPanel } from "../../src/dashboard/forge-agent-panel";
import type { AgentPanel } from "../../src/dashboard/split-layout";

describe("ForgeAgentPanel", () => {
  let panel: AgentPanel;

  beforeEach(() => {
    panel = new ForgeAgentPanel();
  });

  it("implements AgentPanel", () => {
    expect(typeof panel.render).toBe("function");
    expect(typeof panel.handleInput).toBe("function");
    expect(typeof panel.invalidate).toBe("function");
    expect(typeof panel.pushOutput).toBe("function");
    expect(typeof panel.setActiveSession).toBe("function");
    expect(typeof panel.clear).toBe("function");
    expect(typeof panel.cycleNext).toBe("function");
    expect(typeof panel.cyclePause).toBe("function");
    expect(typeof panel.cycleResume).toBe("function");
  });

  it("renders empty state", () => {
    const lines = panel.render(40);
    expect(lines.length).toBeGreaterThan(0);
    const text = lines.join("\n");
    expect(text).toContain("No agent output");
  });

  it("shows pushed output", () => {
    panel.pushOutput("Running tests...");
    const lines = panel.render(40);
    const text = lines.join("\n");
    expect(text).toContain("Running tests...");
  });

  it("shows active session ID", () => {
    panel.setActiveSession("session-123");
    const lines = panel.render(40);
    const text = lines.join("\n");
    expect(text).toContain("session-123");
  });

  it("clears output", () => {
    panel.pushOutput("old text");
    panel.setActiveSession("s1");
    panel.clear();
    panel.setActiveSession(null);
    const lines = panel.render(40);
    const text = lines.join("\n");
    expect(text).not.toContain("old text");
    expect(text).toContain("No agent output");
  });

  it("shows current output entry with cycle indicator", () => {
    panel.pushOutput("Line 1");
    panel.pushOutput("Line 2");
    const lines = panel.render(40);
    const text = lines.join("\n");
    expect(text).toContain("Line 1");
    expect(text).toContain("1/2");
  });

  it("cycle methods do not throw", () => {
    expect(() => panel.cycleNext()).not.toThrow();
    expect(() => panel.cyclePause()).not.toThrow();
    expect(() => panel.cycleResume()).not.toThrow();
  });

  it("cycles between outputs", () => {
    panel.pushOutput("Output from agent 1");
    panel.pushOutput("Output from agent 2");
    expect(() => panel.cycleNext()).not.toThrow();
    expect(() => panel.cycleNext()).not.toThrow();
  });
});
