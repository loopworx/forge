import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import type { ForgeConfig, AgentRole, LinearState } from "./types";

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

  if (!config.linear.teamKey) {
    errors.push("linear.team_key is required");
  }
  if (!config.linear.apiKey) {
    errors.push("linear.api_key is required");
  }
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
      teamKey: p.linear?.team_key ?? "",
      projectFilter: p.linear?.project_filter ?? "",
      apiKey: p.linear?.api_key ?? process.env.LINEAR_API_KEY ?? "",
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
