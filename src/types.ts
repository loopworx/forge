export type LinearState =
  | "in-analysis"
  | "ready-for-dev"
  | "in-dev"
  | "in-deskcheck"
  | "ready-for-qa"
  | "in-qa"
  | "ready-for-acceptance"
  | "in-acceptance"
  | "ready-to-deploy"
  | "done"
  | "halted-stall"
  | "halted-ambiguous"
  | "halted-human-gate"
  | "halted-unsafe";

export type AgentRole =
  | "po-agent"
  | "ux-agent"
  | "architect-agent"
  | "developer-agent"
  | "qa-agent"
  | "devops-agent"
  | "secops-agent";

export type SkillLevel = "L1-RIGID" | "L2-GUIDED" | "L3-MECH";

export type SessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "crashed"
  | "aborted"
  | "timed_out";

export interface Story {
  id: string;
  title: string;
  state: LinearState;
  assignee: string | null;
  iteration: string | null;
  featureFlag: string | null;
  url: string;
}

export interface AgentConfig {
  name: AgentRole;
  pullStates: LinearState[];
  activeState: LinearState;
  primarySkill: string;
  interactive: boolean;
  humanGate: boolean;
}

export interface InceptionPhase {
  phase: number;
  name: string;
  skill: string;
  agent: AgentRole;
  output: string;
}

export interface IntegrationConfig {
  enabled: boolean;
  skillPath?: string;
  usedBy?: AgentRole[];
  mcpServer?: boolean;
  phase?: number;
}

export interface ForgeConfig {
  active: boolean;
  maxConcurrentStories: number;
  linear: {
    pollIntervalSeconds: number;
    teamKey: string;
    projectFilter: string;
  };
  agents: Record<AgentRole, AgentConfig>;
  inception: {
    phases: InceptionPhase[];
  };
  triggers: {
    newProject: { agent: AgentRole; skill: string; interactive: boolean };
    iterationZero: {
      concurrent: { agent: AgentRole; skill: string }[];
      gate: { agent: AgentRole; skill: string };
    };
    architectureBlocked: { agent: AgentRole; skill: string; interactive: boolean };
    securityReview: { agent: AgentRole; skill: string; interactive: boolean };
  };
  integrations: Record<string, IntegrationConfig>;
  costTracking: {
    enabled: boolean;
    logPath: string;
    perSession: boolean;
    perIteration: boolean;
    budgetAlertThresholdUsd: number;
  };
  loopLogs: {
    enabled: boolean;
    logPath: string;
    includeGuardianChecks: boolean;
    includeIterationCounts: boolean;
    includeProofResults: boolean;
  };
}

export interface WorkflowStateInfo {
  id: string;
  name: string;
  type: string;
  position: number;
}

export interface FailureContext {
  reason: string;
  previousState: LinearState;
}

export interface ForgeSessionInfo {
  sessionId: string;
  storyId: string;
  agentName: AgentRole;
  linearState: LinearState;
  isRecovery: boolean;
  isDev: boolean;
  sessionStartTime: number;
}

export interface CommentWithDate {
  body: string;
  createdAt: string;
}

export type ForgeProjectMode = "inception" | "development";

export interface InceptionState {
  mode: ForgeProjectMode;
  currentPhase: number;
  phaseSessionId: string | null;
}

export interface ProjectState {
  mode: ForgeProjectMode;
  inception: InceptionState;
}
