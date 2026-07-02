import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildPrompt, buildLoopPrompt, readLoopMd } from "../src/prompt-builder";
import type { Story } from "../src/types";

const TMP_DIR = join(import.meta.dir, ".tmp-prompt-test");

const mockStory: Story = {
  id: "FOR-5",
  title: "Implement order form with product selection",
  state: "ready-for-dev",
  assignee: null,
  iteration: "Iteration 1",
  featureFlag: "story-005-order-form",
  url: "https://linear.app/forge-test/issue/FOR-5",
};

const mockLoopMd = `# running-atdd-sessions — Loop

## Entry Conditions
- Story is in in-dev and assigned to the developer-agent
- Feature flag is OFF

## Single Iteration Step
1. Run guarding-loops pre-flight
2. Read story snapshot
3. For the next AC: write outer AT → RED
`;

describe("prompt-builder", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe("readLoopMd", () => {
    test("reads LOOP.md content from disk", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);

      const content = readLoopMd(TMP_DIR, "running-atdd-sessions");

      expect(content).toContain("running-atdd-sessions");
      expect(content).toContain("Entry Conditions");
    });

    test("returns empty string when LOOP.md does not exist", () => {
      const content = readLoopMd(TMP_DIR, "nonexistent-skill");

      expect(content).toBe("");
    });
  });

  describe("buildPrompt", () => {
    test("builds developer prompt with running-atdd-sessions LOOP.md", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);

      const prompt = buildPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("developer-agent");
      expect(prompt).toContain("FOR-5");
      expect(prompt).toContain("in-dev");
      expect(prompt).toContain("running-atdd-sessions");
      expect(prompt).toContain("LOOP CONTRACT");
      expect(prompt).toContain("Entry Conditions");
    });

    test("builds qa prompt with running-regression-suite LOOP.md", () => {
      const skillDir = join(TMP_DIR, "skills", "running-regression-suite");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), "# running-regression-suite — Loop\n\n## Entry Conditions\n- Story is in in-qa");

      const prompt = buildPrompt({
        agentName: "qa-agent",
        story: { ...mockStory, state: "ready-for-qa" },
        linearState: "in-qa",
        primarySkill: "running-regression-suite",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("qa-agent");
      expect(prompt).toContain("in-qa");
      expect(prompt).toContain("running-regression-suite");
      expect(prompt).toContain("LOOP CONTRACT");
    });

    test("builds po prompt with approving-stories LOOP.md", () => {
      const skillDir = join(TMP_DIR, "skills", "approving-stories");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), "# approving-stories — Loop\n\n## Entry Conditions\n- Story is in in-acceptance");

      const prompt = buildPrompt({
        agentName: "po-agent",
        story: { ...mockStory, state: "ready-for-acceptance" },
        linearState: "in-acceptance",
        primarySkill: "approving-stories",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("po-agent");
      expect(prompt).toContain("in-acceptance");
      expect(prompt).toContain("approving-stories");
    });

    test("includes story snapshot path", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);

      const prompt = buildPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("stories/FOR-5.md");
    });

    test("includes CONTEXT.md and project.constraints.yaml paths", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);
      writeFileSync(join(TMP_DIR, "project.constraints.yaml"), "priorities:\n  quality: 1");

      const prompt = buildPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("CONTEXT.md");
      expect(prompt).toContain("project.constraints.yaml");
    });

    test("includes cost tracking reminder", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);

      const prompt = buildPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: TMP_DIR,
        budgetUsd: 2.0,
      });

      expect(prompt).toContain("COST TRACKING");
      expect(prompt).toContain("$2.00");
    });

    test("includes loop run log instructions", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);

      const prompt = buildPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("LOOP RUN LOG");
      expect(prompt).toContain("FOR-5.loop.md");
    });

    test("includes failure context for returning stories", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);

      const prompt = buildPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: TMP_DIR,
        failureContext: {
          reason: "Regression suite FAILED for FOR-5. Failing flow: Checkout. Repro: Clicking submit does nothing.",
          previousState: "in-qa",
        },
      });

      expect(prompt).toContain("returning from a failed");
      expect(prompt).toContain("Regression suite FAILED");
      expect(prompt).toContain("Checkout");
    });

    test("does not include failure context for fresh stories", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);

      const prompt = buildPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: TMP_DIR,
      });

      expect(prompt).not.toContain("returning from a failed");
    });

    test("includes design-system reference when it exists", () => {
      const skillDir = join(TMP_DIR, "skills", "running-atdd-sessions");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "LOOP.md"), mockLoopMd);
      mkdirSync(join(TMP_DIR, "design-system"), { recursive: true });
      writeFileSync(join(TMP_DIR, "design-system", "MASTER.md"), "# Design System");

      const prompt = buildPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("design-system/MASTER.md");
    });
  });

  describe("buildLoopPrompt", () => {
    test("builds resuming-sessions prompt with loop-state file reference", () => {
      const prompt = buildLoopPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("resuming");
      expect(prompt).toContain("FOR-5");
      expect(prompt).toContain("FOR-5.loop.md");
      expect(prompt).toContain("outer Acceptance Test");
    });

    test("does not wait for human on GREEN AT", () => {
      const prompt = buildLoopPrompt({
        agentName: "developer-agent",
        story: mockStory,
        linearState: "in-dev",
        workdir: TMP_DIR,
      });

      expect(prompt).toContain("GREEN");
      expect(prompt).toContain("ready-for-qa");
      expect(prompt).toContain("autonomous recovery");
      expect(prompt).toContain("Do NOT wait for human");
    });
  });
});
