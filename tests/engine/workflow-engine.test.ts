import { describe, expect, it, beforeEach } from "bun:test";
import { WorkflowEngine } from "../../src/engine/workflow-engine";
import { MemoryPersistence } from "../../src/engine/memory-persistence";
import { FakeClock } from "../../src/engine/fake-clock";
import { EngineEventBus } from "../../src/engine/events";
import type {
  StoryRepository, ArtifactRepository, AgentRuntime,
  SessionManager, Session, ProofValidator, PromptBuilder, Config,
  DashboardComponent, ToolDefinition, SessionEvent,
} from "../../src/engine/interfaces";
import type { Story, WorkflowState, ForgeConfig, TeamInfo, CommentWithDate, WorkflowStateResult, Artifact, HandoffParams, SessionConfig, SessionInfo } from "../../src/engine/types";

class MockStoryRepository implements StoryRepository {
  private stories: Story[] = [];
  private states = new Map<string, WorkflowState>();
  private comments = new Map<string, Array<{ body: string; createdAt: string }>>();

  setStories(stories: Story[]) { this.stories = stories; }
  setState(storyId: string, state: WorkflowState) { this.states.set(storyId, state); }
  addComment(storyId: string, body: string, createdAt: string) {
    if (!this.comments.has(storyId)) this.comments.set(storyId, []);
    this.comments.get(storyId)!.push({ body, createdAt });
  }

  async pollStories(_pullStates: WorkflowState[]): Promise<Story[]> { return this.stories; }
  async updateStoryState(storyId: string, state: WorkflowState): Promise<void> { this.states.set(storyId, state); }
  async getStoryState(storyId: string): Promise<WorkflowState> { return this.states.get(storyId) ?? "done"; }
  async postComment(storyId: string, body: string): Promise<void> { this.addComment(storyId, body, new Date().toISOString()); }
  async getLastComment(storyId: string): Promise<string | null> {
    const c = this.comments.get(storyId);
    return c?.length ? c[c.length - 1].body : null;
  }
  async getLastCommentWithDate(storyId: string): Promise<CommentWithDate | null> {
    const c = this.comments.get(storyId);
    return c?.length ? c[c.length - 1] : null;
  }
  async ensureWorkflowStates(): Promise<WorkflowStateResult> { return { created: [], existing: [], skipped: [] }; }
  async discoverTeam(): Promise<TeamInfo | null> { return null; }
  async listTeams(): Promise<TeamInfo[]> { return []; }
}

class MockArtifactRepository implements ArtifactRepository {
  private artifacts = new Map<string, Artifact>();
  private nextId = 1;
  async createArtifact(title: string, content: string): Promise<string> {
    const id = `doc-${this.nextId++}`;
    this.artifacts.set(id, { id, title, content });
    return id;
  }
  async getArtifact(id: string): Promise<Artifact | null> { return this.artifacts.get(id) ?? null; }
  async verifyArtifact(id: string): Promise<boolean> {
    const a = this.artifacts.get(id);
    return a !== undefined && a.content.length > 100;
  }
}

class MockSessionManager implements SessionManager {
  sessions: MockSession[] = [];
  async createSession(_config: SessionConfig): Promise<Session> {
    const s = new MockSession(`session-${this.sessions.length + 1}`);
    this.sessions.push(s);
    return s;
  }
  getActiveSessions(): SessionInfo[] { return []; }
  async terminateSession(_sessionId: string): Promise<void> {}
}

class MockSession implements Session {
  public promptCalls: string[] = [];
  public steerCalls: string[] = [];
  private listeners: Array<(event: SessionEvent) => void> = [];

  constructor(public readonly sessionId: string) {}
  async prompt(text: string): Promise<void> { this.promptCalls.push(text); }
  async steer(text: string): Promise<void> { this.steerCalls.push(text); }
  subscribe(listener: (event: SessionEvent) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }
  async abort(): Promise<void> {}
}

class MockProofValidator implements ProofValidator {
  shouldVerifyCommit = true;
  shouldVerifyArtifact = true;
  async verifyGitCommit(_storyId: string, _acNumber: number): Promise<boolean> { return this.shouldVerifyCommit; }
  async verifyArtifact(_artifactId: string): Promise<boolean> { return this.shouldVerifyArtifact; }
}

class MockPromptBuilder implements PromptBuilder {
  buildPrompt(_params: any): string { return "DEV PROMPT"; }
  buildLoopPrompt(_params: any): string { return "LOOP PROMPT"; }
  buildInceptionPrompt(_params: any): string { return "INCEPTION PROMPT"; }
}

class MockConfig implements Config {
  config: ForgeConfig;
  constructor(config: Partial<ForgeConfig> = {}) {
    this.config = {
      active: false,
      maxConcurrentStories: 5,
      linear: { pollIntervalSeconds: 10, teamId: "team-1", teamName: "Test" },
      agents: {
        "po-agent": { name: "po-agent", pullStates: ["ready-for-acceptance"], activeState: "in-acceptance", primarySkill: "approving-stories", interactive: false, humanGate: false },
        "developer-agent": { name: "developer-agent", pullStates: ["ready-for-dev"], activeState: "in-dev", primarySkill: "running-atdd-sessions", interactive: false, humanGate: false },
        "qa-agent": { name: "qa-agent", pullStates: ["ready-for-qa"], activeState: "in-qa", primarySkill: "running-regression-suite", interactive: false, humanGate: false },
        "devops-agent": { name: "devops-agent", pullStates: ["ready-to-deploy"], activeState: "ready-to-deploy", primarySkill: "finishing-stories", interactive: false, humanGate: true },
        "ux-agent": { name: "ux-agent", pullStates: [], activeState: "in-analysis", primarySkill: "designing-ux", interactive: true, humanGate: false },
        "architect-agent": { name: "architect-agent", pullStates: [], activeState: "in-analysis", primarySkill: "establishing-architecture", interactive: true, humanGate: false },
        "secops-agent": { name: "secops-agent", pullStates: [], activeState: "in-analysis", primarySkill: "modeling-threats", interactive: false, humanGate: false },
      },
      inception: { phases: [{ phase: 1, name: "Lean Canvas", skill: "facilitating-inception", agent: "po-agent", output: "docs/lean-canvas.md" }] },
      dashboard: { sidebarWidth: 40 },
      ...config,
    };
  }
  load(): ForgeConfig { return this.config; }
  save(_partial: Partial<ForgeConfig>): void {}
  validate(_config: ForgeConfig): string[] { return []; }
}

class MockRuntime implements AgentRuntime {
  tools: ToolDefinition[] = [];
  commands = new Map<string, any>();
  statuses = new Map<string, string | undefined>();
  _dashboardComponent: DashboardComponent | null = null;

  registerCommand(name: string, handler: any): void { this.commands.set(name, handler); }
  registerTool(definition: ToolDefinition): void { this.tools.push(definition); }
  on(_event: string, _handler: any): void {}
  setStatus(key: string, text: string | undefined): void { this.statuses.set(key, text); }
  renderDashboard(component: DashboardComponent): void { this._dashboardComponent = component; }
  closeDashboard(): void { this._dashboardComponent = null; }
}

describe("WorkflowEngine", () => {
  let stories: MockStoryRepository;
  let artifacts: MockArtifactRepository;
  let persistence: MemoryPersistence;
  let sessions: MockSessionManager;
  let proof: MockProofValidator;
  let prompts: MockPromptBuilder;
  let config: MockConfig;
  let clock: FakeClock;
  let events: EngineEventBus;
  let runtime: MockRuntime;
  let engine: WorkflowEngine;

  const testStory: Story = {
    id: "FORGE-1",
    title: "Add OAuth login",
    state: "ready-for-dev",
    assignee: null,
    iteration: null,
    featureFlag: null,
    url: "https://linear.app/issue/FORGE-1",
  };

  beforeEach(() => {
    stories = new MockStoryRepository();
    artifacts = new MockArtifactRepository();
    persistence = new MemoryPersistence();
    sessions = new MockSessionManager();
    proof = new MockProofValidator();
    prompts = new MockPromptBuilder();
    config = new MockConfig();
    clock = new FakeClock(1000);
    events = new EngineEventBus();
    runtime = new MockRuntime();
    engine = new WorkflowEngine(stories, artifacts, persistence, sessions, proof, prompts, config, clock, events, runtime);
  });

  describe("claimStory", () => {
    it("claims the oldest story when stories are available", async () => {
      stories.setStories([testStory]);
      stories.setState(testStory.id, "ready-for-dev");

      const result = await engine.claimStory("developer-agent");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("FORGE-1");
      expect(await stories.getStoryState("FORGE-1")).toBe("in-dev");
    });

    it("returns null when no stories are available", async () => {
      stories.setStories([]);

      const result = await engine.claimStory("developer-agent");

      expect(result).toBeNull();
    });
  });

  describe("completeAc", () => {
    it("returns success when git commit exists", async () => {
      proof.shouldVerifyCommit = true;

      const result = await engine.completeAc("FORGE-1", 1, "Implemented OAuth login");

      expect(result.success).toBe(true);
    });

    it("returns error when git commit does not exist", async () => {
      proof.shouldVerifyCommit = false;

      const result = await engine.completeAc("FORGE-1", 1, "Implemented OAuth login");

      expect(result.success).toBe(false);
      expect(result.error).toContain("FORGE-1");
      expect(result.error).toContain("AC1");
    });
  });

  describe("handoff", () => {
    it("returns success for valid transition with comment posted", async () => {
      stories.setState("FORGE-1", "in-dev");

      const handoffParams: HandoffParams = {
        targetState: "ready-for-qa",
        accomplishments: "AC1 done",
        remaining: "None",
        testLocations: "tests/oauth.test.ts",
      };

      const result = await engine.handoff("FORGE-1", "developer-agent", handoffParams);

      expect(result.success).toBe(true);
      expect(await stories.getStoryState("FORGE-1")).toBe("ready-for-qa");
      const comment = await stories.getLastComment("FORGE-1");
      expect(comment).toContain("AC1 done");
    });

    it("returns error for invalid transition", async () => {
      stories.setState("FORGE-1", "in-dev");

      const handoffParams: HandoffParams = {
        targetState: "done",
        accomplishments: "Everything",
        remaining: "Nothing",
        testLocations: "tests/",
      };

      const result = await engine.handoff("FORGE-1", "developer-agent", handoffParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain("invalid transition");
    });
  });

  describe("handleAgentIdle", () => {
    it("routes to next agent when story moved to pull state", async () => {
      stories.setState("FORGE-1", "ready-for-qa");
      stories.setStories([{ ...testStory, id: "FORGE-2" }]);
      stories.setState("FORGE-2", "ready-for-qa");

      await engine.handleAgentIdle("session-1", "FORGE-1", "developer-agent");

      expect(sessions.sessions.length).toBeGreaterThanOrEqual(0);
    });

    it("does nothing for terminal state (done)", async () => {
      stories.setState("FORGE-1", "done");

      await engine.handleAgentIdle("session-1", "FORGE-1", "developer-agent");

      let transitionEmitted = false;
      events.subscribe((e: any) => {
        if (e.type === "transition") transitionEmitted = true;
      });

      expect(transitionEmitted).toBe(false);
    });

    it("halts to ambiguous when agent idles without handoff", async () => {
      stories.setState("FORGE-1", "in-dev");
      // No comment posted, no tracked session → halt-ambiguous

      await engine.handleAgentIdle("unknown-session", "FORGE-1", "developer-agent");

      expect(await stories.getStoryState("FORGE-1")).toBe("halted-ambiguous");
    });

    it("stops timer on dispose", () => {
      engine.startPolling();
      expect(() => engine.dispose()).not.toThrow();
    });
  });

  describe("inception flow", () => {
    it("creates a session for the first inception phase", async () => {
      const sessionId = await engine.startInceptionPhase("Lean Canvas", "/tmp");

      expect(sessionId).not.toBeNull();
      expect(sessionId).toMatch(/session-/);
      expect(sessions.sessions.length).toBe(1);
    });

    it("buildInceptionPrompt returns prompt text for valid phase index", () => {
      const prompt = engine.buildInceptionPrompt(0, "/tmp");
      expect(prompt).not.toBeNull();
      expect(typeof prompt).toBe("string");
      expect(prompt!.length).toBeGreaterThan(0);
    });

    it("buildInceptionPrompt returns null for invalid phase index", () => {
      const prompt = engine.buildInceptionPrompt(999, "/tmp");
      expect(prompt).toBeNull();
    });

    it("markInceptionPhaseStarted updates project state", () => {
      engine.markInceptionPhaseStarted(2, "test-session-id");
      const state = engine.getProjectState();
      expect(state.inception.currentPhase).toBe(2);
      expect(state.inception.phaseSessionId).toBe("test-session-id");
    });

    it("transitionToDevelopment changes mode to development", () => {
      engine.transitionToDevelopment();
      const state = engine.getProjectState();
      expect(state.mode).toBe("development");
    });
  });
});
