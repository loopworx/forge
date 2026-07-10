import { describe, expect, it } from "bun:test";
import { buildPrompt, buildLoopPrompt, buildInceptionPrompt } from "../../src/prompts/prompt-builder";
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

    it("includes Phase 6 special instructions", () => {
      const prompt = buildInceptionPrompt({
        phase: { phase: 6, name: "Story Writing", skill: "writing-stories", agent: "po-agent", output: "stories in Linear" },
        workdir: "/tmp",
      });
      expect(prompt).toContain("PHASE 6");
      expect(prompt).toContain("forge_create_artifact");
    });
  });
});
