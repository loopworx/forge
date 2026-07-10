import type {
  StoryRepository, ArtifactRepository, Persistence, AgentRuntime,
  SessionManager, ProofValidator, PromptBuilder, Config, Clock, EventBus,
} from "./interfaces";
import type {
  Story, AgentRole, AgentConfig, HandoffParams, Result,
  ProjectState, AgentSessionMeta,
} from "./types";
import { ClaimQueue } from "./claim-queue";
import { SessionTracker } from "./session-manager";
import { validateTransition, isHaltState, isTerminalState } from "./state-machine";

const PROJECT_STATE_KEY = "project-state";

export class WorkflowEngine {
  private claimQueue = new ClaimQueue();
  private tracker: SessionTracker;
  private projectState: ProjectState;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private stories: StoryRepository,
    _artifacts: ArtifactRepository,
    private persistence: Persistence,
    private sessions: SessionManager,
    private proof: ProofValidator,
    private prompts: PromptBuilder,
    private config: Config,
    clock: Clock,
    private events: EventBus,
    _runtime: AgentRuntime,
    private workdir: string = process.cwd(),
  ) {
    this.tracker = new SessionTracker(persistence, clock);
    this.projectState = this.loadProjectState();
  }

  private loadProjectState(): ProjectState {
    return this.persistence.read<ProjectState>(PROJECT_STATE_KEY) ?? {
      mode: "inception",
      inception: { mode: "inception", currentPhase: 0, phaseSessionId: null, artifacts: {} },
    };
  }

  private saveProjectState(): void {
    this.persistence.write(PROJECT_STATE_KEY, this.projectState);
  }

  get activeSessionCount(): number {
    return this.tracker.count();
  }

  getActiveSessions(): AgentSessionMeta[] {
    return Array.from(this.tracker.getAll().values());
  }

  getProjectState(): ProjectState {
    return structuredClone(this.projectState);
  }

  async claimStory(agentRole: AgentRole): Promise<Story | null> {
    return this.claimQueue.enqueue(async () => {
      const agentConfig = this.config.load().agents[agentRole];
      if (!agentConfig) return null;

      const stories = await this.stories.pollStories(agentConfig.pullStates);
      if (stories.length === 0) return null;

      const story = stories[0];
      await this.stories.updateStoryState(story.id, agentConfig.activeState);

      this.events.publish({ type: "story_claimed", storyId: story.id, agentRole });
      return story;
    });
  }

  async completeAc(storyId: string, acNumber: number, _summary: string): Promise<Result> {
    const verified = await this.proof.verifyGitCommit(storyId, acNumber);
    if (!verified) {
      return { success: false, error: `AC${acNumber} for ${storyId} requires a git commit matching feat(${storyId}): AC${acNumber}` };
    }
    return { success: true };
  }

  async handoff(
    storyId: string,
    _agentRole: AgentRole,
    params: HandoffParams,
  ): Promise<Result> {
    return this.claimQueue.enqueue(async () => {
      const currentState = await this.stories.getStoryState(storyId);
      const targetState = params.targetState;

      if (!validateTransition(currentState, targetState)) {
        return {
          success: false,
          error: `invalid transition: ${currentState} → ${targetState}`,
        };
      }

      const comment = `[Forge Handoff]
Accomplishments: ${params.accomplishments}
Remaining: ${params.remaining}
Test locations: ${params.testLocations}${params.blockers ? `\nBlockers: ${params.blockers}` : ""}`;

      await this.stories.postComment(storyId, comment);
      await this.stories.updateStoryState(storyId, targetState);

      return { success: true };
    });
  }

  async handleAgentIdle(sessionId: string, storyId: string, agentRole: AgentRole): Promise<void> {
    const meta = this.tracker.get(sessionId);

    const currentState = await this.stories.getStoryState(storyId);

    if (isTerminalState(currentState) || isHaltState(currentState)) {
      this.tracker.remove(sessionId);
      return;
    }

    const agentConfig = this.config.load().agents[agentRole];
    if (!agentConfig) { this.tracker.remove(sessionId); return; }

    const config = this.config.load();

    if (currentState !== agentConfig.activeState) {
      for (const [nextRole, nextConfig] of Object.entries(config.agents)) {
        if (nextConfig.pullStates.includes(currentState)) {
          this.tracker.remove(sessionId);
          await this.dispatchAgent(storyId, nextRole as AgentRole, nextConfig);
          return;
        }
      }
      this.tracker.remove(sessionId);
      return;
    }

    const lastComment = await this.stories.getLastCommentWithDate(storyId);
    if (lastComment && meta) {
      const commentTime = new Date(lastComment.createdAt).getTime();
      if (commentTime > meta.sessionStartTime) {
        await this.stories.updateStoryState(storyId, "halted-stall");
        this.events.publish({ type: "story_halted", storyId, reason: "handoff comment without state update" });
        this.tracker.remove(sessionId);
        return;
      }
    }

    await this.stories.updateStoryState(storyId, "halted-ambiguous");
    this.events.publish({ type: "story_halted", storyId, reason: "agent idle without handoff" });
    this.tracker.remove(sessionId);
  }

  async handleAgentError(sessionId: string, storyId: string, agentRole: AgentRole): Promise<void> {
    const currentState = await this.stories.getStoryState(storyId);
    const config = this.config.load();
    const meta = this.tracker.get(sessionId);
    const stillActive = Object.values(config.agents).some(a => a.activeState === currentState);

    if (stillActive && meta && !this.tracker.findByStoryId(storyId)) {
      this.tracker.remove(sessionId);
      await this.dispatchAgent(storyId, agentRole, config.agents[agentRole], true);
    } else {
      this.tracker.remove(sessionId);
    }
  }

  async startInceptionPhase(phaseName: string, workdir: string): Promise<string | null> {
    const config = this.config.load();
    const phase = config.inception.phases.find(p => p.name === phaseName);
    if (!phase) return null;

    const prompt = this.prompts.buildInceptionPrompt({ phase, workdir });
    const session = await this.sessions.createSession({
      cwd: workdir,
      tools: ["read", "bash", "write", "forge_create_artifact", "forge_log_progress"],
      agentRole: phase.agent,
    });
    await session.prompt(prompt);

    this.tracker.track(session.sessionId, `inception-${phase.phase}`, phase.agent, "in-analysis");
    this.projectState.inception.currentPhase = phase.phase;
    this.projectState.inception.phaseSessionId = session.sessionId;
    this.saveProjectState();

    this.events.publish({ type: "phase_started", phase: phase.phase, name: phase.name, sessionId: session.sessionId });
    return session.sessionId;
  }

  startPolling(): void {
    if (this.pollingTimer) return;
    const interval = (this.config.load().linear.pollIntervalSeconds || 10) * 1000;
    this.pollingTimer = setInterval(() => {
      this.pollAndDispatch().catch((err) => {
        this.events.publish({ type: "story_halted", storyId: "", reason: `polling error: ${err.message}` });
      });
    }, interval);
    this.pollAndDispatch().catch(() => {});
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async pollAndDispatch(): Promise<void> {
    const config = this.config.load();
    const allPullStates = Object.values(config.agents).flatMap(a => a.pullStates);
    const uniqueStates = [...new Set(allPullStates)];

    const stories = await this.stories.pollStories(uniqueStates);
    for (const story of stories) {
      if (this.tracker.findByStoryId(story.id)) continue;
      if (this.tracker.count() >= config.maxConcurrentStories) break;
      if (isTerminalState(story.state) || isHaltState(story.state)) continue;

      for (const [role, agentConfig] of Object.entries(config.agents)) {
        if (agentConfig.pullStates.includes(story.state)) {
          await this.dispatchAgent(story.id, role as AgentRole, agentConfig);
          break;
        }
      }
    }
  }

  private async dispatchAgent(
    storyId: string,
    agentRole: AgentRole,
    agentConfig: AgentConfig,
    isRecovery: boolean = false,
  ): Promise<string | null> {
    return this.claimQueue.enqueue(async () => {
      const currentState = await this.stories.getStoryState(storyId);
      await this.stories.updateStoryState(storyId, agentConfig.activeState);

      const story: Story = {
        id: storyId,
        title: "(unknown)",
        state: currentState,
        assignee: null,
        iteration: null,
        featureFlag: null,
        url: "",
      };

      const handoffComment = await this.stories.getLastComment(storyId);
      const prompt = this.prompts.buildPrompt({
        story,
        agentRole,
        linearState: agentConfig.activeState,
        primarySkill: agentConfig.primarySkill,
        workdir: this.workdir,
        handoffComment,
      });

      const session = await this.sessions.createSession({
        cwd: this.workdir,
        tools: ["read", "bash", "edit", "write", "grep", "find", "ls",
                "forge_claim_story", "forge_complete_ac", "forge_handoff",
                "forge_create_artifact", "forge_log_progress"],
        agentRole,
      });

      session.subscribe((event) => {
        if (event.type === "agent_settled") {
          this.handleAgentIdle(session.sessionId, storyId, agentRole).catch((err) => {
            this.events.publish({ type: "story_halted", storyId, reason: `idle handler error: ${err.message}` });
          });
        }
      });

      await session.prompt(prompt);

      this.tracker.track(session.sessionId, storyId, agentRole, agentConfig.activeState, isRecovery);
      this.events.publish({ type: "session_created", sessionId: session.sessionId, storyId, agentRole });

      return session.sessionId;
    });
  }

  dispose(): void {
    this.stopPolling();
  }
}
