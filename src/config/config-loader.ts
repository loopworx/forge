import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import type { ForgeConfig, AgentRole, AgentConfig, AgentModelConfig, InceptionPhase, WorkflowState } from "../engine/types";
import type { Config } from "../engine/interfaces";

export function generateForgeYaml(): string {
  return `# forge.yaml — Forge v2 process manager configuration
# forge init handles Linear OAuth authentication automatically.
# No API key needed.

active: false
maxConcurrentStories: 5

linear:
  pollIntervalSeconds: 10
  teamId: ""
  teamName: ""

agents:
  po-agent:
    pullStates: ["ready-for-acceptance"]
    activeState: "in-acceptance"
    primarySkill: "approving-stories"
    interactive: false
    humanGate: false

  developer-agent:
    pullStates: ["ready-for-dev"]
    activeState: "in-dev"
    primarySkill: "running-atdd-sessions"
    interactive: false
    humanGate: false

  qa-agent:
    pullStates: ["ready-for-qa"]
    activeState: "in-qa"
    primarySkill: "running-regression-suite"
    interactive: false
    humanGate: false

  devops-agent:
    pullStates: ["ready-to-deploy"]
    activeState: "ready-to-deploy"
    primarySkill: "finishing-stories"
    interactive: false
    humanGate: true

  ux-agent:
    pullStates: []
    activeState: "in-analysis"
    primarySkill: "designing-ux"
    interactive: true
    humanGate: false

  architect-agent:
    pullStates: []
    activeState: "in-analysis"
    primarySkill: "establishing-architecture"
    interactive: true
    humanGate: false

  secops-agent:
    pullStates: []
    activeState: "in-analysis"
    primarySkill: "modeling-threats"
    interactive: false
    humanGate: false

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
`;
}

export class YamlConfig implements Config {
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  load(): ForgeConfig {
    const raw = readFileSync(this.configPath, "utf-8");
    const parsed = parse(raw);
    return normalizeConfig(parsed);
  }

  save(partial: Partial<ForgeConfig>): void {
    const existing = parse(readFileSync(this.configPath, "utf-8"));
    if (partial.active !== undefined) existing.active = partial.active;
    if (partial.maxConcurrentStories !== undefined) existing.max_concurrent_stories = partial.maxConcurrentStories;
    writeFileSync(this.configPath, stringify(existing));
  }

  validate(config: ForgeConfig): string[] {
    return validateConfig(config);
  }
}

export function validateConfig(config: ForgeConfig): string[] {
  const errors: string[] = [];

  if (config.linear.pollIntervalSeconds <= 0) {
    errors.push("linear.poll_interval_seconds must be greater than 0");
  }
  if (config.maxConcurrentStories <= 0) {
    errors.push("max_concurrent_stories must be greater than 0");
  }

  for (const [agentName, agentConfig] of Object.entries(config.agents)) {
    if (agentConfig.pullStates.length === 0) {
      const pullingAgents = ["po-agent", "developer-agent", "qa-agent", "devops-agent"];
      if (pullingAgents.includes(agentName)) {
        errors.push(`${agentName} must have at least one pull_state`);
      }
    }
  }

  if (config.inception.phases.length === 0) {
    errors.push("inception.phases must have at least one phase");
  }

  return errors;
}

function normalizeConfig(parsed: unknown): ForgeConfig {
  const p = parsed as Record<string, any>;

  const agents: Record<string, AgentConfig> = {} as Record<string, AgentConfig>;
  for (const [name, agent] of Object.entries(p.agents || {})) {
    const a = agent as Record<string, any>;
    agents[name as AgentRole] = {
      name: name as AgentRole,
      pullStates: (a.pull_states || a.pullStates || []) as WorkflowState[],
      activeState: (a.active_state || a.activeState) as AgentConfig["activeState"],
      primarySkill: (a.primary_skill || a.primarySkill) as string,
      interactive: a.interactive ?? false,
      humanGate: a.human_gate ?? a.humanGate ?? false,
    };
  }

  const phases: InceptionPhase[] = (p.inception?.phases || []).map((ph: Record<string, any>) => ({
    phase: ph.phase as number,
    name: ph.name as string,
    skill: ph.skill as string,
    agent: ph.agent as AgentRole,
    output: ph.output as string,
  }));

  let agentModels: Record<string, AgentModelConfig> | undefined;
  const rawAgentModels = p.agent_models ?? p.agentModels;
  if (rawAgentModels) {
    agentModels = {};
    for (const [role, entry] of Object.entries(rawAgentModels)) {
      const m = entry as Record<string, any>;
      agentModels[role] = {
        model: (m.model ?? m.name ?? "") as string,
        thinkingLevel: (m.thinking_level ?? m.thinkingLevel ?? "medium") as string,
      };
    }
  }

  return {
    active: p.active ?? false,
    maxConcurrentStories: p.max_concurrent_stories ?? p.maxConcurrentStories ?? 5,
    linear: {
      pollIntervalSeconds: p.linear?.poll_interval_seconds ?? p.linear?.pollIntervalSeconds ?? 10,
      teamId: p.linear?.team_id || p.linear?.teamId || "",
      teamName: p.linear?.team_name || p.linear?.teamName || "",
    },
    agents,
    inception: { phases },
    ...(agentModels ? { agentModels } : {}),
  };
}
