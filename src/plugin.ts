import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, saveConfig, validateConfig } from "./config";
import { LinearClient } from "./linear-client";
import { buildPrompt, buildLoopPrompt, buildInceptionPrompt } from "./prompt-builder";
import { parseSessionTitle } from "./utils";
import type {
  Story,
  AgentRole,
  LinearState,
  ForgeSessionInfo,
  InceptionPhase,
  ProjectState,
  CommentWithDate,
} from "./types";

const FORGE_TAG = "FORGE:";
const SESSIONS_FILE = ".forge/sessions.json";
const PROJECT_STATE_FILE = ".forge/project-state.json";

export const ForgePlugin: Plugin = async ({ client, directory }) => {
  const configPath = join(directory, "forge.yaml");

  if (!existsSync(configPath)) {
    return {};
  }

  const config = loadConfig(configPath);
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.error("[Forge] Configuration errors:", errors.join(", "));
    return {};
  }

  const linear = new LinearClient({
    authPath: join(directory, ".forge", "linear-auth.json"),
    projectFilter: config.linear.projectFilter || undefined,
  });

  const forgeDir = join(directory, ".forge");
  if (!existsSync(forgeDir)) {
    mkdirSync(forgeDir, { recursive: true });
  }

  if (config.linear.teamId) {
    linear.teamId = config.linear.teamId;
    linear.teamName = config.linear.teamName;
    console.log(`[Forge] Using configured team: ${linear.teamName} (${linear.teamId})`);
    client.tui.showToast({
      body: { message: `Forge: Team ${linear.teamName}`, variant: "info" },
    }).catch(() => {});
  } else {
    linear.discoverTeam().then(async (team) => {
      if (team) {
        console.log(`[Forge] Auto-detected team: ${team.name} (${team.id})`);
        await client.tui.showToast({
          body: { message: `Forge: Team ${team.name} discovered`, variant: "info" },
        });
      } else {
        const teams = await linear.listTeams();
        if (teams.length === 0) {
          console.error("[Forge] No teams found in your Linear workspace.");
          await client.tui.showToast({
            body: { message: "Forge: No Linear teams found", variant: "error" },
          });
        } else {
          const names = teams.map((t) => t.name).join(", ");
          console.error(`[Forge] Multiple teams found: ${names}.`);
          await client.tui.showToast({
            body: { message: `Forge: Multiple teams found (${names}). Run forge init to select a team.`, variant: "error" },
          });
        }
      }
    }).catch((err) => {
      console.error("[Forge] Failed to discover Linear team at startup:", (err as Error).message);
    });
  }

  const activeSessions = new Map<string, ForgeSessionInfo>();
  let projectState = loadProjectState(directory);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  loadSessions(directory, activeSessions);

  function loadProjectState(dir: string): ProjectState {
    const path = join(dir, PROJECT_STATE_FILE);
    if (!existsSync(path)) {
      return {
        mode: "inception",
        inception: { mode: "inception", currentPhase: 0, phaseSessionId: null },
      };
    }
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return {
        mode: "inception",
        inception: { mode: "inception", currentPhase: 0, phaseSessionId: null },
      };
    }
  }

  function saveProjectState(dir: string, state: ProjectState): void {
    const path = join(dir, PROJECT_STATE_FILE);
    writeFileSync(path, JSON.stringify(state, null, 2));
  }

  function loadSessions(dir: string, map: Map<string, ForgeSessionInfo>): void {
    const path = join(dir, SESSIONS_FILE);
    if (!existsSync(path)) return;
    try {
      const data = JSON.parse(readFileSync(path, "utf-8"));
      for (const [id, info] of Object.entries(data)) {
        map.set(id, info as ForgeSessionInfo);
      }
    } catch {
      // ignore corrupted file
    }
  }

  function saveSessions(dir: string, map: Map<string, ForgeSessionInfo>): void {
    const path = join(dir, SESSIONS_FILE);
    const obj: Record<string, ForgeSessionInfo> = {};
    for (const [id, info] of map) {
      obj[id] = info;
    }
    writeFileSync(path, JSON.stringify(obj, null, 2));
  }

  function startPolling() {
    if (pollInterval) return;

    pollInterval = setInterval(async () => {
      try {
        await pollAndCreate();
      } catch (err) {
        console.error("[Forge] Poll error:", (err as Error).message);
      }
    }, config.linear.pollIntervalSeconds * 1000);

    pollAndCreate().catch((err) => {
      console.error("[Forge] Initial poll error:", (err as Error).message);
    });
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function pollAndCreate() {
    const allPullStates: LinearState[] = [];
    for (const [, agentConfig] of Object.entries(config.agents)) {
      allPullStates.push(...agentConfig.pullStates);
    }
    const uniqueStates = [...new Set(allPullStates)] as LinearState[];

    const stories = await linear.pollStories(uniqueStates);

    for (const story of stories) {
      const existing = findActiveSession(story.id);
      if (existing) continue;

      if (activeSessions.size >= config.maxConcurrentStories) continue;

      const agentEntry = Object.entries(config.agents).find(
        ([, ac]) => ac.pullStates.includes(story.state),
      );
      if (!agentEntry) continue;

      const [agentName, agentConfig] = agentEntry as [AgentRole, typeof config.agents[AgentRole]];

      await createSessionForStory(story, agentName, agentConfig);
    }
  }

  async function createSessionForStory(
    story: Story,
    agentName: AgentRole,
    agentConfig: typeof config.agents[AgentRole],
  ) {
    try {
      try {
        await linear.updateStoryState(story.id, agentConfig.activeState);
        console.log(`[Forge] Claimed ${story.id} → ${agentConfig.activeState}`);
      } catch (err) {
        console.error(`[Forge] Failed to claim ${story.id}:`, (err as Error).message);
      }

      const title = `${FORGE_TAG} ${story.id} — ${agentName}`;

      const createResult = await client.session.create({
        body: { title },
        query: { directory },
      });

      const sessionId = (createResult.data as any)?.id;
      if (!sessionId) {
        const err = createResult.error as any;
        console.error(`[Forge] Failed to create session for ${story.id}:`,
          err?.message ?? err?.body ?? err ?? "unknown error",
          "(HTTP", createResult.response?.status, ")");
        return;
      }

      const sessionStartTime = Date.now();

      let handoffComment: string | null = null;
      try {
        handoffComment = await linear.getLastComment(story.id);
      } catch {
        // non-fatal — continue without comment
      }

      const prompt = buildPrompt({
        agentName,
        story,
        linearState: agentConfig.activeState,
        primarySkill: agentConfig.primarySkill,
        workdir: directory,
        budgetUsd: config.costTracking.budgetAlertThresholdUsd,
        handoffComment,
      });

      await client.session.promptAsync({
        path: { id: sessionId },
        body: {
          agent: agentName,
          parts: [{ type: "text", text: prompt }],
        },
      });

      const sessionInfo: ForgeSessionInfo = {
        sessionId,
        storyId: story.id,
        agentName,
        linearState: agentConfig.activeState,
        isRecovery: false,
        isDev: true,
        sessionStartTime,
      };

      activeSessions.set(sessionId, sessionInfo);
      saveSessions(directory, activeSessions);

      console.log(`[Forge] Created ${agentName} session for ${story.id} (${sessionId})`);

      await client.tui.showToast({
        body: {
          message: `${story.id} → ${agentName} session started`,
          variant: "info",
        },
      });
    } catch (err) {
      console.error(`[Forge] Failed to create session for ${story.id}:`, (err as Error).message);
    }
  }

  async function createRecoverySession(
    storyId: string,
    agentName: AgentRole,
    linearState: LinearState,
  ) {
    const story: Story = {
      id: storyId,
      title: "(recovery)",
      state: linearState,
      assignee: null,
      iteration: null,
      featureFlag: null,
      url: "",
    };

    const title = `${FORGE_TAG} ${storyId} — ${agentName} (recovery)`;

    const createResult = await client.session.create({
      body: { title },
      query: { directory },
    });

    const sessionId = (createResult.data as any)?.id;
    if (!sessionId) {
      const err = createResult.error as any;
      console.error(`[Forge] Failed to create recovery session for ${storyId}:` ,
        err?.message ?? err?.body ?? err ?? "unknown error",
        "(HTTP", createResult.response?.status, ")");
      return;
    }

    const prompt = buildLoopPrompt({
      agentName,
      story,
      linearState,
      workdir: directory,
    });

    await client.session.promptAsync({
      path: { id: sessionId },
      body: {
        agent: agentName,
        parts: [{ type: "text", text: prompt }],
      },
    });

    activeSessions.set(sessionId, {
      sessionId,
      storyId,
      agentName,
      linearState,
      isRecovery: true,
      isDev: true,
      sessionStartTime: Date.now(),
    });
    saveSessions(directory, activeSessions);

    console.log(`[Forge] Created recovery session for ${storyId} (${sessionId})`);
  }

  function findActiveSession(storyId: string): ForgeSessionInfo | undefined {
    for (const [, info] of activeSessions) {
      if (info.storyId === storyId) return info;
    }
    return undefined;
  }

  function isForgeSession(sessionId: string): boolean {
    return activeSessions.has(sessionId);
  }

  function isInceptionSession(sessionId: string): boolean {
    return projectState.inception.phaseSessionId === sessionId;
  }

  async function handleSessionIdle(sessionId: string) {
    if (isInceptionSession(sessionId)) {
      await handleInceptionIdle(sessionId);
      return;
    }

    if (!isForgeSession(sessionId)) return;
    await handleDevIdle(sessionId);
  }

  async function handleInceptionIdle(_sessionId: string) {
    const currentPhase = projectState.inception.currentPhase;
    const phase = config.inception.phases.find((p) => p.phase === currentPhase);

    if (!phase) {
      console.error(`[Forge] Inception phase ${currentPhase} not found in config`);
      return;
    }

    const outputPath = join(directory, phase.output);
    if (!existsSync(outputPath)) {
      console.log(`[Forge] Inception Phase ${currentPhase} idle but output ${phase.output} not found.`);
      await client.tui.showToast({
        body: {
          message: `Phase ${currentPhase} (${phase.name}) ended but ${phase.output} not found. Check the session.`,
          variant: "warning",
        },
      });
      projectState.inception.phaseSessionId = null;
      saveProjectState(directory, projectState);
      return;
    }

    console.log(`[Forge] Inception Phase ${currentPhase} complete: ${phase.output} exists.`);

    const nextPhaseNum = currentPhase + 1;
    const nextPhase = config.inception.phases.find((p) => p.phase === nextPhaseNum);

    if (!nextPhase) {
      console.log(`[Forge] Inception complete! Transitioning to development mode.`);
      projectState.mode = "development";
      projectState.inception.mode = "development";
      projectState.inception.currentPhase = 0;
      projectState.inception.phaseSessionId = null;
      saveProjectState(directory, projectState);

      await client.tui.showToast({
        body: {
          message: "Inception complete! Starting development mode — polling Linear for stories.",
          variant: "success",
        },
      });

      startPolling();
      return;
    }

    await startInceptionPhase(nextPhase);
  }

  async function startInceptionPhase(phase: InceptionPhase): Promise<string | null> {
    const title = `${FORGE_TAG} Inception Phase ${phase.phase} — ${phase.name}`;

    const createResult = await client.session.create({
      body: { title },
      query: { directory },
    });

    const sessionId = (createResult.data as any)?.id;
    if (!sessionId) {
      const err = createResult.error as any;
      console.error(`[Forge] Failed to create inception session for Phase ${phase.phase}:`,
        err?.message ?? err?.body ?? err ?? "unknown error",
        "(HTTP", createResult.response?.status, ")");
      return null;
    }

    const prompt = buildInceptionPrompt({
      phase,
      workdir: directory,
    });

    await client.session.promptAsync({
      path: { id: sessionId },
      body: {
        agent: phase.agent,
        parts: [{ type: "text", text: prompt }],
      },
    });

    projectState.inception.currentPhase = phase.phase;
    projectState.inception.phaseSessionId = sessionId;
    saveProjectState(directory, projectState);

    console.log(`[Forge] Started inception Phase ${phase.phase}: ${phase.name} (${sessionId})`);

    await client.tui.showToast({
      body: {
        message: `Inception Phase ${phase.phase}: ${phase.name} — ${phase.agent}`,
        variant: "info",
      },
    });

    await client.tui.openSessions();

    return sessionId;
  }

  async function handleDevIdle(sessionId: string) {
    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) return;

    const currentState = await linear.getStoryState(sessionInfo.storyId);
    const activeState = sessionInfo.linearState;

    activeSessions.delete(sessionId);
    saveSessions(directory, activeSessions);

    console.log(`[Forge] Session ${sessionId} idle. Story ${sessionInfo.storyId} now in ${currentState}`);

    if (currentState === "ready-to-deploy") {
      await client.tui.showToast({
        body: {
          message: `${sessionInfo.storyId} is ready to deploy. Run /forge.approve ${sessionInfo.storyId}`,
          variant: "warning",
        },
      });
      return;
    }

    if (currentState === "done") {
      console.log(`[Forge] Story ${sessionInfo.storyId} is done.`);
      await client.tui.showToast({
        body: {
          message: `${sessionInfo.storyId} is done.`,
          variant: "success",
        },
      });
      return;
    }

    const isHalted = currentState.startsWith("halted-");
    if (isHalted) {
      console.log(`[Forge] Story ${sessionInfo.storyId} halted: ${currentState}`);
      await client.tui.showToast({
        body: {
          message: `${sessionInfo.storyId} halted: ${currentState}`,
          variant: "error",
        },
      });
      return;
    }

    const agentEntry = Object.entries(config.agents).find(
      ([, ac]) => ac.pullStates.includes(currentState),
    );
    if (agentEntry) {
      const [nextAgent, nextConfig] = agentEntry as [AgentRole, typeof config.agents[AgentRole]];
      const story: Story = {
        id: sessionInfo.storyId,
        title: "",
        state: currentState,
        assignee: null,
        iteration: null,
        featureFlag: null,
        url: "",
      };
      await createSessionForStory(story, nextAgent, nextConfig);
      return;
    }

    if (currentState === activeState) {
      await handleFailsafe(sessionId, sessionInfo, currentState);
    }
  }

  async function handleFailsafe(
    sessionId: string,
    sessionInfo: ForgeSessionInfo,
    currentState: LinearState,
  ) {
    console.log(`[Forge] Failsafe: ${sessionInfo.storyId} still in ${currentState} after session idle.`);

    let comment: CommentWithDate | null = null;
    try {
      comment = await linear.getLastCommentWithDate(sessionInfo.storyId);
    } catch {
      // non-fatal
    }

    const hasRecentComment =
      comment !== null &&
      new Date(comment.createdAt).getTime() > sessionInfo.sessionStartTime;

    if (hasRecentComment) {
      const nextPullStates = Object.values(config.agents)
        .flatMap((ac) => ac.pullStates)
        .filter((s) => s !== currentState) as LinearState[];

      console.log(`[Forge] Failsafe: recent handoff comment found. Auto-advancing ${sessionInfo.storyId}.`);

      const nextAgentEntry = Object.entries(config.agents).find(([, ac]) =>
        nextPullStates.some((ps) => ac.pullStates.includes(ps)),
      );

      if (nextAgentEntry) {
        const [nextAgent, nextConfig] = nextAgentEntry as [AgentRole, typeof config.agents[AgentRole]];
        const story: Story = {
          id: sessionInfo.storyId,
          title: "",
          state: nextConfig.activeState,
          assignee: null,
          iteration: null,
          featureFlag: null,
          url: "",
        };

        await createSessionForStory(story, nextAgent, nextConfig);

        await client.tui.showToast({
          body: {
            message: `${sessionInfo.storyId} auto-advanced: agent forgot state update, but handoff comment exists.`,
            variant: "warning",
          },
        });
      }
    } else {
      await linear.updateStoryState(sessionInfo.storyId, "halted-ambiguous");

      console.log(`[Forge] Failsafe: no recent comment. Halting ${sessionInfo.storyId} as halted-ambiguous.`);

      await client.tui.showToast({
        body: {
          message: `${sessionInfo.storyId} halted: agent session ended without state update or handoff comment.`,
          variant: "error",
        },
      });
    }
  }

  async function handleSessionError(sessionId: string) {
    if (isInceptionSession(sessionId)) {
      console.log(`[Forge] Inception session ${sessionId} errored. Phase ${projectState.inception.currentPhase} failed.`);
      projectState.inception.phaseSessionId = null;
      saveProjectState(directory, projectState);

      await client.tui.showToast({
        body: {
          message: `Inception Phase ${projectState.inception.currentPhase} failed. Run /forge new project to retry.`,
          variant: "error",
        },
      });
      return;
    }

    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) return;

    activeSessions.delete(sessionId);
    saveSessions(directory, activeSessions);

    console.log(`[Forge] Session ${sessionId} crashed. Story ${sessionInfo.storyId} may need recovery.`);

    try {
      const currentState = await linear.getStoryState(sessionInfo.storyId);

      const stillActive = Object.values(config.agents).some(
        (ac) => ac.activeState === currentState,
      );

      if (stillActive && !findActiveSession(sessionInfo.storyId)) {
        await createRecoverySession(
          sessionInfo.storyId,
          sessionInfo.agentName,
          currentState,
        );
      }
    } catch (err) {
      console.error(`[Forge] Recovery check failed:`, (err as Error).message);
    }
  }

  async function handleCompaction(sessionId: string, output: any) {
    if (isInceptionSession(sessionId)) {
      output.context.push(`## Forge Inception State
- Phase: ${projectState.inception.currentPhase}
- Read .forge/project-state.json for current phase info
- Complete the output artifact for this phase`);
      return;
    }

    const sessionInfo = activeSessions.get(sessionId);
    if (!sessionInfo) return;

    output.context.push(`## Forge Loop State
- Story: ${sessionInfo.storyId}
- Linear state: ${sessionInfo.linearState}
- Agent: ${sessionInfo.agentName}
- Read stories/${sessionInfo.storyId}.loop.md for your current loop state
- Read skills/ directory for LOOP.md files if the loop contract is not in your context
- Re-run the outer Acceptance Test to verify current state
- This is an autonomous recovery — do NOT wait for human`);
  }

  async function recoverOrphanedSessions() {
    console.log("[Forge] Checking for orphaned sessions...");

    let liveSessions: Array<{ id: string; title: string }> = [];
    try {
      const listResult = await client.session.list();
      liveSessions = (listResult.data as any[]) ?? [];
    } catch (err) {
      console.error("[Forge] Failed to list sessions:", (err as Error).message);
      return;
    }

    const liveSessionIds = new Set(liveSessions.map((s) => s.id));

    let sessionStatuses: Record<string, { type: string }> = {};
    try {
      const statusResult = await client.session.status();
      sessionStatuses = (statusResult.data as any) ?? {};
    } catch {
      // non-fatal — treat all as unknown
    }

    for (const [sessionId, info] of activeSessions) {
      if (!liveSessionIds.has(sessionId)) {
        console.log(`[Forge] Orphaned session ${sessionId} (story ${info.storyId}). Checking Linear state...`);

        try {
          const currentState = await linear.getStoryState(info.storyId);

          if (currentState.startsWith("halted-")) {
            console.log(`[Forge] Story ${info.storyId} is halted (${currentState}). Removing from active sessions.`);
            activeSessions.delete(sessionId);
            saveSessions(directory, activeSessions);
            continue;
          }

          const isPullState = Object.values(config.agents).some((ac) => ac.pullStates.includes(currentState));
          if (isPullState) {
            console.log(`[Forge] Story ${info.storyId} moved to ${currentState}. Removing from active sessions — polling will handle it.`);
            activeSessions.delete(sessionId);
            saveSessions(directory, activeSessions);
            continue;
          }

          const stillActive = Object.values(config.agents).some((ac) => ac.activeState === currentState);
          if (stillActive && !findActiveSession(info.storyId)) {
            console.log(`[Forge] Story ${info.storyId} still in ${currentState}. Creating recovery session.`);
            activeSessions.delete(sessionId);
            saveSessions(directory, activeSessions);
            await createRecoverySession(info.storyId, info.agentName, currentState);
          } else {
            activeSessions.delete(sessionId);
            saveSessions(directory, activeSessions);
          }
        } catch (err) {
          console.error(`[Forge] Recovery check failed for ${info.storyId}:`, (err as Error).message);
          activeSessions.delete(sessionId);
          saveSessions(directory, activeSessions);
        }
      } else {
        const status = sessionStatuses[sessionId];
        if (status && status.type === "idle" && info.isDev) {
          console.log(`[Forge] Session ${sessionId} is idle but wasn't processed. Running idle handler.`);
          await handleDevIdle(sessionId);
        }
      }
    }

    for (const liveSession of liveSessions) {
      if (!liveSession.title?.startsWith(FORGE_TAG)) continue;
      if (activeSessions.has(liveSession.id)) continue;
      if (projectState.inception.phaseSessionId === liveSession.id) continue;

      const parsed = parseSessionTitle(liveSession.title);
      if (!parsed) continue;

      console.log(`[Forge] Found orphaned FORGE session: ${liveSession.id} (${liveSession.title})`);

      const status = sessionStatuses[liveSession.id];
      if (status && status.type === "busy") {
        console.log(`[Forge] Session ${liveSession.id} is still busy. Re-adding to active sessions.`);
        activeSessions.set(liveSession.id, {
          sessionId: liveSession.id,
          storyId: parsed.storyId,
          agentName: parsed.agentName,
          linearState: config.agents[parsed.agentName]?.activeState ?? "in-dev",
          isRecovery: parsed.isRecovery,
          isDev: true,
          sessionStartTime: Date.now(),
        });
        saveSessions(directory, activeSessions);
        continue;
      }

      try {
        const currentState = await linear.getStoryState(parsed.storyId);
        const stillActive = Object.values(config.agents).some((ac) => ac.activeState === currentState);
        if (stillActive && !findActiveSession(parsed.storyId)) {
          console.log(`[Forge] Recovering orphaned story ${parsed.storyId} in state ${currentState}.`);
          await createRecoverySession(parsed.storyId, parsed.agentName, currentState);
        }
      } catch {
        // non-fatal
      }
    }

    console.log(`[Forge] Recovery check complete. Active sessions: ${activeSessions.size}`);
  }

  if (config.active && projectState.mode === "development") {
    recoverOrphanedSessions().catch((err) => {
      console.error("[Forge] Recovery check failed:", (err as Error).message);
    });
    startPolling();
    console.log("[Forge] Plugin active in development mode. Polling Linear every", config.linear.pollIntervalSeconds, "seconds.");
  } else if (config.active && projectState.mode === "inception") {
    if (projectState.inception.currentPhase > 0) {
      console.log("[Forge] Plugin active in inception mode. Resuming Phase", projectState.inception.currentPhase);
      recoverOrphanedSessions().catch((err) => {
        console.error("[Forge] Recovery check failed:", (err as Error).message);
      });
    } else {
      try {
        const statesResult = await linear.ensureWorkflowStates();
        if (statesResult.created.length > 0) {
          await client.tui.showToast({
            body: { message: `Forge: ${statesResult.created.length} states created, ${statesResult.existing.length} existing`, variant: "success" },
          });
        }
      } catch (err) {
        console.error("[Forge] Failed to ensure workflow states:", (err as Error).message);
      }

      const firstPhase = config.inception.phases[0];
      if (firstPhase) {
        console.log("[Forge] Plugin active. Auto-starting inception Phase 1.");
        startInceptionPhase(firstPhase).then(async (sessionId) => {
          if (sessionId) {
            await client.tui.showToast({
              body: { message: `Forge: Inception Phase 1 started`, variant: "success" },
            });
            await client.tui.openSessions();
          }
        }).catch((err) => {
          console.error("[Forge] Failed to auto-start inception:", (err as Error).message);
        });
      }
    }
  }

  return {
    event: async (input: { event: { type: string; properties: Record<string, any> } }) => {
      const eventType = input.event.type;
      const props = input.event.properties ?? {};

      if (eventType === "session.idle") {
        const sessionId = props.sessionID ?? props.sessionId;
        if (sessionId) await handleSessionIdle(sessionId);
      } else if (eventType === "session.error") {
        const sessionId = props.sessionID ?? props.sessionId;
        if (sessionId) await handleSessionError(sessionId);
      }
    },

    tool: {
      forge_start: tool({
        description: "Start Forge delivery framework for a new project. Creates Linear workflow states and starts inception Phase 1 with the PO agent. Call this when the user types /forge new project.",
        args: {},
        async execute(_args, _ctx) {
          try {
            const teamId = config.linear?.teamId;
            if (!teamId) {
              return "Cannot start Forge: no Linear team configured. Run `forge init` first.";
            }

            const statesResult = await linear.ensureWorkflowStates();

            const firstArtifactPath = join(directory, config.inception.phases[0]?.output ?? "docs/lean-canvas.md");
            if (existsSync(firstArtifactPath) && projectState.mode === "development") {
              saveConfig(configPath, { active: true });
              config.active = true;
              startPolling();
              return "Inception already complete. Forge is now active in development mode, polling Linear for stories.";
            }

            saveConfig(configPath, { active: true });
            config.active = true;

            projectState.mode = "inception";
            projectState.inception.mode = "inception";
            projectState.inception.currentPhase = 0;
            projectState.inception.phaseSessionId = null;
            saveProjectState(directory, projectState);

            const firstPhase = config.inception.phases[0];
            const sessionId = firstPhase ? await startInceptionPhase(firstPhase) : null;

            const createdText = statesResult.created.length > 0
              ? `Created ${statesResult.created.length} states (${statesResult.created.join(", ")}). `
              : "";
            const existingText = statesResult.existing.length > 0
              ? `${statesResult.existing.length} states already existed. `
              : "";
            const skippedText = statesResult.skipped.length > 0
              ? `WARNING: Failed to create ${statesResult.skipped.length} states: ${statesResult.skipped.join(", ")}. `
              : "";

            if (sessionId) {
              await client.tui.openSessions();
              return [
                `Inception Phase 1 (${firstPhase?.name ?? "Lean Canvas"}) started.`,
                `Team: ${config.linear?.teamName || teamId}`,
                (createdText + existingText + skippedText).trim(),
                `Session: ${sessionId}`,
                "Switch to the po-agent session to participate.",
              ].filter(Boolean).join("\n");
            }

            return [
              `Team ready (${config.linear?.teamName || teamId}).`,
              (createdText + existingText + skippedText).trim(),
              "But failed to create inception session. Check server logs.",
            ].filter(Boolean).join("\n");
          } catch (err) {
            return `Forge start failed: ${(err as Error).message}`;
          }
        },
      }),
    },

    "experimental.session.compacting": async (input: any, output: any) => {
      const sessionId = input?.properties?.sessionId ?? input?.sessionId;
      if (!sessionId) return;
      await handleCompaction(sessionId, output);
    },

    dispose: async () => {
      stopPolling();
    },
  };
};
