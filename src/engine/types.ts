export type WorkflowState =
  | "in-analysis" | "ready-for-dev" | "in-deskcheck"
  | "ready-for-qa" | "ready-for-acceptance" | "ready-to-deploy"
  | "in-dev" | "in-qa" | "in-acceptance"
  | "done"
  | "halted-stall" | "halted-ambiguous" | "halted-human-gate" | "halted-unsafe";

export type AgentRole =
  | "po-agent" | "ux-agent" | "architect-agent"
  | "developer-agent" | "qa-agent" | "devops-agent" | "secops-agent";

export type SkillLevel = "L1-RIGID" | "L2-GUIDED" | "L3-MECH";

export interface Story {
  id: string;
  title: string;
  state: WorkflowState;
  assignee: string | null;
  iteration: string | null;
  featureFlag: string | null;
  url: string;
}

export interface AgentConfig {
  name: AgentRole;
  pullStates: WorkflowState[];
  activeState: WorkflowState;
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

export interface ForgeConfig {
  active: boolean;
  maxConcurrentStories: number;
  linear: {
    pollIntervalSeconds: number;
    teamId: string;
    teamName: string;
  };
  agents: Record<AgentRole, AgentConfig>;
  inception: {
    phases: InceptionPhase[];
  };
  dashboard: {
    sidebarWidth: number;
  };
}

export interface AgentSessionMeta {
  sessionId: string;
  storyId: string;
  agentRole: AgentRole;
  workflowState: WorkflowState;
  sessionStartTime: number;
  isRecovery: boolean;
}

export interface ProjectState {
  mode: "inception" | "development";
  inception: {
    mode: "inception" | "development";
    currentPhase: number;
    phaseSessionId: string | null;
    artifacts: Record<number, string>; // phase -> document ID
  };
}

export interface CommentWithDate {
  body: string;
  createdAt: string;
}

export interface TeamInfo {
  id: string;
  name: string;
}

export interface WorkflowStateResult {
  created: string[];
  existing: string[];
  skipped: string[];
}

export interface Artifact {
  id: string;
  title: string;
  content: string;
}

export interface SessionConfig {
  cwd: string;
  model?: unknown;
  tools: string[];
  agentRole: AgentRole;
  storyId?: string;
}

export interface SessionInfo {
  sessionId: string;
  storyId: string;
  agentRole: AgentRole;
  isBusy: boolean;
  elapsedTime: number;
}

export interface Transition {
  timestamp: string;
  storyId: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  agentRole: AgentRole;
  reason: string;
}

export interface ClaimRequest {
  storyId: string;
  agentRole: AgentRole;
}

export interface HandoffParams {
  targetState: WorkflowState;
  accomplishments: string;
  remaining: string;
  testLocations: string;
  blockers?: string;
}

export interface PromptParams {
  story: Story;
  agentRole: AgentRole;
  linearState: WorkflowState;
  primarySkill: string;
  workdir: string;
  budgetUsd?: number;
  handoffComment?: string | null;
  failureContext?: { reason: string; previousState: WorkflowState } | null;
}

export interface LoopPromptParams {
  story: Story;
  agentName: AgentRole;
  linearState: WorkflowState;
  workdir: string;
}

export interface InceptionPromptParams {
  phase: InceptionPhase;
  workdir: string;
}

export interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
