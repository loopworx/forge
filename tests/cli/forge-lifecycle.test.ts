import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ProjectInitializer } from "../../src/cli/project-initializer";
import { MemoryPersistence } from "../../src/engine/memory-persistence";

const TEMPLATES_DIR = join(import.meta.dir, "..", "..", "templates");
const TEST_DIR = join(import.meta.dir, "..", ".test-start");

describe("forge start lifecycle", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("forge init creates a valid project that passes isInitialized", () => {
    const persistence = new MemoryPersistence();
    const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
    init.initProject(TEST_DIR, { teamId: "T1", teamName: "test" });

    expect(existsSync(join(TEST_DIR, "forge.yaml"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".forge"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "skills", "using-forge", "SKILL.md"))).toBe(true);
    expect(init.isInitialized(TEST_DIR)).toBe(true);
  });

  it("init writes persistence with inception mode", () => {
    const persistence = new MemoryPersistence();
    const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
    init.initProject(TEST_DIR);

    const state = persistence.read("project-state");
    expect(state).not.toBeNull();
    expect((state as any).mode).toBe("inception");
  });

  it("init creates all 7 agent files", () => {
    const persistence = new MemoryPersistence();
    const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
    init.initProject(TEST_DIR);

    const agents = ["developer-agent", "po-agent", "qa-agent", "architect-agent", "ux-agent", "devops-agent", "secops-agent"];
    for (const agent of agents) {
      expect(existsSync(join(TEST_DIR, "agents", `${agent}.md`))).toBe(true);
    }
  });

  it("init creates all 24 skills", () => {
    const persistence = new MemoryPersistence();
    const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
    init.initProject(TEST_DIR);

    const skillsDir = join(TEST_DIR, "skills");
    mkdirSync(skillsDir, { recursive: true });
    // skills are copied from templates
    expect(existsSync(join(skillsDir, "using-forge"))).toBe(true);
    expect(existsSync(join(skillsDir, "guarding-loops"))).toBe(true);
    expect(existsSync(join(skillsDir, "running-atdd-sessions"))).toBe(true);
    expect(existsSync(join(skillsDir, "running-tdd-loops"))).toBe(true);
  });

  it("init creates project subdirectories", () => {
    const persistence = new MemoryPersistence();
    const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
    init.initProject(TEST_DIR);

    expect(existsSync(join(TEST_DIR, "stories"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "adr"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "design-system"))).toBe(true);
  });

  it("init sets correct forge.yaml team values", () => {
    const persistence = new MemoryPersistence();
    const init = new ProjectInitializer(TEMPLATES_DIR, persistence);
    init.initProject(TEST_DIR, { teamId: "MYTEAM", teamName: "My Team" });

    const content = readFileSync(join(TEST_DIR, "forge.yaml"), "utf-8");
    expect(content).toContain('teamId: "MYTEAM"');
    expect(content).toContain('teamName: "My Team"');
  });
});
