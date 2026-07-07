import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LinearClient } from "../src/linear-client";

const TMP_DIR = join(import.meta.dir, ".tmp-linear-test");
const AUTH_FILE = join(TMP_DIR, "linear-auth.json");
const TEST_TEAM_ID = "87fdc827-cb83-43ae-838b-ed7d978f3dff";

function graphQLResponse(data: unknown) {
  return {
    status: 200,
    body: { data },
  };
}

const mockFetch = (response: { status: number; body: unknown }) => {
  return mock(async (_input: string | URL | Request, _init?: RequestInit) => {
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
      headers: new Headers({ "content-type": "application/json" }),
    } as Response;
  });
};

function createClient(opts?: { projectFilter?: string; maxRetries?: number; retryDelayMs?: number }) {
  const client = new LinearClient({
    ...opts,
    authPath: AUTH_FILE,
  });
  client.teamId = TEST_TEAM_ID;
  client.teamName = "Forge-test";
  return client;
}

function writeAuthFile(token = "test-token", refresh = "test-refresh", expiresIn = 3600) {
  writeFileSync(AUTH_FILE, JSON.stringify({
    accessToken: token,
    refreshToken: refresh,
    expiresAt: Date.now() / 1000 + expiresIn,
  }));
}

describe("LinearClient", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    mock.restore();
  });

  describe("loadAuth", () => {
    test("loads valid token from file", async () => {
      writeAuthFile();
      const client = createClient();
      const auth = await (client as any).loadAuth();
      expect(auth.accessToken).toBe("test-token");
    });

    test("throws when auth file missing", async () => {
      const client = createClient();
      await expect((client as any).loadAuth()).rejects.toThrow();
    });
  });

  describe("pollStories", () => {
    test("returns stories in ready-for-dev state", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        issues: {
          nodes: [
            {
              id: "STORY-001",
              identifier: "STORY-001",
              title: "Implement order form",
              state: { name: "ready-for-dev" },
              assignee: null,
              project: null,
              labels: { nodes: [{ name: "story-001-order-form" }] },
              url: "https://linear.app/issue/STORY-001",
            },
          ],
        },
      })) as typeof fetch;

      const client = createClient();
      const stories = await client.pollStories(["ready-for-dev"]);

      expect(stories).toHaveLength(1);
      expect(stories[0].id).toBe("STORY-001");
      expect(stories[0].title).toBe("Implement order form");
      expect(stories[0].state).toBe("ready-for-dev");
      expect(stories[0].url).toBe("https://linear.app/issue/STORY-001");
      expect(stories[0].featureFlag).toBe("story-001-order-form");
    });

    test("returns empty array when no stories in pull states", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({ issues: { nodes: [] } })) as typeof fetch;

      const client = createClient();
      const stories = await client.pollStories(["ready-for-dev"]);
      expect(stories).toEqual([]);
    });

    test("retries on API error with backoff", async () => {
      writeAuthFile();
      let callCount = 0;
      globalThis.fetch = mock(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            status: 500,
            json: async () => ({}),
            text: async () => "{}",
            headers: new Headers(),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => graphQLResponse({ issues: { nodes: [] } }).body,
          text: async () => "{}",
          headers: new Headers({ "content-type": "application/json" }),
        } as Response;
      }) as typeof fetch;

      const client = createClient({ maxRetries: 3, retryDelayMs: 1 });
      const stories = await client.pollStories(["ready-for-dev"]);

      expect(callCount).toBe(3);
      expect(stories).toEqual([]);
    });
  });

  describe("discoverTeam", () => {
    test("returns team info when exactly 1 team exists", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: { nodes: [{ id: "team-1", name: "My Team", key: "MYTEAM" }] },
      })) as typeof fetch;

      const client = new LinearClient({ authPath: AUTH_FILE });
      const team = await client.discoverTeam();

      expect(team).not.toBeNull();
      expect(team!.id).toBe("team-1");
      expect(team!.name).toBe("My Team");
      expect(client.teamId).toBe("team-1");
      expect(client.teamName).toBe("My Team");
    });

    test("returns null when 0 teams exist", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: { nodes: [] },
      })) as typeof fetch;

      const client = new LinearClient({ authPath: AUTH_FILE });
      const team = await client.discoverTeam();

      expect(team).toBeNull();
      expect(client.teamId).toBeNull();
    });

    test("returns null when multiple teams exist", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: {
          nodes: [
            { id: "team-1", name: "Team A", key: "TEAMA" },
            { id: "team-2", name: "Team B", key: "TEAMB" },
          ],
        },
      })) as typeof fetch;

      const client = new LinearClient({ authPath: AUTH_FILE });
      const team = await client.discoverTeam();

      expect(team).toBeNull();
      expect(client.teamId).toBeNull();
    });
  });

  describe("getWorkflowStates", () => {
    test("returns existing workflow states", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: {
          nodes: [{
            states: {
              nodes: [
                { id: "s1", name: "in-analysis", type: "unstarted", position: 1000 },
                { id: "s2", name: "ready-for-dev", type: "unstarted", position: 2000 },
              ],
            },
          }],
        },
      })) as typeof fetch;

      const client = createClient();
      const states = await client.getWorkflowStates();

      expect(states).toHaveLength(2);
      expect(states[0].name).toBe("in-analysis");
      expect(states[1].name).toBe("ready-for-dev");
    });
  });

  describe("ensureWorkflowStates", () => {
    test("reports existing states when all Forge states exist", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: {
          nodes: [{
            states: {
              nodes: [
                { id: "s1", name: "in-analysis", type: "unstarted", position: 1000 },
                { id: "s2", name: "ready-for-dev", type: "unstarted", position: 2000 },
                { id: "s3", name: "in-dev", type: "started", position: 3000 },
                { id: "s4", name: "in-deskcheck", type: "started", position: 4000 },
                { id: "s5", name: "ready-for-qa", type: "unstarted", position: 5000 },
                { id: "s6", name: "in-qa", type: "started", position: 6000 },
                { id: "s7", name: "ready-for-acceptance", type: "unstarted", position: 7000 },
                { id: "s8", name: "in-acceptance", type: "started", position: 8000 },
                { id: "s9", name: "ready-to-deploy", type: "unstarted", position: 9000 },
                { id: "s10", name: "done", type: "completed", position: 10000 },
                { id: "s11", name: "halted-stall", type: "canceled", position: 11000 },
                { id: "s12", name: "halted-ambiguous", type: "canceled", position: 12000 },
                { id: "s13", name: "halted-human-gate", type: "canceled", position: 13000 },
                { id: "s14", name: "halted-unsafe", type: "canceled", position: 14000 },
              ],
            },
          }],
        },
      })) as typeof fetch;

      const client = createClient();
      const result = await client.ensureWorkflowStates();

      expect(result.created).toHaveLength(0);
      expect(result.existing.length).toBe(14);
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe("getStoryState", () => {
    test("returns current state of a story", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        issue: { id: "STORY-001", identifier: "STORY-001", state: { name: "in-dev" } },
      })) as typeof fetch;

      const client = createClient();
      const state = await client.getStoryState("STORY-001");

      expect(state).toBe("in-dev");
    });
  });

  describe("getIssueCount", () => {
    test("returns 0 for fresh team", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({ issues: { nodes: [] } })) as typeof fetch;

      const client = createClient();
      const count = await client.getIssueCount();

      expect(count).toBe(0);
    });

    test("returns count for team with issues", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        issues: { nodes: [{ id: "1" }, { id: "2" }] },
      })) as typeof fetch;

      const client = createClient();
      const count = await client.getIssueCount();

      expect(count).toBe(2);
    });
  });

  describe("isFreshTeam", () => {
    test("returns true when team has no issues", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({ issues: { nodes: [] } })) as typeof fetch;

      const client = createClient();
      const isFresh = await client.isFreshTeam();

      expect(isFresh).toBe(true);
    });

    test("returns false when team has issues", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({ issues: { nodes: [{ id: "1" }] } })) as typeof fetch;

      const client = createClient();
      const isFresh = await client.isFreshTeam();

      expect(isFresh).toBe(false);
    });
  });

  describe("hasForgeStates", () => {
    test("returns true when Forge states exist", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: {
          nodes: [{
            states: {
              nodes: [
                { id: "s1", name: "in-analysis", type: "unstarted", position: 1000 },
                { id: "s2", name: "ready-for-dev", type: "unstarted", position: 2000 },
              ],
            },
          }],
        },
      })) as typeof fetch;

      const client = createClient();
      const hasStates = await client.hasForgeStates();

      expect(hasStates).toBe(true);
    });

    test("returns false when no Forge states exist", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: {
          nodes: [{
            states: {
              nodes: [
                { id: "s1", name: "Todo", type: "unstarted", position: 0 },
                { id: "s2", name: "Done", type: "completed", position: 3 },
              ],
            },
          }],
        },
      })) as typeof fetch;

      const client = createClient();
      const hasStates = await client.hasForgeStates();

      expect(hasStates).toBe(false);
    });
  });
});

// Simple existence tests for methods (ported from plugin.test.ts)
describe("linear-client > getLastComment", () => {
  test("getLastComment method exists on LinearClient", async () => {
    const { LinearClient } = await import("../src/linear-client");
    const client = new LinearClient({ authPath: AUTH_FILE });
    expect(typeof client.getLastComment).toBe("function");
  });
});

describe("linear-client > getLastCommentWithDate", () => {
  test("getLastCommentWithDate method exists on LinearClient", async () => {
    const { LinearClient } = await import("../src/linear-client");
    const client = new LinearClient({ authPath: AUTH_FILE });
    expect(typeof client.getLastCommentWithDate).toBe("function");
  });
});

describe("linear-client > updateStoryState", () => {
  test("updateStoryState method exists on LinearClient", async () => {
    const { LinearClient } = await import("../src/linear-client");
    const client = new LinearClient({ authPath: AUTH_FILE });
    expect(typeof client.updateStoryState).toBe("function");
  });
});
