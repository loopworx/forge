import { describe, expect, it, beforeEach } from "bun:test";
import type { WorkflowStateResult } from "../../src/engine/types";
import { LinearStoryRepository, LinearClient } from "../../src/linear/linear-story-repository";

class MockLinearClient {
  public stories: any[] = [];
  public state: string = "in-dev";
  public comments: string[] = [];
  teamId = "team-1";
  teamName = "Test";

  async pollStories(_states: string[]) { return this.stories; }
  async updateStoryState(_id: string, state: string) { this.state = state; }
  async getStoryState(_id: string) { return this.state; }
  async postComment(_id: string, body: string) { this.comments.push(body); }
  async getLastComment(_id: string) { return this.comments.length > 0 ? this.comments[this.comments.length - 1] : null; }
  async getLastCommentWithDate(_id: string) {
    return this.comments.length > 0 ? { body: this.comments[this.comments.length - 1], createdAt: new Date().toISOString() } : null;
  }
  async ensureWorkflowStates(): Promise<WorkflowStateResult> { return { created: [], existing: ["done"], skipped: [] }; }
  async discoverTeam() { return { id: "team-1", name: "Test" }; }
  async listTeams() { return [{ id: "team-1", name: "Test" }]; }
}

describe("LinearStoryRepository", () => {
  let mock: MockLinearClient;
  let repo: LinearStoryRepository;

  beforeEach(() => {
    mock = new MockLinearClient();
    repo = new LinearStoryRepository(mock as unknown as LinearClient);
  });

  it("delegates pollStories to LinearClient", async () => {
    mock.stories = [{ id: "FORGE-1", title: "Test", state: "ready-for-dev" }];
    const stories = await repo.pollStories(["ready-for-dev"]);
    expect(stories.length).toBe(1);
  });

  it("delegates updateStoryState to LinearClient", async () => {
    await repo.updateStoryState("FORGE-1", "in-dev");
    expect(mock.state).toBe("in-dev");
  });

  it("delegates getStoryState to LinearClient", async () => {
    const state = await repo.getStoryState("FORGE-1");
    expect(state).toBe("in-dev");
  });

  it("delegates postComment to LinearClient", async () => {
    await repo.postComment("FORGE-1", "test comment");
    expect(mock.comments).toContain("test comment");
  });

  it("delegates getLastComment to LinearClient", async () => {
    mock.comments.push("handoff message");
    const comment = await repo.getLastComment("FORGE-1");
    expect(comment).toBe("handoff message");
  });

  it("delegates ensureWorkflowStates to LinearClient", async () => {
    const result = await repo.ensureWorkflowStates();
    expect(result.existing).toContain("done");
  });

  it("delegates discoverTeam to LinearClient", async () => {
    const team = await repo.discoverTeam();
    expect(team?.name).toBe("Test");
  });

  it("delegates getLastCommentWithDate to LinearClient", async () => {
    mock.comments.push("comment with date");
    const result = await repo.getLastCommentWithDate("FORGE-1");
    expect(result).not.toBeNull();
    expect(result!.body).toBe("comment with date");
    expect(result!.createdAt).toBeDefined();
  });

  it("delegates listTeams to LinearClient", async () => {
    const teams = await repo.listTeams();
    expect(teams.length).toBe(1);
    expect(teams[0].id).toBe("team-1");
  });

  it("getLastCommentWithDate returns null when no comments exist", async () => {
    const result = await repo.getLastCommentWithDate("FORGE-1");
    expect(result).toBeNull();
  });
});

describe("LinearClient", () => {
  it("constructor throws when authPath is empty", () => {
    expect(() => new LinearClient({} as any)).toThrow("authPath");
  });

  it("constructor sets default retry config", () => {
    const client = new LinearClient({ authPath: "/tmp/auth.json" });
    expect((client as any).maxRetries).toBe(3);
    expect((client as any).retryDelayMs).toBe(1000);
  });

  it("discoverTeam returns null when multiple teams exist", async () => {
    const client = new LinearClient({ authPath: "/tmp/auth.json" });
    // Mock listTeams to return multiple teams
    (client as any).listTeams = async () => [
      { id: "team-1", name: "Team A" },
      { id: "team-2", name: "Team B" },
    ];
    const result = await client.discoverTeam();
    expect(result).toBeNull();
  });
});
