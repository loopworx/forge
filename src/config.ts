import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import type { ForgeConfig, AgentRole, LinearState } from "./types";

export function generateForgeYaml(): string {
  return `# forge.yaml — Forge process manager configuration
# The plugin auto-discovers your Linear team from the OAuth token.
# No API key or team key needed — forge init handles auth automatically.

active: false
max_concurrent_stories: 5

linear:
  poll_interval_seconds: 10
  project_filter: ""

agents:
  po-agent:
    pull_states: ["ready-for-acceptance"]
    active_state: "in-acceptance"
    primary_skill: "approving-stories"
    interactive: false
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
}

export function loadConfig(configPath: string): ForgeConfig {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parse(raw);
  return normalizeConfig(parsed);
}

export function saveConfig(configPath: string, config: Partial<ForgeConfig>): void {
  const existing = parse(readFileSync(configPath, "utf-8"));
  if (config.active !== undefined) existing.active = config.active;
  if (config.maxConcurrentStories !== undefined) existing.max_concurrent_stories = config.maxConcurrentStories;
  writeFileSync(configPath, stringify(existing));
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

  const agents: Record<string, any> = {};
  for (const [name, agent] of Object.entries(p.agents || {})) {
    const a = agent as Record<string, any>;
    agents[name] = {
      pullStates: (a.pull_states || []) as LinearState[],
      activeState: a.active_state as LinearState,
      primarySkill: a.primary_skill as string,
      interactive: a.interactive ?? false,
      humanGate: a.human_gate ?? false,
    };
  }

  const phases = (p.inception?.phases || []).map((ph: Record<string, any>) => ({
    phase: ph.phase as number,
    name: ph.name as string,
    skill: ph.skill as string,
    agent: ph.agent as AgentRole,
    output: ph.output as string,
  }));

  const triggers = p.triggers || {};
  const iterationZero = triggers.iteration_zero || {};

  const integrations: Record<string, any> = {};
  for (const [name, integ] of Object.entries(p.integrations || {})) {
    const i = integ as Record<string, any>;
    integrations[name] = {
      enabled: i.enabled ?? false,
      skillPath: i.skill_path,
      usedBy: i.used_by,
      mcpServer: i.mcp_server,
      phase: i.phase,
    };
  }

  return {
    active: p.active ?? false,
    maxConcurrentStories: p.max_concurrent_stories ?? 5,
    linear: {
      pollIntervalSeconds: p.linear?.poll_interval_seconds ?? 10,
      projectFilter: p.linear?.project_filter || "",
    },
    agents,
    inception: { phases },
    triggers: {
      newProject: {
        agent: triggers.new_project?.agent,
        skill: triggers.new_project?.skill,
        interactive: triggers.new_project?.interactive ?? false,
      },
      iterationZero: {
        concurrent: (iterationZero.concurrent || []).map((c: Record<string, any>) => ({
          agent: c.agent,
          skill: c.skill,
        })),
        gate: {
          agent: iterationZero.gate?.agent,
          skill: iterationZero.gate?.skill,
        },
      },
      architectureBlocked: {
        agent: triggers.architecture_blocked?.agent,
        skill: triggers.architecture_blocked?.skill,
        interactive: triggers.architecture_blocked?.interactive ?? false,
      },
      securityReview: {
        agent: triggers.security_review?.agent,
        skill: triggers.security_review?.skill,
        interactive: triggers.security_review?.interactive ?? false,
      },
    },
    integrations,
    costTracking: {
      enabled: p.cost_tracking?.enabled ?? true,
      logPath: p.cost_tracking?.log_path ?? ".forge/costs/",
      perSession: p.cost_tracking?.per_session ?? true,
      perIteration: p.cost_tracking?.per_iteration ?? true,
      budgetAlertThresholdUsd: p.cost_tracking?.budget_alert_threshold_usd ?? 2.0,
    },
    loopLogs: {
      enabled: p.loop_logs?.enabled ?? true,
      logPath: p.loop_logs?.log_path ?? "stories/",
      includeGuardianChecks: p.loop_logs?.include_guardian_checks ?? true,
      includeIterationCounts: p.loop_logs?.include_iteration_counts ?? true,
      includeProofResults: p.loop_logs?.include_proof_results ?? true,
    },
  };
}
