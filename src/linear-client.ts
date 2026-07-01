import type { Story, LinearState, WorkflowStateInfo, CommentWithDate } from "./types";

interface LinearClientOptions {
  apiKey: string;
  teamKey: string;
  pollIntervalSeconds?: number;
  projectFilter?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

const LINEAR_API_URL = "https://api.linear.app/graphql";

const FORGE_WORKFLOW_STATES: { name: string; color: string; type: string; position: number }[] = [
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
  private apiKey: string;
  private teamKey: string;
  private projectFilter: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(opts: LinearClientOptions) {
    this.apiKey = opts.apiKey;
    this.teamKey = opts.teamKey;
    this.projectFilter = opts.projectFilter ?? "";
    this.maxRetries = opts.maxRetries ?? 3;
    this.retryDelayMs = opts.retryDelayMs ?? 1000;
  }

  private async graphql(query: string, variables: Record<string, unknown> = {}): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(LINEAR_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": this.apiKey,
          },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`Linear API error ${response.status}: ${JSON.stringify(errorBody)}`);
        }

        return await response.json();
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.maxRetries - 1) {
          await Bun.sleep(this.retryDelayMs);
        }
      }
    }

    throw lastError ?? new Error("Linear API request failed");
  }

  async pollStories(pullStates: LinearState[]): Promise<Story[]> {
    const projectFilter = this.projectFilter
      ? `, project: { name: { eq: "${this.projectFilter}" } }`
      : "";

    const stateFilter = pullStates.map((s) => `{ name: { eq: "${s}" } }`).join(", ");

    const query = `
      query PollStories {
        issues(
          filter: {
            team: { key: { eq: "${this.teamKey}" } }
            state: { or: [${stateFilter}] }
            ${projectFilter}
          }
        ) {
          nodes {
            id
            identifier
            title
            state { name }
            assignee { name }
            project { name }
            labels { nodes { name } }
            url
          }
        }
      }
    `;

    const result = await this.graphql(query);

    return (result.data?.issues?.nodes ?? []).map((node: any): Story => ({
      id: node.identifier ?? node.id,
      title: node.title,
      state: node.state?.name as LinearState,
      assignee: node.assignee?.name ?? null,
      iteration: node.project?.name ?? null,
      featureFlag: node.labels?.nodes?.[0]?.name ?? null,
      url: node.url,
    }));
  }

  async getStoryState(storyId: string): Promise<LinearState> {
    const query = `
      query GetStoryState($id: String!) {
        issue(id: $id) {
          id
          identifier
          state { name }
        }
      }
    `;

    const result = await this.graphql(query, { id: storyId });
    return result.data?.issue?.state?.name as LinearState;
  }

  async getIssueCount(): Promise<number> {
    const query = `
      query GetIssueCount {
        issues(
          filter: {
            team: { key: { eq: "${this.teamKey}" } }
          }
        ) {
          nodes { id }
        }
      }
    `;

    const result = await this.graphql(query);
    return result.data?.issues?.nodes?.length ?? 0;
  }

  async getWorkflowStates(): Promise<WorkflowStateInfo[]> {
    const query = `
      query GetWorkflowStates {
        teams(filter: { key: { eq: "${this.teamKey}" } }) {
          nodes {
            states { nodes { id name type position } }
          }
        }
      }
    `;

    const result = await this.graphql(query);
    return (result.data?.teams?.nodes?.[0]?.states?.nodes ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      position: s.position,
    }));
  }

  async createWorkflowState(
    name: string,
    teamId: string,
    color: string,
    type: string,
    position: number,
  ): Promise<string> {
    const mutation = `
      mutation CreateState($name: String!, $teamId: String!, $color: String!, $type: String!, $position: Float!) {
        workflowStateCreate(input: {
          name: $name
          teamId: $teamId
          color: $color
          type: $type
          position: $position
        }) {
          success
          workflowState { id name }
        }
      }
    `;

    const result = await this.graphql(mutation, { name, teamId, color, type, position });
    return result.data?.workflowStateCreate?.workflowState?.id;
  }

  async getTeamId(): Promise<string> {
    const query = `
      query GetTeamId {
        teams(filter: { key: { eq: "${this.teamKey}" } }) {
          nodes { id name key }
        }
      }
    `;

    const result = await this.graphql(query);
    return result.data?.teams?.nodes?.[0]?.id;
  }

  async ensureWorkflowStates(): Promise<{ created: string[]; existing: string[]; skipped: string[] }> {
    const teamId = await this.getTeamId();
    if (!teamId) {
      throw new Error(`Team with key "${this.teamKey}" not found`);
    }

    const existingStates = await this.getWorkflowStates();
    const existingNames = new Set(existingStates.map((s) => s.name));

    const created: string[] = [];
    const existing: string[] = [];
    const skipped: string[] = [];

    for (const state of FORGE_WORKFLOW_STATES) {
      if (existingNames.has(state.name)) {
        existing.push(state.name);
        continue;
      }

      try {
        await this.createWorkflowState(
          state.name,
          teamId,
          state.color,
          state.type,
          state.position,
        );
        created.push(state.name);
      } catch (err) {
        skipped.push(`${state.name}: ${(err as Error).message}`);
      }
    }

    return { created, existing, skipped };
  }

  async isFreshTeam(): Promise<boolean> {
    const issueCount = await this.getIssueCount();
    return issueCount === 0;
  }

  async hasForgeStates(): Promise<boolean> {
    const states = await this.getWorkflowStates();
    const forgeStateNames = FORGE_WORKFLOW_STATES.map((s) => s.name);
    return forgeStateNames.some((name) => states.some((s) => s.name === name));
  }

  async getLastComment(storyId: string): Promise<string | null> {
    const query = `
      query GetLastComment($id: String!) {
        issue(id: $id) {
          comments(first: 1, orderBy: createdAt) {
            nodes {
              body
              user { name }
              createdAt
            }
          }
        }
      }
    `;

    const result = await this.graphql(query, { id: storyId });
    const nodes = result.data?.issue?.comments?.nodes ?? [];
    if (nodes.length === 0) return null;
    return nodes[0]?.body ?? null;
  }

  async getLastCommentWithDate(storyId: string): Promise<CommentWithDate | null> {
    const query = `
      query GetLastCommentWithDate($id: String!) {
        issue(id: $id) {
          comments(first: 1, orderBy: createdAt) {
            nodes {
              body
              createdAt
            }
          }
        }
      }
    `;

    const result = await this.graphql(query, { id: storyId });
    const nodes = result.data?.issue?.comments?.nodes ?? [];
    if (nodes.length === 0) return null;
    const node = nodes[0];
    if (!node?.body) return null;
    return { body: node.body, createdAt: node.createdAt };
  }

  async updateStoryState(storyId: string, stateName: string): Promise<void> {
    const stateQuery = `
      query GetStateId($teamKey: String!, $stateName: String!) {
        teams(filter: { key: { eq: $teamKey } }) {
          nodes {
            states(filter: { name: { eq: $stateName } }) {
              nodes { id name }
            }
          }
        }
      }
    `;

    const stateResult = await this.graphql(stateQuery, {
      teamKey: this.teamKey,
      stateName,
    });

    const stateId = stateResult.data?.teams?.nodes?.[0]?.states?.nodes?.[0]?.id;
    if (!stateId) {
      throw new Error(`Workflow state "${stateName}" not found in team ${this.teamKey}`);
    }

    const mutation = `
      mutation UpdateIssueState($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) {
          success
          issue { id state { name } }
        }
      }
    `;

    await this.graphql(mutation, { id: storyId, stateId });
  }

  async postComment(storyId: string, body: string): Promise<void> {
    const mutation = `
      mutation CreateComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment { id }
        }
      }
    `;

    await this.graphql(mutation, { issueId: storyId, body });
  }
}
