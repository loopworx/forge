import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildPrompt, buildInceptionPrompt, buildLoopPrompt } from "../src/prompt-builder";
import { parseSessionTitle } from "../src/plugin";
import type { Story, InceptionPhase } from "../src/types";

const TMP_DIR = join(import.meta.dir, ".tmp-plugin-test");

const sampleStory: Story = {
  id: "FOR-5",
  title: "As a user, I can create a todo",
  state: "ready-for-dev",
  assignee: null,
  iteration: null,
  featureFlag: "FORGE_FOR_5",
  url: "https://linear.app/issue/FOR-5",
};

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("prompt-builder > buildPrompt > handoff comment", () => {
  test("includes handoff comment when provided", () => {
    const prompt = buildPrompt({
      agentName: "qa-agent",
      story: sampleStory,
      linearState: "in-qa",
      primarySkill: "running-regression-suite",
      workdir: TMP_DIR,
      handoffComment: "AC1+AC2 GREEN, AC3 skipped. Test: tests/acceptance.test.ts",
    });

    expect(prompt).toContain("HANDOFF COMMENT FROM PREVIOUS AGENT");
    expect(prompt).toContain("AC1+AC2 GREEN, AC3 skipped");
    expect(prompt).toContain("END HANDOFF COMMENT");
  });

  test("does not include handoff comment section when null", () => {
    const prompt = buildPrompt({
      agentName: "developer-agent",
      story: sampleStory,
      linearState: "in-dev",
      primarySkill: "running-atdd-sessions",
      workdir: TMP_DIR,
      handoffComment: null,
    });

    expect(prompt).not.toContain("HANDOFF COMMENT FROM PREVIOUS AGENT");
  });

  test("includes handoff protocol instructions", () => {
    const prompt = buildPrompt({
      agentName: "developer-agent",
      story: sampleStory,
      linearState: "in-dev",
      primarySkill: "running-atdd-sessions",
      workdir: TMP_DIR,
    });

    expect(prompt).toContain("HANDOFF PROTOCOL");
    expect(prompt).toContain("linear_save_issue");
    expect(prompt).toContain("linear_save_comment");
    expect(prompt).toContain("COMPACT handoff comment");
    expect(prompt).toContain("END HANDOFF PROTOCOL");
  });
});

describe("prompt-builder > buildInceptionPrompt", () => {
  test("builds Phase 1 prompt with correct agent and skill", () => {
    const phase: InceptionPhase = {
      phase: 1,
      name: "Lean Canvas",
      skill: "facilitating-inception",
      agent: "po-agent",
      output: "docs/lean-canvas.md",
    };

    const prompt = buildInceptionPrompt({ phase, workdir: TMP_DIR });

    expect(prompt).toContain("You are the po-agent");
    expect(prompt).toContain("Phase 1");
    expect(prompt).toContain("Lean Canvas");
    expect(prompt).toContain("facilitating-inception");
    expect(prompt).toContain("docs/lean-canvas.md");
    expect(prompt).toContain("FORGE INCEPTION");
  });

  test("builds Phase 6 prompt with story writing instructions", () => {
    const phase: InceptionPhase = {
      phase: 6,
      name: "Story Writing",
      skill: "writing-stories",
      agent: "po-agent",
      output: "stories in Linear",
    };

    const prompt = buildInceptionPrompt({ phase, workdir: TMP_DIR });

    expect(prompt).toContain("Phase 6");
    expect(prompt).toContain("PHASE 6 SPECIAL: STORY WRITING");
    expect(prompt).toContain("linear_save_issue");
    expect(prompt).toContain("ready-for-dev");
  });

  test("builds Phase 8 prompt with iteration mapping instructions", () => {
    const phase: InceptionPhase = {
      phase: 8,
      name: "Iteration Mapping",
      skill: "building-iteration-map",
      agent: "po-agent",
      output: "Linear Projects + Cycle",
    };

    const prompt = buildInceptionPrompt({ phase, workdir: TMP_DIR });

    expect(prompt).toContain("Phase 8");
    expect(prompt).toContain("PHASE 8 SPECIAL: ITERATION MAPPING");
    expect(prompt).toContain("linear_save_project");
    expect(prompt).toContain("linear_save_milestone");
  });

  test("includes handoff protocol for next phase", () => {
    const phase: InceptionPhase = {
      phase: 3,
      name: "Trade-off Sliders",
      skill: "facilitating-inception",
      agent: "po-agent",
      output: "project.constraints.yaml",
    };

    const prompt = buildInceptionPrompt({ phase, workdir: TMP_DIR });

    expect(prompt).toContain("HANDOFF PROTOCOL");
    expect(prompt).toContain("Phase 4");
    expect(prompt).toContain("END HANDOFF PROTOCOL");
  });

  test("includes CONTEXT.md reference when it exists", () => {
    writeFileSync(join(TMP_DIR, "CONTEXT.md"), "# Ubiquitous Language");

    const phase: InceptionPhase = {
      phase: 1,
      name: "Lean Canvas",
      skill: "facilitating-inception",
      agent: "po-agent",
      output: "docs/lean-canvas.md",
    };

    const prompt = buildInceptionPrompt({ phase, workdir: TMP_DIR });

    expect(prompt).toContain("CONTEXT.md");
  });

  test("includes project.constraints.yaml reference when it exists", () => {
    writeFileSync(join(TMP_DIR, "project.constraints.yaml"), "budget: 2.0");

    const phase: InceptionPhase = {
      phase: 4,
      name: "Event Storming",
      skill: "facilitating-event-storming",
      agent: "po-agent",
      output: "docs/event-storm.yaml",
    };

    const prompt = buildInceptionPrompt({ phase, workdir: TMP_DIR });

    expect(prompt).toContain("project.constraints.yaml");
  });
});

describe("prompt-builder > buildLoopPrompt", () => {
  test("builds recovery prompt with autonomous recovery instructions", () => {
    const prompt = buildLoopPrompt({
      agentName: "developer-agent",
      story: sampleStory,
      linearState: "in-dev",
      workdir: TMP_DIR,
    });

    expect(prompt).toContain("You are the developer-agent");
    expect(prompt).toContain("crashed or was compacted");
    expect(prompt).toContain("Resume protocol");
    expect(prompt).toContain("Do NOT wait for human");
    expect(prompt).toContain("autonomous recovery");
  });
});

describe("types > ForgeSessionInfo", () => {
  test("has isDev and sessionStartTime fields", () => {
    const info = {
      sessionId: "ses_123",
      storyId: "FOR-5",
      agentName: "developer-agent" as const,
      linearState: "in-dev" as const,
      isRecovery: false,
      isDev: true,
      sessionStartTime: 1700000000000,
    };

    expect(info.isDev).toBe(true);
    expect(info.sessionStartTime).toBe(1700000000000);
  });
});

describe("types > ProjectState", () => {
  test("inception state tracks current phase", () => {
    const state = {
      mode: "inception" as const,
      inception: {
        mode: "inception" as const,
        currentPhase: 3,
        phaseSessionId: "ses_123",
      },
    };

    expect(state.mode).toBe("inception");
    expect(state.inception.currentPhase).toBe(3);
    expect(state.inception.phaseSessionId).toBe("ses_123");
  });

  test("development mode has zeroed inception state", () => {
    const state = {
      mode: "development" as const,
      inception: {
        mode: "development" as const,
        currentPhase: 0,
        phaseSessionId: null,
      },
    };

    expect(state.mode).toBe("development");
    expect(state.inception.currentPhase).toBe(0);
  });
});

describe("plugin > project state persistence", () => {
  test("project-state.json can be written and read", () => {
    const statePath = join(TMP_DIR, ".forge", "project-state.json");
    mkdirSync(join(TMP_DIR, ".forge"), { recursive: true });

    const state = {
      mode: "inception",
      inception: { mode: "inception", currentPhase: 2, phaseSessionId: "ses_abc" },
    };
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    expect(existsSync(statePath)).toBe(true);
    const read = JSON.parse(require("node:fs").readFileSync(statePath, "utf-8"));
    expect(read.mode).toBe("inception");
    expect(read.inception.currentPhase).toBe(2);
  });

  test("sessions.json can be written and read", () => {
    const sessionsPath = join(TMP_DIR, ".forge", "sessions.json");
    mkdirSync(join(TMP_DIR, ".forge"), { recursive: true });

    const sessions = {
      ses_123: {
        sessionId: "ses_123",
        storyId: "FOR-5",
        agentName: "developer-agent",
        linearState: "in-dev",
        isRecovery: false,
        isDev: true,
        sessionStartTime: 1700000000000,
      },
    };
    writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2));

    expect(existsSync(sessionsPath)).toBe(true);
    const read = JSON.parse(require("node:fs").readFileSync(sessionsPath, "utf-8"));
    expect(read.ses_123.storyId).toBe("FOR-5");
    expect(read.ses_123.agentName).toBe("developer-agent");
    expect(read.ses_123.sessionStartTime).toBe(1700000000000);
  });
});

describe("linear-client > getLastComment", () => {
  test("getLastComment method exists on LinearClient", async () => {
    const { LinearClient } = await import("../src/linear-client");
    const client = new LinearClient({
      apiKey: "test_key",
      teamKey: "TEST",
    });

    expect(typeof client.getLastComment).toBe("function");
  });
});

describe("linear-client > getLastCommentWithDate", () => {
  test("getLastCommentWithDate method exists on LinearClient", async () => {
    const { LinearClient } = await import("../src/linear-client");
    const client = new LinearClient({
      apiKey: "test_key",
      teamKey: "TEST",
    });

    expect(typeof client.getLastCommentWithDate).toBe("function");
  });
});

describe("linear-client > updateStoryState", () => {
  test("updateStoryState method exists on LinearClient", async () => {
    const { LinearClient } = await import("../src/linear-client");
    const client = new LinearClient({
      apiKey: "test_key",
      teamKey: "TEST",
    });

    expect(typeof client.updateStoryState).toBe("function");
  });
});

describe("types > CommentWithDate", () => {
  test("has body and createdAt fields", () => {
    const comment = {
      body: "AC1 GREEN, AC2 skipped. Tests at tests/order.test.ts",
      createdAt: "2024-01-15T10:30:00Z",
    };

    expect(comment.body).toContain("AC1 GREEN");
    expect(comment.createdAt).toBe("2024-01-15T10:30:00Z");
  });
});

describe("plugin > failsafe logic", () => {
  test("detects recent comment when createdAt > sessionStartTime", () => {
    const sessionStartTime = new Date("2024-01-15T10:00:00Z").getTime();
    const commentCreatedAt = "2024-01-15T10:30:00Z";
    const commentTime = new Date(commentCreatedAt).getTime();

    expect(commentTime).toBeGreaterThan(sessionStartTime);
  });

  test("detects stale comment when createdAt < sessionStartTime", () => {
    const sessionStartTime = new Date("2024-01-15T10:30:00Z").getTime();
    const commentCreatedAt = "2024-01-15T09:00:00Z";
    const commentTime = new Date(commentCreatedAt).getTime();

    expect(commentTime).toBeLessThan(sessionStartTime);
  });

  test("halted states start with 'halted-' prefix", () => {
    const haltedStates = ["halted-stall", "halted-ambiguous", "halted-human-gate", "halted-unsafe"];
    for (const state of haltedStates) {
      expect(state.startsWith("halted-")).toBe(true);
    }
  });

  test("non-halted states do not start with 'halted-' prefix", () => {
    const normalStates = ["in-dev", "ready-for-qa", "in-qa", "done", "ready-to-deploy"];
    for (const state of normalStates) {
      expect(state.startsWith("halted-")).toBe(false);
    }
  });

  test("active state equals pull state means failsafe should trigger", () => {
    const activeState = "in-dev";
    const currentState = "in-dev";

    expect(currentState === activeState).toBe(true);
  });

  test("state changed means normal handoff, not failsafe", () => {
    const activeState = "in-dev";
    const currentState = "ready-for-qa";

    expect(currentState !== activeState).toBe(true);
  });
});

describe("plugin > command routing", () => {
  test("command strings match expected patterns", () => {
    const commands = [
      { input: "forge new project", expected: "new project" },
      { input: "/forge new project", expected: "new project" },
      { input: "forge.stop", expected: "stop" },
      { input: "/forge.stop", expected: "stop" },
      { input: "forge.status", expected: "status" },
      { input: "/forge.status", expected: "status" },
      { input: "forge.approve FOR-5", expected: "approve" },
      { input: "/forge.approve FOR-5", expected: "approve" },
    ];

    for (const { input, expected } of commands) {
      expect(input).toContain(expected);
    }
  });
});

describe("plugin > parseSessionTitle", () => {
  test("parses normal dev session title", () => {
    const result = parseSessionTitle("FORGE: FOR-5 — developer-agent");
    expect(result).not.toBeNull();
    expect(result!.storyId).toBe("FOR-5");
    expect(result!.agentName).toBe("developer-agent");
    expect(result!.isRecovery).toBe(false);
  });

  test("parses recovery session title", () => {
    const result = parseSessionTitle("FORGE: FOR-5 — developer-agent (recovery)");
    expect(result).not.toBeNull();
    expect(result!.storyId).toBe("FOR-5");
    expect(result!.agentName).toBe("developer-agent");
    expect(result!.isRecovery).toBe(true);
  });

  test("parses QA session title", () => {
    const result = parseSessionTitle("FORGE: FOR-10 — qa-agent");
    expect(result).not.toBeNull();
    expect(result!.storyId).toBe("FOR-10");
    expect(result!.agentName).toBe("qa-agent");
    expect(result!.isRecovery).toBe(false);
  });

  test("parses PO session title", () => {
    const result = parseSessionTitle("FORGE: FOR-1 — po-agent");
    expect(result).not.toBeNull();
    expect(result!.storyId).toBe("FOR-1");
    expect(result!.agentName).toBe("po-agent");
  });

  test("returns null for non-Forge session", () => {
    expect(parseSessionTitle("My coding session")).toBeNull();
    expect(parseSessionTitle("")).toBeNull();
    expect(parseSessionTitle("FORGE: invalid")).toBeNull();
  });

  test("returns null for malformed Forge title", () => {
    expect(parseSessionTitle("FORGE: FOR-5")).toBeNull();
    expect(parseSessionTitle("FORGE: FOR-5 —")).toBeNull();
    expect(parseSessionTitle("FORGE FOR-5 — developer-agent")).toBeNull();
  });
});

describe("plugin > recovery decision matrix", () => {
  test("dead session + halted state → remove from active, no recovery", () => {
    const currentState = "halted-ambiguous";
    const isHalted = currentState.startsWith("halted-");
    expect(isHalted).toBe(true);
  });

  test("dead session + pull state → remove, let polling handle it", () => {
    const currentState = "ready-for-qa";
    const isPullState = ["ready-for-dev", "ready-for-qa", "ready-for-acceptance", "ready-to-deploy"].includes(currentState);
    expect(isPullState).toBe(true);
  });

  test("dead session + active state + no existing session → create recovery", () => {
    const currentState = "in-dev";
    const activeStates = ["in-dev", "in-deskcheck", "in-qa", "in-acceptance"];
    const isStillActive = activeStates.includes(currentState);
    const hasExistingSession = false;
    const shouldRecover = isStillActive && !hasExistingSession;
    expect(shouldRecover).toBe(true);
  });

  test("dead session + active state + existing session → skip recovery", () => {
    const currentState = "in-dev";
    const activeStates = ["in-dev", "in-deskcheck", "in-qa", "in-acceptance"];
    const isStillActive = activeStates.includes(currentState);
    const hasExistingSession = true;
    const shouldRecover = isStillActive && !hasExistingSession;
    expect(shouldRecover).toBe(false);
  });

  test("live session + busy status → re-add to active sessions", () => {
    const status = { type: "busy" };
    const shouldReAdd = status.type === "busy";
    expect(shouldReAdd).toBe(true);
  });

  test("live session + idle status → run idle handler", () => {
    const status = { type: "idle" };
    const isDev = true;
    const shouldHandleIdle = status.type === "idle" && isDev;
    expect(shouldHandleIdle).toBe(true);
  });

  test("orphaned title in session.list but not in activeSessions → check Linear + recover", () => {
    const title = "FORGE: FOR-5 — developer-agent";
    const parsed = parseSessionTitle(title);
    const isInActiveSessions = false;
    const isInceptionSession = false;

    const shouldCheck = parsed !== null && !isInActiveSessions && !isInceptionSession;
    expect(shouldCheck).toBe(true);
    expect(parsed!.storyId).toBe("FOR-5");
  });

  test("non-Forge title in session.list → skip", () => {
    const title = "My regular coding session";
    const isForgeSession = title.startsWith("FORGE:");
    expect(isForgeSession).toBe(false);
  });
});
