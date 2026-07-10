import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import type { Story, WorkflowState, CommentWithDate, WorkflowStateResult } from "../engine/types";
import type { StoryRepository } from "../engine/interfaces";
import type { TeamInfo } from "../engine/types";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const TOKEN_URL = "https://api.linear.app/oauth/token";
const FORGE_CLIENT_ID = "383e63c709107d75f0468505bc68eb20";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface WorkflowStateInfo {
  id: string;
  name: string;
  type: string;
  position: number;
}

interface LinearClientOptions {
  authPath?: string;
  projectFilter?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

const FORGE_WORKFLOW_STATES = [
  { name: "in-analysis", color: "#c4b5fd", type: "unstarted", position: 1000 },
  { name: "ready-for-dev", color: "#93c5fd", type: "unstarted", position: 2000 },
  { name: "in-dev", color: "#fbbf24", type: "started", position: 3000 },
  { name: "in-deskcheck", color: "#fbbf24", type: "started", position: 4000 },
  { name: "ready-for-qa", color: "#93c5fd", type: "unstarted", position: 5000 },
  { name: "in-qa", color: "#fbbf24", type: "started", position: 6000 },
  { name: "ready-for-acceptance", color: "#93c5fd", type: "unstarted", position: 7000 },
  { name: "in-acceptance", color: "#fbbf24", type: "started", position: 8000 },
  { name: "ready-to-deploy", color: "#93c5fd", type: "unstarted", position: 9000 },
  { name: "done", color: "#86efac", type: "completed", position: 10000 },
  { name: "halted-stall", color: "#fca5a5", type: "canceled", position: 11000 },
  { name: "halted-ambiguous", color: "#fca5a5", type: "canceled", position: 12000 },
  { name: "halted-human-gate", color: "#fca5a5", type: "canceled", position: 13000 },
  { name: "halted-unsafe", color: "#fca5a5", type: "canceled", position: 14000 },
];

export class LinearClient {
  teamId: string | null = null;
  teamName: string | null = null;
  private authPath: string;
  private projectFilter: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private auth: AuthTokens | null = null;

  constructor(opts: LinearClientOptions) {
    if (!opts.authPath) throw new Error("LinearClient requires authPath");
    this.authPath = opts.authPath;
    this.projectFilter = opts.projectFilter ?? "";
    this.maxRetries = opts.maxRetries ?? 3;
    this.retryDelayMs = opts.retryDelayMs ?? 1000;
  }

  private ensureTeam(): void {
    if (!this.teamId) throw new Error("Team not discovered. Call discoverTeam() first.");
  }

  async discoverTeam(): Promise<TeamInfo | null> {
    const teams = await this.listTeams();
    if (teams.length === 0) return null;
    if (teams.length === 1) {
      this.teamId = teams[0].id;
      this.teamName = teams[0].name;
      return teams[0];
    }
    return null;
  }

  async listTeams(): Promise<TeamInfo[]> {
    const query = `query ListTeams { teams { nodes { id name } } }`;
    const result = await this.graphql(query);
    const nodes = result?.data?.teams?.nodes ?? [];
    return nodes.map((t: any) => ({ id: t.id, name: t.name }));
  }

  private async loadAuth(): Promise<AuthTokens> {
    if (this.auth && Date.now() / 1000 < this.auth.expiresAt - 60) return this.auth;

    try {
      const raw = readFileSync(this.authPath, "utf-8");
      const data = JSON.parse(raw);
      if (!data?.accessToken) throw new Error("Linear auth not found. Run: forge init");
      this.auth = { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: data.expiresAt };
    } catch {
      throw new Error("Linear auth not found. Run: forge init");
    }

    if (Date.now() / 1000 >= (this.auth?.expiresAt ?? 0) - 60) {
      await this.refreshToken();
    }
    return this.auth!;
  }

  private async refreshToken(): Promise<void> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.auth!.refreshToken,
      client_id: FORGE_CLIENT_ID,
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      this.auth = null;
      throw new Error("Token refresh failed. Re-run: forge init");
    }

    const data = await response.json();
    this.auth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.auth!.refreshToken,
      expiresAt: Date.now() / 1000 + (data.expires_in ?? 3600),
    };

    try {
      const dir = this.authPath.substring(0, this.authPath.lastIndexOf("/")) || ".";
      mkdirSync(dir, { recursive: true });
      writeFileSync(this.authPath, JSON.stringify(this.auth, null, 2));
    } catch {}
  }

  async graphql(query: string, variables: Record<string, unknown> = {}): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const auth = await this.loadAuth();
        const response = await fetch(LINEAR_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`Linear API error ${response.status}: ${JSON.stringify(errorBody)}`);
        }

        const result = await response.json();
        if (result.errors) throw new Error(result.errors[0]?.message ?? "GraphQL error");
        return result;
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.maxRetries - 1) await Bun.sleep(this.retryDelayMs);
      }
    }

    throw lastError ?? new Error("Linear API request failed");
  }

  async pollStories(states: string[]): Promise<Story[]> {
    this.ensureTeam();
    const stateFilter = states.map((s) => `{ name: { eq: "${s}" } }`).join(", ");
    const projectFilter = this.projectFilter ? `project: { name: { eq: "${this.projectFilter}" } }` : "";
    const query = `query PollStories {
      issues(filter: { team: { id: { eq: "${this.teamId}" } } state: { or: [${stateFilter}] } ${projectFilter}}) {
        nodes { id identifier title state { name } assignee { name } project { name } labels { nodes { name } } url }
      }
    }`;
    const result = await this.graphql(query);
    return (result?.data?.issues?.nodes ?? []).map((n: any) => ({
      id: n.identifier ?? n.id,
      title: n.title ?? "",
      state: n.state?.name ?? "in-analysis",
      assignee: n.assignee?.name ?? null,
      iteration: n.project?.name ?? null,
      featureFlag: n.labels?.nodes?.[0]?.name ?? null,
      url: n.url ?? "",
    }));
  }

  async getStoryState(storyId: string): Promise<WorkflowState> {
    const query = `query GetStoryState($id: String!) { issue(id: $id) { state { name } } }`;
    const result = await this.graphql(query, { id: storyId });
    return (result?.data?.issue?.state?.name ?? "done") as WorkflowState;
  }

  async updateStoryState(storyId: string, stateName: string): Promise<void> {
    const states = await this.getWorkflowStates();
    const target = states.find((s) => s.name === stateName);
    if (!target) throw new Error(`Workflow state "${stateName}" not found in team ${this.teamName}`);

    const mutation = `mutation($id: String!, $stateId: String!) { issueUpdate(id: $id, input: { stateId: $stateId }) { issue { id } } }`;
    await this.graphql(mutation, { id: storyId, stateId: target.id });
  }

  async postComment(storyId: string, body: string): Promise<void> {
    const mutation = `mutation($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { comment { id } } }`;
    await this.graphql(mutation, { issueId: storyId, body });
  }

  async getLastComment(storyId: string): Promise<string | null> {
    const query = `query($id: String!) { issue(id: $id) { comments(first: 1, orderBy: createdAt) { nodes { body } } } }`;
    const result = await this.graphql(query, { id: storyId });
    return result?.data?.issue?.comments?.nodes?.[0]?.body ?? null;
  }

  async getLastCommentWithDate(storyId: string): Promise<CommentWithDate | null> {
    const query = `query($id: String!) { issue(id: $id) { comments(first: 1, orderBy: createdAt) { nodes { body createdAt } } } }`;
    const result = await this.graphql(query, { id: storyId });
    const node = result?.data?.issue?.comments?.nodes?.[0];
    if (!node?.body) return null;
    return { body: node.body, createdAt: node.createdAt };
  }

  async getWorkflowStates(): Promise<WorkflowStateInfo[]> {
    this.ensureTeam();
    const query = `query GetWorkflowStates { teams(filter: { id: { eq: "${this.teamId}" } }) { nodes { states { nodes { id name type position } } } } }`;
    const result = await this.graphql(query);
    return (result?.data?.teams?.nodes?.[0]?.states?.nodes ?? []).map((s: any) => ({
      id: s.id, name: s.name, type: s.type, position: s.position,
    }));
  }

  async createWorkflowState(name: string, _teamId: string, color: string, type: string, position: number): Promise<string> {
    const mutation = `mutation($input: WorkflowStateCreateInput!) { workflowStateCreate(input: $input) { workflowState { id } } }`;
    const result = await this.graphql(mutation, { input: { name, teamId: this.teamId, color, type, position } });
    return result?.data?.workflowStateCreate?.workflowState?.id;
  }

  async ensureWorkflowStates(): Promise<WorkflowStateResult> {
    this.ensureTeam();
    const existing = await this.getWorkflowStates();
    const existingNames = new Set(existing.map((s) => s.name));
    const created: string[] = [];
    const alreadyExisting: string[] = [];

    for (const st of FORGE_WORKFLOW_STATES) {
      if (existingNames.has(st.name)) { alreadyExisting.push(st.name); continue; }
      try {
        await this.createWorkflowState(st.name, this.teamId!, st.color, st.type, st.position);
        created.push(st.name);
      } catch (e) {
        return { created, existing: alreadyExisting, skipped: [(e as Error).message] };
      }
    }
    return { created, existing: alreadyExisting, skipped: [] };
  }
}

export class LinearStoryRepository implements StoryRepository {
  constructor(private client: LinearClient) {}

  async pollStories(pullStates: WorkflowState[]) { return this.client.pollStories(pullStates); }
  async updateStoryState(storyId: string, state: WorkflowState) { await this.client.updateStoryState(storyId, state); }
  async getStoryState(storyId: string) { return this.client.getStoryState(storyId); }
  async postComment(storyId: string, body: string) { await this.client.postComment(storyId, body); }
  async getLastComment(storyId: string) { return this.client.getLastComment(storyId); }
  async getLastCommentWithDate(storyId: string) { return this.client.getLastCommentWithDate(storyId); }
  async ensureWorkflowStates(): Promise<WorkflowStateResult> { return this.client.ensureWorkflowStates(); }
  async discoverTeam() { return this.client.discoverTeam(); }
  async listTeams() { return this.client.listTeams(); }
}
