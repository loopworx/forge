import type { Plugin } from "@opencode-ai/plugin";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, saveConfig, validateConfig } from "./config";
import { McpClient } from "./mcp-client";
import { buildPrompt, buildLoopPrompt, buildInceptionPrompt } from "./prompt-builder";
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

export function parseSessionTitle(title: string): { storyId: string; agentName: AgentRole; isRecovery: boolean } | null {
  const match = title.match(/^FORGE:\s+([A-Z]+-\d+)\s+—\s+(\S+?)(?:\s+\(recovery\))?$/);
  if (!match) return null;
  return {
    storyId: match[1],
    agentName: match[2] as AgentRole,
    isRecovery: title.includes("(recovery)"),
  };
}

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

  const linear = new McpClient({
    teamKey: config.linear.teamKey,
    projectFilter: config.linear.projectFilter || undefined,
  });

  const forgeDir = join(directory, ".forge");
  if (!existsSync(forgeDir)) {
    mkdirSync(forgeDir, { recursive: true });
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
      });

      const sessionId = (createResult.data as any)?.id;
      if (!sessionId) {
        console.error(`[Forge] Failed to create session for ${story.id}`);
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
    });

    const sessionId = (createResult.data as any)?.id;
    if (!sessionId) return;

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

  async function startInceptionPhase(phase: InceptionPhase) {
    const title = `${FORGE_TAG} Inception Phase ${phase.phase} — ${phase.name}`;

    const createResult = await client.session.create({
      body: { title },
    });

    const sessionId = (createResult.data as any)?.id;
    if (!sessionId) {
      console.error(`[Forge] Failed to create inception session for Phase ${phase.phase}`);
      return;
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

  async function startNewProject() {
    try {
      const hasStates = await linear.hasForgeStates();
      if (!hasStates) {
        const isFresh = await linear.isFreshTeam();
        if (!isFresh) {
          await client.tui.showToast({
            body: {
              message: "Linear team has existing issues but no Forge states. Create a fresh team and update forge.yaml.",
              variant: "error",
            },
          });
          return;
        }

        await client.tui.showToast({
          body: {
            message: "Creating Forge workflow states in Linear...",
            variant: "info",
          },
        });

        const result = await linear.ensureWorkflowStates();
        console.log(`[Forge] Created ${result.created.length} states, ${result.existing.length} already existed.`);
      }

      const firstArtifactPath = join(directory, config.inception.phases[0]?.output ?? "docs/lean-canvas.md");
      if (existsSync(firstArtifactPath) && projectState.mode === "development") {
        await client.tui.showToast({
          body: {
            message: "Inception already complete. Starting development mode.",
            variant: "info",
          },
        });
        saveConfig(configPath, { active: true });
        config.active = true;
        startPolling();
        return;
      }

      projectState.mode = "inception";
      projectState.inception.mode = "inception";
      projectState.inception.currentPhase = 0;
      projectState.inception.phaseSessionId = null;
      saveProjectState(directory, projectState);

      saveConfig(configPath, { active: true });
      config.active = true;

      const firstPhase = config.inception.phases[0];
      if (firstPhase) {
        await startInceptionPhase(firstPhase);
      }

      await client.tui.showToast({
        body: {
          message: "Forge inception started. Phase 1: " + (firstPhase?.name ?? "Unknown"),
          variant: "success",
        },
      });
    } catch (err) {
      console.error("[Forge] Start failed:", (err as Error).message);
      await client.tui.showToast({
        body: {
          message: `Forge start failed: ${(err as Error).message}`,
          variant: "error",
        },
      });
    }
  }

  async function stopForge() {
    saveConfig(configPath, { active: false });
    config.active = false;
    stopPolling();

    await client.tui.showToast({
      body: {
        message: "Forge stopped. Active sessions will finish naturally.",
        variant: "info",
      },
    });
  }

  async function forgeStatus() {
    const mode = projectState.mode;
    const phase = projectState.inception.currentPhase;
    const sessionCount = activeSessions.size;

    let message = `Forge status: ${mode} mode`;
    if (mode === "inception" && phase > 0) {
      const phaseInfo = config.inception.phases.find((p) => p.phase === phase);
      message += ` (Phase ${phase}: ${phaseInfo?.name ?? "Unknown"})`;
    }
    message += ` | Active sessions: ${sessionCount}`;
    if (config.active) {
      message += " | Polling: active";
    }

    await client.tui.showToast({
      body: { message, variant: "info" },
    });
  }

  async function approveStory(storyId?: string) {
    if (!storyId) {
      await client.tui.showToast({
        body: {
          message: "Usage: /forge.approve FOR-5",
          variant: "warning",
        },
      });
      return;
    }

    const agentEntry = Object.entries(config.agents).find(
      ([, ac]) => ac.humanGate,
    );
    if (!agentEntry) return;

    const [agentName, agentConfig] = agentEntry as [AgentRole, typeof config.agents[AgentRole]];

    const story: Story = {
      id: storyId,
      title: "",
      state: "ready-to-deploy",
      assignee: null,
      iteration: null,
      featureFlag: null,
      url: "",
    };

    await createSessionForStory(story, agentName, agentConfig);
    await client.tui.showToast({
      body: {
        message: `Approved ${storyId}. Creating ${agentName} session...`,
        variant: "success",
      },
    });
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
  } else if (config.active && projectState.mode === "inception" && projectState.inception.currentPhase > 0) {
    console.log("[Forge] Plugin active in inception mode. Phase", projectState.inception.currentPhase, "was in progress.");
    recoverOrphanedSessions().catch((err) => {
      console.error("[Forge] Recovery check failed:", (err as Error).message);
    });
  }

  return {
    "session.idle": async (input: any) => {
      const sessionId = input?.properties?.sessionId ?? input?.sessionId;
      if (!sessionId) return;
      await handleSessionIdle(sessionId);
    },

    "session.error": async (input: any) => {
      const sessionId = input?.properties?.sessionId ?? input?.sessionId;
      if (!sessionId) return;
      await handleSessionError(sessionId);
    },

    "experimental.session.compacting": async (input: any, output: any) => {
      const sessionId = input?.properties?.sessionId ?? input?.sessionId;
      if (!sessionId) return;
      await handleCompaction(sessionId, output);
    },

    "tui.command.execute": async (input: any, output: any) => {
      const command = input?.command ?? "";
      if (command === "forge new project" || command === "/forge new project") {
        await startNewProject();
        output.handled = true;
      } else if (command === "forge.stop" || command === "/forge.stop") {
        await stopForge();
        output.handled = true;
      } else if (command === "forge.status" || command === "/forge.status") {
        await forgeStatus();
        output.handled = true;
      } else if (command.startsWith("forge.approve") || command.startsWith("/forge.approve")) {
        const storyId = command.split(" ")[1];
        await approveStory(storyId);
        output.handled = true;
      }
    },
  };
};
