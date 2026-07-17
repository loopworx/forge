import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { loadAgentProfiles, buildAgentModelChoices, formatAgentModelsYaml } from "../../src/cli/agent-model-assigner";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TMP_DIR = join(import.meta.dir, "..", ".test-agent-assigner");

describe("loadAgentProfiles", () => {
  beforeEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
  });

  it("loads all 7 agent profiles from directory", () => {
    const agentsDir = join(TMP_DIR, "agents");
    mkdirSync(agentsDir, { recursive: true });
    const agents = [
      "po-agent", "developer-agent", "ux-agent", "architect-agent",
      "qa-agent", "devops-agent", "secops-agent",
    ];
    for (const agent of agents) {
      writeFileSync(join(agentsDir, `${agent}.md`), `---\nrole: ${agent}\n---\nYou are the ${agent}.\n`);
    }
    const profiles = loadAgentProfiles(TMP_DIR);
    expect(profiles).toHaveLength(7);
    expect(profiles.map(p => p.role)).toContain("po-agent");
    expect(profiles.map(p => p.role)).toContain("secops-agent");
  });

  it("extracts role and description from markdown", () => {
    const agentsDir = join(TMP_DIR, "agents");
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, "po-agent.md"), `---\nrole: po-agent\nprimarySkill: facilitating-inception\n---\nYou are the PO agent in a Forge delivery team.\n\nYour role: Inception, story writing.\n`);
    const profiles = loadAgentProfiles(TMP_DIR);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].role).toBe("po-agent");
    expect(profiles[0].description).toContain("PO agent");
  });

  it("returns empty array for non-existent directory", () => {
    const profiles = loadAgentProfiles(join(TMP_DIR, "nonexistent"));
    expect(profiles).toEqual([]);
  });
});

describe("buildAgentModelChoices", () => {
  it("builds choices for each agent with available models", () => {
    const profiles = [
      { role: "po-agent", name: "PO Agent", description: "Product owner" },
      { role: "developer-agent", name: "Developer Agent", description: "Writes code" },
    ];
    const models = [
      { providerId: "openai", modelId: "gpt-4", name: "GPT-4" },
      { providerId: "opencode-go", modelId: "glm-5.2", name: "GLM 5.2" },
    ];
    const choices = buildAgentModelChoices(profiles, models);
    expect(choices["po-agent"]).toBeDefined();
    expect(choices["po-agent"].length).toBe(2);
    expect(choices["po-agent"][0].name).toContain("GPT-4");
    expect(choices["po-agent"][0].value).toBe("openai/gpt-4");
    expect(choices["developer-agent"]).toBeDefined();
  });

  it("formats choice name as 'provider / modelId (Model Name)'", () => {
    const profiles = [{ role: "po-agent", name: "PO", description: "test" }];
    const models = [{ providerId: "openai", modelId: "gpt-4", name: "GPT-4" }];
    const choices = buildAgentModelChoices(profiles, models);
    expect(choices["po-agent"][0].name).toBe("openai / gpt-4 (GPT-4)");
  });
});

describe("formatAgentModelsYaml", () => {
  it("produces valid YAML with agentModels section", () => {
    const assignments = {
      "po-agent": { model: "openai/gpt-4", thinkingLevel: "high" },
      "developer-agent": { model: "opencode-go/glm-5.2", thinkingLevel: "high" },
    };
    const yaml = formatAgentModelsYaml(assignments);
    expect(yaml).toContain("agentModels:");
    expect(yaml).toContain("openai/gpt-4");
    expect(yaml).toContain("opencode-go/glm-5.2");
  });

  it("produces YAML parseable by yaml.parse()", () => {
    const { parse } = require("yaml");
    const assignments = {
      "po-agent": { model: "openai/gpt-4", thinkingLevel: "high" },
    };
    const yaml = formatAgentModelsYaml(assignments);
    const parsed = parse(yaml);
    expect(parsed.agentModels["po-agent"].model).toBe("openai/gpt-4");
    expect(parsed.agentModels["po-agent"].thinkingLevel).toBe("high");
  });
});
