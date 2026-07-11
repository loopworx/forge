import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WorkflowEngine } from "../../src/engine/workflow-engine";
import { FilePersistence } from "../../src/engine/file-persistence";
import { SystemClock } from "../../src/engine/system-clock";
import { EngineEventBus } from "../../src/engine/events";
import { GitProofValidator } from "../../src/engine/git-proof-validator";
import { YamlConfig } from "../../src/config/config-loader";
import { PromptBuilderImpl } from "../../src/prompts/prompt-builder";
import type { SessionConfig, SessionInfo, Story, WorkflowState } from "../../src/engine/types";
import type { StoryRepository, ArtifactRepository, SessionManager, Session } from "../../src/engine/interfaces";

const TEST_DIR = join(import.meta.dir, "..", ".test-integration");

class StubStoryRepository implements StoryRepository {
  stories: Story[] = [];
  comments: Map<string, string[]> = new Map();
  stateLog: Array<{ storyId: string; state: WorkflowState }> = [];
  private currentState: Map<string, WorkflowState> = new Map();

  pollStories(_pullStates: WorkflowState[]): Promise<Story[]> {
    return Promise.resolve([...this.stories]);
  }
  updateStoryState(storyId: string, state: WorkflowState): Promise<void> {
    this.stateLog.push({ storyId, state });
    this.currentState.set(storyId, state);
    return Promise.resolve();
  }
  getStoryState(storyId: string): Promise<WorkflowState> {
    return Promise.resolve(this.currentState.get(storyId) ?? "ready-for-dev");
  }
  postComment(storyId: string, body: string): Promise<void> {
    const list = this.comments.get(storyId) ?? [];
    list.push(body);
    this.comments.set(storyId, list);
    return Promise.resolve();
  }
  getLastComment(_storyId: string): Promise<string | null> {
    return Promise.resolve(null);
  }
  getLastCommentWithDate(_storyId: string): Promise<{ body: string; createdAt: string } | null> {
    return Promise.resolve(null);
  }
  ensureWorkflowStates(): Promise<any> {
    return Promise.resolve({ created: [], existing: [], skipped: [] });
  }
  discoverTeam(): Promise<any> {
    return Promise.resolve({ id: "team-1", name: "test" });
  }
  listTeams(): Promise<any[]> {
    return Promise.resolve([{ id: "team-1", name: "test" }]);
  }
}

class StubSessionManager implements SessionManager {
  createSessionCalls: SessionConfig[] = [];
  createSession(_config: SessionConfig): Promise<Session> {
    this.createSessionCalls.push(_config);
    return Promise.resolve({
      sessionId: "stub-session",
      prompt: async () => {},
      steer: async () => {},
      subscribe: () => { return () => {}; },
      abort: async () => {},
    });
  }
  getActiveSessions(): SessionInfo[] { return []; }
  terminateSession(_s: string): Promise<void> { return Promise.resolve(); }
}

class StubArtifactRepository implements ArtifactRepository {
  createArtifact(_title: string, _content: string): Promise<string> {
    return Promise.resolve("artifact-1");
  }
  getArtifact(_id: string): Promise<any> {
    return Promise.resolve(null);
  }
  verifyArtifact(_id: string): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class StubRuntime {
  registeredTools: Array<{ name: string }> = [];
  registeredEvents: string[] = [];

  registerCommand() {}
  registerTool(def: { name: string }) { this.registeredTools.push(def); }
  on(event: string) { this.registeredEvents.push(event); }
  setStatus() {}
  renderDashboard() {}
  closeDashboard() {}
}

describe("Full engine pipeline integration", () => {
  let stories: StubStoryRepository;
  let engine: WorkflowEngine;
  let eventBus: EngineEventBus;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".forge"), { recursive: true });
    writeFileSync(join(TEST_DIR, "forge.yaml"), `active: true
maxConcurrentStories: 3
linear:
  pollIntervalSeconds: 999
  teamId: "T1"
  teamName: "test"
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
      name: Test
      skill: test-skill
      agent: architect-agent
      output: test
dashboard:
  sidebarWidth: 40
`);

    stories = new StubStoryRepository();
    const artifacts = new StubArtifactRepository();
    const persistence = new FilePersistence(join(TEST_DIR, ".forge"));
    const sessions = new StubSessionManager();
    const proof = new GitProofValidator(".");
    const prompts = new PromptBuilderImpl();
    const config = new YamlConfig(join(TEST_DIR, "forge.yaml"));
    const clock = new SystemClock();
    eventBus = new EngineEventBus();
    const runtime = new StubRuntime();

    engine = new WorkflowEngine(
      stories, artifacts, persistence, sessions,
      proof, prompts, config, clock, eventBus, runtime as any,
    );
  });

  afterEach(() => {
    engine.dispose();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("claiming a story succeeds when stories are available", async () => {
    stories.stories = [
      { id: "F-1", title: "Test story", state: "ready-for-dev", assignee: null, iteration: null, featureFlag: null, url: "" },
    ];

    const claimed = await engine.claimStory("developer-agent");
    expect(claimed).not.toBeNull();
  });

  it("handoff after claim succeeds with valid transition", async () => {
    stories.stories = [
      { id: "F-1", title: "Test", state: "ready-for-dev", assignee: null, iteration: null, featureFlag: null, url: "" },
    ];

    const claimed = await engine.claimStory("developer-agent");
    expect(claimed).not.toBeNull();

    const result = await engine.handoff("F-1", "developer-agent", {
      targetState: "ready-for-qa",
      accomplishments: "Done",
      remaining: "",
      testLocations: "tests/",
    });

    if (!result.success) console.error("handoff error:", result.error);
    expect(result.success).toBe(true);
    expect(stories.stateLog.some(s => s.state === "ready-for-qa")).toBe(true);
  });

  it("rejects invalid state transitions", async () => {
    stories.stories = [
      { id: "F-1", title: "Test", state: "ready-for-dev", assignee: null, iteration: null, featureFlag: null, url: "" },
    ];

    await engine.claimStory("developer-agent");

    const result = await engine.handoff("F-1", "developer-agent", {
      targetState: "done",
      accomplishments: "Wrong",
      remaining: "",
      testLocations: "",
    });

    expect(result.success).toBe(false);
  });

  it("pipeline transition can be executed end to end", async () => {
    stories.stories = [
      { id: "F-1", title: "Test", state: "ready-for-dev", assignee: null, iteration: null, featureFlag: null, url: "" },
    ];

    const story = await engine.claimStory("developer-agent");
    expect(story).not.toBeNull();

    const handoff = await engine.handoff("F-1", "developer-agent", {
      targetState: "ready-for-qa",
      accomplishments: "All ACs green",
      remaining: "",
      testLocations: "tests/integration/",
    });
    expect(handoff.success).toBe(true);

    stories.stories = [
      { id: "F-1", title: "Test", state: "ready-for-qa", assignee: null, iteration: null, featureFlag: null, url: "" },
    ];

    const qaStory = await engine.claimStory("qa-agent");
    expect(qaStory).not.toBeNull();
  });
});
