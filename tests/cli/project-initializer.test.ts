import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { ProjectInitializer } from "../../src/cli/project-initializer";
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import type { Persistence } from "../../src/engine/interfaces";
import { MemoryPersistence } from "../../src/engine/memory-persistence";

const TEMPLATES_DIR = join(import.meta.dir, "..", "..", "templates");
const TEST_PROJECT_DIR = join(import.meta.dir, "..", ".test-init-project");
const FORGE_BIN = join(import.meta.dir, "..", "..", "bin", "forge.ts");
const TMP_HOME = join(import.meta.dir, "..", ".test-init-home");
const TEST_AGENT_DIR = join(import.meta.dir, "..", ".test-init-agent-dir");

function cleanProjectDir() {
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }
  if (existsSync(TEST_AGENT_DIR)) {
    rmSync(TEST_AGENT_DIR, { recursive: true, force: true });
  }
}

describe("ProjectInitializer", () => {
  let persistence: Persistence;

  beforeEach(() => {
    cleanProjectDir();
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    persistence = new MemoryPersistence();
  });

  afterEach(() => {
    cleanProjectDir();
  });

  describe("initProject", () => {
    it("creates .forge directory when it does not exist", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);
      expect(existsSync(join(TEST_PROJECT_DIR, ".forge"))).toBe(true);
    });

    it("does not error when .forge directory already exists", () => {
      mkdirSync(join(TEST_PROJECT_DIR, ".forge"), { recursive: true });
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      expect(() => init.initProject(TEST_PROJECT_DIR)).not.toThrow();
    });

    it("writes forge.yaml from template with team info injected", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR, {
        teamId: "TEAM-123",
        teamName: "my-team",
      });

      const yamlContent = readFileSync(join(TEST_PROJECT_DIR, "forge.yaml"), "utf-8");
      expect(yamlContent).toContain('teamId: "TEAM-123"');
      expect(yamlContent).toContain('teamName: "my-team"');
    });

    it("copies skills directory from templates to .agents/skills", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);

      const skillsDir = join(TEST_PROJECT_DIR, ".agents", "skills");
      expect(existsSync(skillsDir)).toBe(true);
      expect(existsSync(join(skillsDir, "using-forge", "SKILL.md"))).toBe(true);
      expect(existsSync(join(skillsDir, "using-forge", "LOOP.md"))).toBe(true);
    });

    it("copies agents directory from templates", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);

      const agentsDir = join(TEST_PROJECT_DIR, "agents");
      expect(existsSync(agentsDir)).toBe(true);
      expect(existsSync(join(agentsDir, "developer-agent.md"))).toBe(true);
      expect(existsSync(join(agentsDir, "po-agent.md"))).toBe(true);
    });

    it("copies agents to opts.agentDir when provided", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR, { agentDir: TEST_AGENT_DIR });

      expect(existsSync(TEST_AGENT_DIR)).toBe(true);
      expect(existsSync(join(TEST_AGENT_DIR, "po-agent.md"))).toBe(true);
      expect(existsSync(join(TEST_AGENT_DIR, "developer-agent.md"))).toBe(true);
    });

    it("creates agentDir if it does not exist", () => {
      const nestedAgentDir = join(TEST_AGENT_DIR, "nested", "deeper");
      expect(existsSync(nestedAgentDir)).toBe(false);

      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR, { agentDir: nestedAgentDir });

      expect(existsSync(nestedAgentDir)).toBe(true);
      expect(existsSync(join(nestedAgentDir, "po-agent.md"))).toBe(true);
    });

    it("falls back to cwd/agents when agentDir not provided", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);

      const agentsDir = join(TEST_PROJECT_DIR, "agents");
      expect(existsSync(agentsDir)).toBe(true);
      expect(existsSync(join(agentsDir, "po-agent.md"))).toBe(true);
      expect(existsSync(TEST_AGENT_DIR)).toBe(false);
    });

    it("creates project subdirectories", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);

      expect(existsSync(join(TEST_PROJECT_DIR, "stories"))).toBe(true);
      expect(existsSync(join(TEST_PROJECT_DIR, "adr"))).toBe(true);
      expect(existsSync(join(TEST_PROJECT_DIR, "design-system"))).toBe(true);
    });

    it("writes initial persistence data", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);

      const state = persistence.read("project-state");
      expect(state).not.toBeNull();
      expect((state as Record<string, unknown>).mode).toBe("inception");
    });

    it("creates .gitignore with .forge/ if not exists", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);
      const gitignore = readFileSync(join(TEST_PROJECT_DIR, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".forge/");
    });

    it("appends .forge/ to existing .gitignore", () => {
      writeFileSync(join(TEST_PROJECT_DIR, ".gitignore"), "node_modules/\n");
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);
      const gitignore = readFileSync(join(TEST_PROJECT_DIR, ".gitignore"), "utf-8");
      expect(gitignore).toContain("node_modules/");
      expect(gitignore).toContain(".forge/");
      expect(gitignore.indexOf("node_modules/")).toBeLessThan(gitignore.indexOf(".forge"));
    });

    it("does not create .pi/extensions directory", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);
      expect(existsSync(join(TEST_PROJECT_DIR, ".pi"))).toBe(false);
    });

    it("copies skills to .agents/skills/ (not ./skills/)", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);
      expect(existsSync(join(TEST_PROJECT_DIR, ".agents", "skills"))).toBe(true);
      expect(existsSync(join(TEST_PROJECT_DIR, "skills"))).toBe(false);
    });

    it("forge.yaml template has no dashboard section", () => {
      const templateYaml = readFileSync(join(TEMPLATES_DIR, "forge.yaml"), "utf-8");
      expect(templateYaml).not.toContain("dashboard:");
    });

    it("forge.yaml template has agentModels section", () => {
      const templateYaml = readFileSync(join(TEMPLATES_DIR, "forge.yaml"), "utf-8");
      expect(templateYaml).toContain("agentModels");
    });
  });

  describe("isInitialized", () => {
    it("returns false when .forge directory is missing", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      expect(init.isInitialized(TEST_PROJECT_DIR)).toBe(false);
    });

    it("returns false when forge.yaml is missing", () => {
      mkdirSync(join(TEST_PROJECT_DIR, ".forge"), { recursive: true });
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      expect(init.isInitialized(TEST_PROJECT_DIR)).toBe(false);
    });

    it("returns true when .forge directory and forge.yaml both exist", () => {
      const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
      init.initProject(TEST_PROJECT_DIR);
      expect(init.isInitialized(TEST_PROJECT_DIR)).toBe(true);
    });
  });
});

describe("forge init CLI guard", () => {
  beforeEach(() => {
    if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
    mkdirSync(TMP_HOME, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
  });

  it("exits with code 1 when the global forge config is missing", async () => {
    expect(existsSync(join(TMP_HOME, ".config", "forge", "forge.yaml"))).toBe(false);

    const result = await $`bun run ${FORGE_BIN} init`
      .env({ HOME: TMP_HOME })
      .cwd(TMP_HOME)
      .quiet()
      .nothrow();

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Forge is not configured");
  });
});
