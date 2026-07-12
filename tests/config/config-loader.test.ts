import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { YamlConfig } from "../../src/config/config-loader";
import { generateForgeYaml } from "../../src/config/config-loader";

const TEST_DIR = join(import.meta.dir ?? ".", ".test-config");
const CONFIG_PATH = join(TEST_DIR, "forge.yaml");

describe("YamlConfig", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("generateForgeYaml", () => {
    it("produces valid YAML that can be loaded", () => {
      const yaml = generateForgeYaml();
      writeFileSync(CONFIG_PATH, yaml);
      const config = new YamlConfig(CONFIG_PATH);
      const loaded = config.load();
      expect(loaded.maxConcurrentStories).toBe(5);
      expect(loaded.linear.pollIntervalSeconds).toBe(10);
      expect(Object.keys(loaded.agents).length).toBe(7);
    });

    it("generated YAML has all 7 agents", () => {
      const yaml = generateForgeYaml();
      expect(yaml).toContain("po-agent");
      expect(yaml).toContain("developer-agent");
      expect(yaml).toContain("qa-agent");
      expect(yaml).toContain("devops-agent");
      expect(yaml).toContain("ux-agent");
      expect(yaml).toContain("architect-agent");
      expect(yaml).toContain("secops-agent");
    });

    it("generated YAML has all 8 inception phases", () => {
      const yaml = generateForgeYaml();
      expect(yaml).toContain("Lean Canvas");
      expect(yaml).toContain("Empathy Mapping");
      expect(yaml).toContain("Trade-off Sliders");
      expect(yaml).toContain("Event Storming");
      expect(yaml).toContain("UX/UI Design");
      expect(yaml).toContain("Story Writing");
      expect(yaml).toContain("Tech Stack");
      expect(yaml).toContain("Iteration Mapping");
    });

    it("defaults active to false", () => {
      const yaml = generateForgeYaml();
      writeFileSync(CONFIG_PATH, yaml);
      const config = new YamlConfig(CONFIG_PATH);
      expect(config.load().active).toBe(false);
    });
  });

  describe("loadConfig", () => {
    it("loads and normalizes a config file", () => {
      const yaml = generateForgeYaml();
      writeFileSync(CONFIG_PATH, yaml);
      const config = new YamlConfig(CONFIG_PATH);
      const loaded = config.load();
      expect(Object.keys(loaded.agents).length).toBe(7);
      expect(loaded.inception.phases.length).toBe(8);
    });

    it("converts snake_case to camelCase for agents", () => {
      writeFileSync(CONFIG_PATH, `
active: false
max_concurrent_stories: 5
linear:
  poll_interval_seconds: 30
  team_id: ""
  team_name: ""
agents:
  po-agent:
    pull_states: ["ready-for-acceptance"]
    active_state: "in-acceptance"
    primary_skill: "approving-stories"
    interactive: false
    human_gate: false
inception:
  phases: []
      `.trim());
      const config = new YamlConfig(CONFIG_PATH);
      const loaded = config.load();
      const po = loaded.agents["po-agent"];
      expect(po.pullStates).toEqual(["ready-for-acceptance"]);
      expect(po.activeState).toBe("in-acceptance");
      expect(po.primarySkill).toBe("approving-stories");
    });
  });

  describe("saveConfig", () => {
    it("saves active flag", () => {
      writeFileSync(CONFIG_PATH, generateForgeYaml());
      const config = new YamlConfig(CONFIG_PATH);
      config.save({ active: true });
      const reloaded = new YamlConfig(CONFIG_PATH).load();
      expect(reloaded.active).toBe(true);
    });

    it("saves max_concurrent_stories", () => {
      writeFileSync(CONFIG_PATH, generateForgeYaml());
      const config = new YamlConfig(CONFIG_PATH);
      config.save({ maxConcurrentStories: 10 });
      const reloaded = new YamlConfig(CONFIG_PATH).load();
      expect(reloaded.maxConcurrentStories).toBe(10);
    });
  });

  describe("validateConfig", () => {
    it("returns empty array for valid config", () => {
      writeFileSync(CONFIG_PATH, generateForgeYaml());
      const config = new YamlConfig(CONFIG_PATH);
      const errors = config.validate(config.load());
      expect(errors).toEqual([]);
    });

    it("fails validation when poll interval is zero", () => {
      writeFileSync(CONFIG_PATH, generateForgeYaml());
      const config = new YamlConfig(CONFIG_PATH);
      const loaded = config.load();
      loaded.linear.pollIntervalSeconds = 0;
      const errors = config.validate(loaded);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("poll_interval_seconds");
    });

    it("fails validation when max_concurrent_stories is zero", () => {
      writeFileSync(CONFIG_PATH, generateForgeYaml());
      const config = new YamlConfig(CONFIG_PATH);
      const loaded = config.load();
      loaded.maxConcurrentStories = 0;
      const errors = config.validate(loaded);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("max_concurrent_stories");
    });

    it("requires pull_states for pulling agents", () => {
      writeFileSync(CONFIG_PATH, generateForgeYaml());
      const config = new YamlConfig(CONFIG_PATH);
      const loaded = config.load();
      loaded.agents["developer-agent"].pullStates = [];
      const errors = config.validate(loaded);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("developer-agent");
    });

    it("requires at least one inception phase", () => {
      writeFileSync(CONFIG_PATH, generateForgeYaml());
      const config = new YamlConfig(CONFIG_PATH);
      const loaded = config.load();
      loaded.inception.phases = [];
      const errors = config.validate(loaded);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("phases");
    });
  });

  describe("agentModels", () => {
    it("loads agentModels from yaml", () => {
      const yaml = `active: false
maxConcurrentStories: 1
linear: { pollIntervalSeconds: 30, teamId: "T1", teamName: "test" }
agentModels:
  po-agent:
    model: "synthetic/glm-5.2"
    thinkingLevel: "high"
  developer-agent:
    model: "opencode-go/deepseek-v4-pro"
    thinkingLevel: "high"
agents: {}
inception: { phases: [] }
`;
      const tmpDir = join(import.meta.dir, "..", ".test-config-models");
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(join(tmpDir, "config-models.yaml"), yaml);
      const cfg = new YamlConfig(join(tmpDir, "config-models.yaml"));
      const loaded = cfg.load();
      expect(loaded.agentModels).toBeDefined();
      expect(loaded.agentModels!["po-agent"].model).toBe("synthetic/glm-5.2");
      expect(loaded.agentModels!["po-agent"].thinkingLevel).toBe("high");
      expect(loaded.agentModels!["developer-agent"].model).toBe("opencode-go/deepseek-v4-pro");
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
