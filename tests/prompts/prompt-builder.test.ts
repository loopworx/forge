import { describe, expect, it } from "bun:test";
import { buildPrompt, buildLoopPrompt, buildInceptionPrompt, readLoopMd, PromptBuilderImpl } from "../../src/prompts/prompt-builder";
import type { Story } from "../../src/engine/types";

const testStory: Story = {
  id: "FORGE-1",
  title: "Add OAuth login",
  state: "in-dev",
  assignee: null,
  iteration: null,
  featureFlag: "oauth-login",
  url: "https://linear.app/issue/FORGE-1",
};

describe("prompt-builder", () => {
  describe("buildPrompt", () => {
    it("includes story ID and title", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
      });
      expect(prompt).toContain("FORGE-1");
      expect(prompt).toContain("Add OAuth login");
    });

    it("includes Linear state", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
      });
      expect(prompt).toContain("Linear state: in-dev");
    });

    it("includes feature flag when present", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
      });
      expect(prompt).toContain("Feature flag: oauth-login");
    });

    it("includes handoff comment when provided", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
        handoffComment: "AC1 is done, AC2 needs work",
      });
      expect(prompt).toContain("HANDOFF COMMENT");
      expect(prompt).toContain("AC1 is done");
    });

    it("omits handoff section when no comment", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
      });
      expect(prompt).not.toContain("HANDOFF COMMENT");
    });

    it("includes commit protocol", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
      });
      expect(prompt).toContain("COMMIT PROTOCOL");
      expect(prompt).toContain("feat(FORGE-1)");
    });

    it("includes handoff protocol with forge_handoff", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
      });
      expect(prompt).toContain("HANDOFF PROTOCOL");
      expect(prompt).toContain("forge_handoff");
    });
  });

  describe("buildLoopPrompt", () => {
    it("includes recovery context", () => {
      const prompt = buildLoopPrompt({
        story: testStory,
        agentName: "developer-agent",
        linearState: "in-dev",
        workdir: "/tmp",
      });
      expect(prompt).toContain("resuming");
      expect(prompt).toContain("FORGE-1");
      expect(prompt).toContain("Only test results determine reality");
    });

    it("includes resume protocol steps", () => {
      const prompt = buildLoopPrompt({
        story: testStory,
        agentName: "developer-agent",
        linearState: "in-dev",
        workdir: "/tmp",
      });
      expect(prompt).toContain("outer Acceptance Test");
    });
  });

  describe("buildInceptionPrompt", () => {
    it("includes phase name and skill", () => {
      const prompt = buildInceptionPrompt({
        phase: { phase: 1, name: "Lean Canvas", skill: "facilitating-inception", agent: "po-agent", output: "docs/lean-canvas.md" },
        workdir: "/tmp",
      });
      expect(prompt).toContain("Phase 1");
      expect(prompt).toContain("Lean Canvas");
      expect(prompt).toContain("facilitating-inception");
    });

    it("includes Phase 7 special instructions for story writing", () => {
      const prompt = buildInceptionPrompt({
        phase: { phase: 7, name: "Story Writing", skill: "writing-stories", agent: "po-agent", output: "stories in Linear" },
        workdir: "/tmp",
      });
      expect(prompt).toContain("PHASE 7");
      expect(prompt).toContain("forge_create_artifact");
    });

    it("includes interactive facilitation instructions", () => {
      const prompt = buildInceptionPrompt({
        phase: { phase: 1, name: "Lean Canvas", skill: "facilitating-inception", agent: "po-agent", output: "docs/lean-canvas.md" },
        workdir: "/tmp",
      });
      expect(prompt).toContain("INTERACTIVE");
      expect(prompt).toContain("/forge-next");
    });
  });

  describe("readLoopMd", () => {
    it("returns empty string when LOOP.md does not exist", () => {
      const result = readLoopMd("/nonexistent", "some-skill");
      expect(result).toBe("");
    });
  });

  describe("buildPrompt with optional fields", () => {
    it("includes failure context when provided", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
        failureContext: { reason: "Flaky test", previousState: "in-qa" },
      });
      expect(prompt).toContain("failed");
      expect(prompt).toContain("in-qa");
      expect(prompt).toContain("Flaky test");
    });

    it("includes budget when provided", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
        budgetUsd: 5.50,
      });
      expect(prompt).toContain("COST TRACKING");
      expect(prompt).toContain("$5.50");
    });

    it("omits failure context when not provided", () => {
      const prompt = buildPrompt({
        story: testStory,
        agentRole: "developer-agent",
        linearState: "in-dev",
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
      });
      expect(prompt).not.toContain("failed");
    });
  });

  describe("PromptBuilderImpl", () => {
    it("buildPrompt delegates to pure buildPrompt", () => {
      const builder = new PromptBuilderImpl();
      const result = builder.buildPrompt({
        story: testStory as any,
        agentRole: "developer-agent" as any,
        linearState: "in-dev" as any,
        primarySkill: "running-atdd-sessions",
        workdir: "/tmp",
        budgetUsd: undefined,
        handoffComment: null,
        failureContext: undefined,
      });
      expect(result).toContain("FORGE-1");
    });

    it("buildLoopPrompt delegates to pure buildLoopPrompt", () => {
      const builder = new PromptBuilderImpl();
      const result = builder.buildLoopPrompt({
        story: testStory as any,
        agentName: "developer-agent" as any,
        linearState: "in-dev" as any,
        workdir: "/tmp",
      });
      expect(result).toContain("resuming");
    });

    it("buildInceptionPrompt delegates to pure buildInceptionPrompt", () => {
      const builder = new PromptBuilderImpl();
      const result = builder.buildInceptionPrompt({
        phase: { phase: 1, name: "Lean Canvas", skill: "facilitating-inception", agent: "po-agent", output: "docs/lean-canvas.md" } as any,
        workdir: "/tmp",
      });
      expect(result).toContain("Phase 1");
    });
  });
});
