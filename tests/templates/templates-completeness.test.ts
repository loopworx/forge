import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TEMPLATES_DIR = join(import.meta.dir, "..", "..", "templates");

const EXPECTED_AGENTS = [
  "developer-agent",
  "po-agent",
  "qa-agent",
  "architect-agent",
  "ux-agent",
  "devops-agent",
  "secops-agent",
] as const;

const EXPECTED_SKILLS = [
  "using-forge",
  "guarding-loops",
  "resuming-sessions",
  "facilitating-inception",
  "facilitating-event-storming",
  "establishing-ubiquitous-language",
  "deciding-architecture",
  "establishing-architecture",
  "designing-ux",
  "selecting-tech-stack",
  "writing-stories",
  "building-iteration-map",
  "running-atdd-sessions",
  "running-tdd-loops",
  "running-regression-suite",
  "running-desk-checks",
  "approving-stories",
  "finishing-stories",
  "bootstrapping-project",
  "validating-test-harness",
  "modeling-threats",
  "securing-pipeline",
  "writing-acceptance-tests",
  "managing-feature-flags",
] as const;

describe("templates completeness", () => {
  it("has templates directory", () => {
    expect(existsSync(TEMPLATES_DIR)).toBe(true);
  });

  it("has agents directory with all agent profiles", () => {
    const agentsDir = join(TEMPLATES_DIR, "agents");
    expect(existsSync(agentsDir)).toBe(true);
    for (const agent of EXPECTED_AGENTS) {
      const agentFile = join(agentsDir, `${agent}.md`);
      expect(existsSync(agentFile)).toBe(true);
    }
  });

  it("has skills directory with all 24 skills", () => {
    const skillsDir = join(TEMPLATES_DIR, "skills");
    expect(existsSync(skillsDir)).toBe(true);
    for (const skill of EXPECTED_SKILLS) {
      const skillDir = join(skillsDir, skill);
      expect(existsSync(skillDir)).toBe(true);
    }
  });

  it("every skill has SKILL.md and LOOP.md", () => {
    const skillsDir = join(TEMPLATES_DIR, "skills");
    for (const skill of EXPECTED_SKILLS) {
      const skillFile = join(skillsDir, skill, "SKILL.md");
      const loopFile = join(skillsDir, skill, "LOOP.md");
      expect(existsSync(skillFile)).toBe(true);
      expect(existsSync(loopFile)).toBe(true);
    }
  });

  it("every agent file has required frontmatter fields", () => {
    const agentsDir = join(TEMPLATES_DIR, "agents");
    for (const agent of EXPECTED_AGENTS) {
      const content = readFileSync(join(agentsDir, `${agent}.md`), "utf-8");
      expect(content).toContain("role:");
      expect(content).toContain("primarySkill:");
      expect(content).toContain("pullStates:");
    }
  });

  it("every SKILL.md has name and level in frontmatter", () => {
    const skillsDir = join(TEMPLATES_DIR, "skills");
    for (const skill of EXPECTED_SKILLS) {
      const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
      expect(content).toContain("name:");
      expect(content).toContain("level:");
    }
  });

  it("every LOOP.md is non-empty", () => {
    const skillsDir = join(TEMPLATES_DIR, "skills");
    for (const skill of EXPECTED_SKILLS) {
      const content = readFileSync(join(skillsDir, skill, "LOOP.md"), "utf-8").trim();
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("agent files reference forge_* custom tools, not v1 Linear APIs", () => {
    const agentsDir = join(TEMPLATES_DIR, "agents");
    const forgeTools = ["forge_claim_story", "forge_complete_ac", "forge_handoff", "forge_create_artifact", "forge_log_progress"];
    for (const agent of EXPECTED_AGENTS) {
      const content = readFileSync(join(agentsDir, `${agent}.md`), "utf-8");
      const hasForgeTool = forgeTools.some(t => content.includes(t));
      expect(hasForgeTool).toBe(true);
    }
  });

  it("SKILL.md files reference forge_* tools, not v1 MCP tools", () => {
    const skillsDir = join(TEMPLATES_DIR, "skills");
    const v1Tools = ["linear_", "mcp__linear_", "linear-create", "linear-update"];
    for (const skill of EXPECTED_SKILLS) {
      const content = readFileSync(join(skillsDir, skill, "SKILL.md"), "utf-8");
      const hasV1Tool = v1Tools.some(t => content.includes(t));
      expect(hasV1Tool).toBe(false);
    }
  });

  it("has forge.yaml template", () => {
    const forgeYaml = join(TEMPLATES_DIR, "forge.yaml");
    expect(existsSync(forgeYaml)).toBe(true);
    const content = readFileSync(forgeYaml, "utf-8");
    expect(content).toContain("active:");
    expect(content).toContain("linear:");
    expect(content).toContain("agents:");
    expect(content).toContain("inception:");
    expect(content).toContain("dashboard:");
  });
});
