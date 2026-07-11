import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createForgeComposition } from "../../src/bridge/create-pi-composition";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentRuntime, SessionManager } from "../../src/engine/interfaces";

const TEST_DIR = join(import.meta.dir, "..", ".test-composition");

function forgeYamlContent(teamId: string, teamName: string): string {
  return `active: true
maxConcurrentStories: 1

linear:
  pollIntervalSeconds: 30
  teamId: "${teamId}"
  teamName: "${teamName}"

agents:
  developer-agent:
    pullStates: [ready-for-dev]
    activeState: in-dev
    primarySkill: running-atdd-sessions
    interactive: false
    humanGate: false
  qa-agent:
    pullStates: [ready-for-qa]
    activeState: in-qa
    primarySkill: running-regression-suite
    interactive: true
    humanGate: false

inception:
  phases:
    - phase: 1
      name: Test Phase
      skill: some-skill
      agent: architect-agent
      output: test-output

dashboard:
  sidebarWidth: 40
`;
}

class StubRuntime implements AgentRuntime {
  registeredTools: Array<{ name: string }> = [];
  registeredEvents: Array<{ event: string }> = [];
  registeredCommands: Array<string> = [];

  registerCommand(name: string, _handler: unknown): void {
    this.registeredCommands.push(name);
  }
  registerTool(definition: { name: string }): void {
    this.registeredTools.push(definition);
  }
  on(event: string, _handler: unknown): void {
    this.registeredEvents.push({ event });
  }
  setStatus(_key: string, _text: string | undefined): void {}
  renderDashboard(_component: unknown): void {}
  closeDashboard(): void {}
}

class StubSessionManager implements SessionManager {
  createSessionCalls: Array<{ cwd: string; agentRole: string }> = [];
  createSession(_config: { cwd: string; agentRole: string }): Promise<{ sessionId: string; prompt: (t: string) => Promise<void>; steer: (t: string) => Promise<void>; subscribe: (l: unknown) => () => void; abort: () => Promise<void> }> {
    this.createSessionCalls.push(_config);
    return Promise.resolve({
      sessionId: "stub-session",
      prompt: async () => {},
      steer: async () => {},
      subscribe: () => { return () => {}; },
      abort: async () => {},
    });
  }
  getActiveSessions(): [] { return []; }
  terminateSession(_: string): Promise<void> { return Promise.resolve(); }
}

describe("createForgeComposition", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "forge.yaml"), forgeYamlContent("TEAM-X", "test"));
    mkdirSync(join(TEST_DIR, "skills"), { recursive: true });
    mkdirSync(join(TEST_DIR, "skills", "running-atdd-sessions"), { recursive: true });
    writeFileSync(join(TEST_DIR, "skills", "running-atdd-sessions", "LOOP.md"), "# test loop");
    mkdirSync(join(TEST_DIR, "agents"), { recursive: true });
    mkdirSync(join(TEST_DIR, ".forge"), { recursive: true });
    writeFileSync(join(TEST_DIR, ".forge", "auth.json"), JSON.stringify({
      access_token: "test-token",
      token_type: "Bearer",
      expires_at: Date.now() + 3600000,
    }));
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("returns an engine and a runtime", () => {
    const runtime = new StubRuntime();
    const sessions = new StubSessionManager();
    const result = createForgeComposition(TEST_DIR, runtime, sessions, () => {}, () => []);

    expect(result.engine).toBeDefined();
    expect(result.runtime).toBe(runtime);
  });

  it("registers all forge_* custom tools with the runtime", () => {
    const runtime = new StubRuntime();
    const sessions = new StubSessionManager();
    createForgeComposition(TEST_DIR, runtime, sessions, () => {}, () => []);

    const toolNames = runtime.registeredTools.map(t => t.name).sort();
    expect(toolNames).toContain("forge_claim_story");
    expect(toolNames).toContain("forge_complete_ac");
    expect(toolNames).toContain("forge_handoff");
    expect(toolNames).toContain("forge_create_artifact");
    expect(toolNames).toContain("forge_log_progress");
  });

  it("subscribes to session_start and session_shutdown lifecycle events", () => {
    const runtime = new StubRuntime();
    const sessions = new StubSessionManager();
    createForgeComposition(TEST_DIR, runtime, sessions, () => {}, () => []);

    const eventTypes = runtime.registeredEvents.map(e => e.event).sort();
    expect(eventTypes).toContain("session_start");
    expect(eventTypes).toContain("session_shutdown");
  });

  it("does NOT subscribe to duplicate agent_settled or output events", () => {
    const runtime = new StubRuntime();
    const sessions = new StubSessionManager();
    createForgeComposition(TEST_DIR, runtime, sessions, () => {}, () => []);

    const eventTypes = runtime.registeredEvents.map(e => e.event);
    expect(eventTypes).not.toContain("agent_settled");
    expect(eventTypes).not.toContain("agent_error");
    expect(eventTypes).not.toContain("output");
  });

  it("registers forge-new, forge-next, forge-status, forge-stop, forge-approve commands", () => {
    const runtime = new StubRuntime() as any;
    runtime.registeredCommands = [];
    runtime.registerCommand = (name: string, _handler: unknown) => {
      runtime.registeredCommands.push(name);
    };
    const sessions = new StubSessionManager();
    createForgeComposition(TEST_DIR, runtime as any, sessions, () => {}, () => []);

    expect(runtime.registeredCommands).toContain("forge-new");
    expect(runtime.registeredCommands).toContain("forge-next");
    expect(runtime.registeredCommands).toContain("forge-status");
    expect(runtime.registeredCommands).toContain("forge-stop");
    expect(runtime.registeredCommands).toContain("forge-approve");
  });

  it("loads config from forge.yaml in the working directory", () => {
    const runtime = new StubRuntime();
    const sessions = new StubSessionManager();
    const result = createForgeComposition(TEST_DIR, runtime, sessions, () => {}, () => []);

    const state = result.engine.getProjectState();
    expect(state.mode).toBe("inception");
  });

  it("reads auth from .forge/auth.json", () => {
    const runtime = new StubRuntime();
    const sessions = new StubSessionManager();
    const result = createForgeComposition(TEST_DIR, runtime, sessions, () => {}, () => []);

    expect(result.engine).toBeDefined();
  });

  it("subscribes to message_update, message_end, tool_execution_start, tool_execution_end for inception buffer", () => {
    const runtime = new StubRuntime();
    const sessions = new StubSessionManager();
    createForgeComposition(TEST_DIR, runtime, sessions, () => {}, () => []);

    const eventTypes = runtime.registeredEvents.map(e => e.event);
    expect(eventTypes).toContain("message_update");
    expect(eventTypes).toContain("message_end");
    expect(eventTypes).toContain("tool_execution_start");
    expect(eventTypes).toContain("tool_execution_end");
  });
});
