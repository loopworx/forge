import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, validateConfig, saveConfig, generateForgeYaml } from "../src/config";

const TMP_DIR = join(import.meta.dir, ".tmp-config-test");
const VALID_CONFIG = `
active: false
max_concurrent_stories: 5

linear:
  poll_interval_seconds: 10
  team_key: "loopworx"
  project_filter: ""

agents:
  po-agent:
    pull_states: ["ready-for-acceptance"]
    active_state: "in-acceptance"
    primary_skill: "approving-stories"
    interactive: true
    human_gate: false

  developer-agent:
    pull_states: ["ready-for-dev"]
    active_state: "in-dev"
    primary_skill: "running-atdd-sessions"
    interactive: false
    human_gate: false

  qa-agent:
    pull_states: ["ready-for-qa"]
    active_state: "in-qa"
    primary_skill: "running-regression-suite"
    interactive: false
    human_gate: false

  devops-agent:
    pull_states: ["ready-to-deploy"]
    active_state: "ready-to-deploy"
    primary_skill: "finishing-stories"
    interactive: false
    human_gate: true

  ux-agent:
    pull_states: []
    active_state: "in-analysis"
    primary_skill: "designing-ux"
    interactive: true
    human_gate: false

  architect-agent:
    pull_states: []
    active_state: "in-analysis"
    primary_skill: "establishing-architecture"
    interactive: true
    human_gate: false

  secops-agent:
    pull_states: []
    active_state: "in-analysis"
    primary_skill: "modeling-threats"
    interactive: false
    human_gate: false

inception:
  phases:
    - phase: 1
      name: "Lean Canvas"
      skill: "facilitating-inception"
      agent: "po-agent"
      output: "docs/lean-canvas.md"
    - phase: 2
      name: "Empathy Mapping"
      skill: "facilitating-inception"
      agent: "ux-agent"
      output: "docs/empathy-map.md"
    - phase: 3
      name: "Trade-off Sliders"
      skill: "facilitating-inception"
      agent: "po-agent"
      output: "project.constraints.yaml"
    - phase: 4
      name: "Event Storming"
      skill: "facilitating-event-storming"
      agent: "po-agent"
      output: "docs/event-storm.yaml"
    - phase: 5
      name: "UX/UI Design"
      skill: "designing-ux"
      agent: "ux-agent"
      output: "design-system/MASTER.md"
    - phase: 6
      name: "Story Writing"
      skill: "writing-stories"
      agent: "po-agent"
      output: "stories in Linear"
    - phase: 7
      name: "Tech Stack + Architecture"
      skill: "selecting-tech-stack"
      agent: "architect-agent"
      output: "docs/adr/ADR-001-platform.md"
    - phase: 8
      name: "Iteration Mapping"
      skill: "building-iteration-map"
      agent: "po-agent"
      output: "Linear Projects + Cycle"

triggers:
  new_project:
    agent: "po-agent"
    skill: "facilitating-inception"
    interactive: true

  iteration_zero:
    concurrent:
      - agent: "devops-agent"
        skill: "bootstrapping-project"
      - agent: "secops-agent"
        skill: "securing-pipeline"
    gate:
      agent: "qa-agent"
      skill: "validating-test-harness"

  architecture_blocked:
    agent: "architect-agent"
    skill: "deciding-architecture"
    interactive: false

  security_review:
    agent: "secops-agent"
    skill: "modeling-threats"
    interactive: false

integrations:
  ui-ux-pro-max:
    enabled: true
    skill_path: ".opencode/skills/ui-ux-pro-max/"
    used_by: ["ux-agent"]
    phase: 5

  graphify:
    enabled: true
    skill_path: ".opencode/skills/graphify/"
    used_by: ["developer-agent", "architect-agent"]
    mcp_server: true

  headroom:
    enabled: true
    mcp_server: true

  browser-use:
    enabled: false
    mcp_server: true
    used_by: ["qa-agent"]

cost_tracking:
  enabled: true
  log_path: ".forge/costs/"
  per_session: true
  per_iteration: true
  budget_alert_threshold_usd: 2.00

loop_logs:
  enabled: true
  log_path: "stories/"
  include_guardian_checks: true
  include_iteration_counts: true
  include_proof_results: true
`;

describe("config", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe("loadConfig", () => {
    test("loads and parses a valid forge.yaml", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      const config = loadConfig(configPath);

      expect(config).toBeDefined();
      expect(config.active).toBe(false);
      expect(config.maxConcurrentStories).toBe(5);
      expect(config.linear.teamKey).toBe("loopworx");
      expect(config.linear.pollIntervalSeconds).toBe(10);
    });

    test("parses agent definitions correctly", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      const config = loadConfig(configPath);

      expect(config.agents["developer-agent"].pullStates).toEqual(["ready-for-dev"]);
      expect(config.agents["developer-agent"].activeState).toBe("in-dev");
      expect(config.agents["developer-agent"].primarySkill).toBe("running-atdd-sessions");
      expect(config.agents["developer-agent"].interactive).toBe(false);
    });

    test("parses inception phases correctly", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      const config = loadConfig(configPath);

      expect(config.inception.phases).toHaveLength(8);
      expect(config.inception.phases[0].phase).toBe(1);
      expect(config.inception.phases[0].name).toBe("Lean Canvas");
      expect(config.inception.phases[4].name).toBe("UX/UI Design");
      expect(config.inception.phases[6].name).toBe("Tech Stack + Architecture");
    });

    test("parses triggers correctly", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      const config = loadConfig(configPath);

      expect(config.triggers.newProject.agent).toBe("po-agent");
      expect(config.triggers.iterationZero.concurrent).toHaveLength(2);
      expect(config.triggers.iterationZero.gate.skill).toBe("validating-test-harness");
    });

    test("parses integrations correctly", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      const config = loadConfig(configPath);

      expect(config.integrations["ui-ux-pro-max"].enabled).toBe(true);
      expect(config.integrations["browser-use"].enabled).toBe(false);
      expect(config.integrations["graphify"].mcpServer).toBe(true);
    });

    test("parses cost tracking config", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      const config = loadConfig(configPath);

      expect(config.costTracking.enabled).toBe(true);
      expect(config.costTracking.budgetAlertThresholdUsd).toBe(2.0);
    });

    test("defaults active to false when not specified", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG.replace("active: false\n", ""));

      const config = loadConfig(configPath);

      expect(config.active).toBe(false);
    });

    test("defaults max_concurrent_stories to 5 when not specified", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG.replace("max_concurrent_stories: 5\n", ""));

      const config = loadConfig(configPath);

      expect(config.maxConcurrentStories).toBe(5);
    });

    test("throws on missing file", () => {
      expect(() => loadConfig(join(TMP_DIR, "nonexistent.yaml"))).toThrow();
    });

    test("throws on invalid YAML", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, "invalid: yaml: content: [");

      expect(() => loadConfig(configPath)).toThrow();
    });
  });

  describe("validateConfig", () => {
    test("valid config passes validation", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      const config = loadConfig(configPath);
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
    });

    test("missing team_key fails validation", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG.replace('team_key: "loopworx"', 'team_key: ""'));

      const config = loadConfig(configPath);
      const errors = validateConfig(config);

      expect(errors).toContain("linear.team_key is required");
    });

    test("zero poll interval fails validation", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG.replace("poll_interval_seconds: 10", "poll_interval_seconds: 0"));

      const config = loadConfig(configPath);
      const errors = validateConfig(config);

      expect(errors).toContain("linear.poll_interval_seconds must be greater than 0");
    });

    test("zero max_concurrent_stories fails validation", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG.replace("max_concurrent_stories: 5", "max_concurrent_stories: 0"));

      const config = loadConfig(configPath);
      const errors = validateConfig(config);

      expect(errors).toContain("max_concurrent_stories must be greater than 0");
    });

    test("developer-agent without pull_states fails validation", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG.replace(
        'developer-agent:\n    pull_states: ["ready-for-dev"]',
        'developer-agent:\n    pull_states: []'
      ));

      const config = loadConfig(configPath);
      const errors = validateConfig(config);

      expect(errors.some((e: string) => e.includes("developer-agent"))).toBe(true);
    });
  });

  describe("saveConfig", () => {
    test("saves active flag to forge.yaml", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      saveConfig(configPath, { active: true });

      const config = loadConfig(configPath);
      expect(config.active).toBe(true);
    });

    test("saves max_concurrent_stories to forge.yaml", () => {
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      saveConfig(configPath, { maxConcurrentStories: 10 });

      const config = loadConfig(configPath);
      expect(config.maxConcurrentStories).toBe(10);
    });
  });

  describe("generateForgeYaml", () => {
    test("produces valid YAML that can be loaded and validated", () => {
      const yaml = generateForgeYaml();
      const configPath = join(TMP_DIR, "generated-forge.yaml");
      writeFileSync(configPath, yaml);

      const config = loadConfig(configPath);
      const errors = validateConfig(config);

      expect(config.active).toBe(false);
      expect(config.maxConcurrentStories).toBe(5);
      expect(config.linear.pollIntervalSeconds).toBe(10);
      expect(config.linear.teamKey).toBe("");
      expect(errors).toContain("linear.team_key is required");
    });

    test("generated YAML includes all 7 agents", () => {
      const yaml = generateForgeYaml();
      const configPath = join(TMP_DIR, "generated-forge.yaml");
      writeFileSync(configPath, yaml);

      const config = loadConfig(configPath);

      const agentNames = Object.keys(config.agents);
      expect(agentNames).toContain("po-agent");
      expect(agentNames).toContain("developer-agent");
      expect(agentNames).toContain("qa-agent");
      expect(agentNames).toContain("devops-agent");
      expect(agentNames).toContain("ux-agent");
      expect(agentNames).toContain("architect-agent");
      expect(agentNames).toContain("secops-agent");
      expect(agentNames.length).toBe(7);
    });

    test("generated YAML includes all 8 inception phases", () => {
      const yaml = generateForgeYaml();
      const configPath = join(TMP_DIR, "generated-forge.yaml");
      writeFileSync(configPath, yaml);

      const config = loadConfig(configPath);

      expect(config.inception.phases.length).toBe(8);
      expect(config.inception.phases[0].name).toBe("Lean Canvas");
      expect(config.inception.phases[0].phase).toBe(1);
      expect(config.inception.phases[7].name).toBe("Iteration Mapping");
      expect(config.inception.phases[7].phase).toBe(8);
    });

    test("generated YAML has greenfield defaults (empty keys, inactive)", () => {
      const yaml = generateForgeYaml();

      expect(yaml).toContain('team_key: ""');
      expect(yaml).toContain("active: false");
      expect(yaml).toContain("project_filter: \"\"");
      expect(yaml).not.toContain("api_key");
    });

    test("generated YAML key matches prod forge.yaml key set", () => {
      const yaml = generateForgeYaml();
      const configPath = join(TMP_DIR, "generated-forge.yaml");
      writeFileSync(configPath, yaml);

      const config = loadConfig(configPath);

      expect(config.agents["po-agent"].activeState).toBe("in-acceptance");
      expect(config.agents["developer-agent"].activeState).toBe("in-dev");
      expect(config.agents["qa-agent"].activeState).toBe("in-qa");
      expect(config.agents["devops-agent"].activeState).toBe("ready-to-deploy");

      expect(config.integrations["ui-ux-pro-max"].enabled).toBe(true);
      expect(config.integrations["graphify"].enabled).toBe(true);
      expect(config.integrations["headroom"].enabled).toBe(true);
      expect(config.integrations["browser-use"].enabled).toBe(false);

      expect(config.costTracking.enabled).toBe(true);
      expect(config.loopLogs.enabled).toBe(true);

      expect(config.triggers.newProject.agent).toBe("po-agent");
      expect(config.triggers.newProject.skill).toBe("facilitating-inception");
      expect(config.triggers.iterationZero.concurrent.length).toBe(2);
      expect(config.triggers.iterationZero.gate.agent).toBe("qa-agent");
      expect(config.triggers.architectureBlocked.agent).toBe("architect-agent");
      expect(config.triggers.securityReview.agent).toBe("secops-agent");
    });
  });

  describe("env var fallback", () => {
    const prevTeamKey = process.env.LINEAR_TEAM_KEY;

    afterEach(() => {
      if (prevTeamKey) process.env.LINEAR_TEAM_KEY = prevTeamKey;
      else delete process.env.LINEAR_TEAM_KEY;
    });

    test("falls back to LINEAR_TEAM_KEY env var when forge.yaml has empty team_key", () => {
      process.env.LINEAR_TEAM_KEY = "ENVTEAM";
      const configPath = join(TMP_DIR, "forge.yaml");

      const yamlWithoutTeam = VALID_CONFIG.replace('team_key: "loopworx"', 'team_key: ""');
      writeFileSync(configPath, yamlWithoutTeam);

      const config = loadConfig(configPath);
      expect(config.linear.teamKey).toBe("ENVTEAM");
    });

    test("forge.yaml team_key takes precedence over env var", () => {
      process.env.LINEAR_TEAM_KEY = "env_team_should_not_win";
      const configPath = join(TMP_DIR, "forge.yaml");
      writeFileSync(configPath, VALID_CONFIG);

      const config = loadConfig(configPath);
      expect(config.linear.teamKey).toBe("loopworx");
    });

    test("generateForgeYaml leaves empty team_key so env vars can fill it", () => {
      process.env.LINEAR_TEAM_KEY = "ENV";
      const configPath = join(TMP_DIR, "generated-forge.yaml");
      writeFileSync(configPath, generateForgeYaml());

      const config = loadConfig(configPath);
      expect(config.linear.teamKey).toBe("ENV");
    });
  });
});
