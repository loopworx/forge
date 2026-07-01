import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { LinearClient } from "../src/linear-client";
import type { Story } from "../src/types";

const TMP_DIR = join(import.meta.dir, ".tmp-linear-test");

const mockFetch = (response: { status: number; body: unknown }) => {
  return mock(async (input: string | URL | Request, init?: RequestInit) => {
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
      headers: new Headers(),
    } as Response;
  });
};

const mockFetchMulti = (responses: { status: number; body: unknown }[]) => {
  let callIndex = 0;
  return mock(async (input: string | URL | Request, init?: RequestInit) => {
    const response = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
      headers: new Headers(),
    } as Response;
  });
};

describe("LinearClient", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    mock.restore();
  });

  describe("pollStories", () => {
    test("returns stories in ready-for-dev state", async () => {
      const mockResponse = {
        status: 200,
        body: {
          data: {
            issues: {
              nodes: [
                {
                  id: "STORY-001",
                  identifier: "STORY-001",
                  title: "Implement order form",
                  state: { name: "ready-for-dev" },
                  assignee: null,
                  project: { name: "Iteration 1" },
                  labels: { nodes: [{ name: "story-001-order-form" }] },
                  url: "https://linear.app/issue/STORY-001",
                },
              ],
            },
          },
        },
      };

      globalThis.fetch = mockFetch(mockResponse) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const stories = await client.pollStories(["ready-for-dev"]);

      expect(stories).toHaveLength(1);
      expect(stories[0].id).toBe("STORY-001");
      expect(stories[0].title).toBe("Implement order form");
      expect(stories[0].state).toBe("ready-for-dev");
      expect(stories[0].url).toBe("https://linear.app/issue/STORY-001");
    });

    test("returns empty array when no stories in pull states", async () => {
      const mockResponse = {
        status: 200,
        body: {
          data: {
            issues: {
              nodes: [],
            },
          },
        },
      };

      globalThis.fetch = mockFetch(mockResponse) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const stories = await client.pollStories(["ready-for-dev"]);

      expect(stories).toEqual([]);
    });

    test("filters by project when configured", async () => {
      let capturedBody: string | null = null;

      globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { issues: { nodes: [] } } }),
          text: async () => "{}",
          headers: new Headers(),
        } as Response;
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
        projectFilter: "Iteration 1",
      });

      await client.pollStories(["ready-for-dev"]);

      expect(capturedBody).toContain("Iteration 1");
    });

    test("retries on API error with backoff", async () => {
      let callCount = 0;
      globalThis.fetch = mock(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ errors: [{ message: "Server error" }] }),
            text: async () => "{}",
            headers: new Headers(),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { issues: { nodes: [] } } }),
          text: async () => "{}",
          headers: new Headers(),
        } as Response;
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
        maxRetries: 3,
        retryDelayMs: 1,
      });

      const stories = await client.pollStories(["ready-for-dev"]);

      expect(callCount).toBe(3);
      expect(stories).toEqual([]);
    });

    test("throws after max retries", async () => {
      let callCount = 0;
      globalThis.fetch = mock(async () => {
        callCount++;
        return {
          ok: false,
          status: 500,
          json: async () => ({ errors: [{ message: "Server error" }] }),
          text: async () => "{}",
          headers: new Headers(),
        } as Response;
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
        maxRetries: 2,
        retryDelayMs: 1,
      });

      expect(client.pollStories(["ready-for-dev"])).rejects.toThrow();
      expect(callCount).toBe(2);
    });
  });

  describe("getStoryState", () => {
    test("returns current state of a story", async () => {
      const mockResponse = {
        status: 200,
        body: {
          data: {
            issue: {
              id: "STORY-001",
              identifier: "STORY-001",
              state: { name: "in-dev" },
            },
          },
        },
      };

      globalThis.fetch = mockFetch(mockResponse) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const state = await client.getStoryState("STORY-001");

      expect(state).toBe("in-dev");
    });
  });

  describe("getIssueCount", () => {
    test("returns 0 for fresh team", async () => {
      globalThis.fetch = mockFetch({
        status: 200,
        body: { data: { issues: { nodes: [] } } },
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const count = await client.getIssueCount();

      expect(count).toBe(0);
    });

    test("returns count for team with issues", async () => {
      globalThis.fetch = mockFetch({
        status: 200,
        body: { data: { issues: { nodes: [{ id: "1" }, { id: "2" }] } } },
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const count = await client.getIssueCount();

      expect(count).toBe(2);
    });
  });

  describe("getWorkflowStates", () => {
    test("returns existing workflow states", async () => {
      globalThis.fetch = mockFetch({
        status: 200,
        body: {
          data: {
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
          },
        },
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const states = await client.getWorkflowStates();

      expect(states).toHaveLength(2);
      expect(states[0].name).toBe("in-analysis");
      expect(states[1].name).toBe("ready-for-dev");
    });
  });

  describe("getTeamId", () => {
    test("returns team ID", async () => {
      globalThis.fetch = mockFetch({
        status: 200,
        body: {
          data: {
            teams: {
              nodes: [{ id: "team-123", name: "Forge-test", key: "FOR" }],
            },
          },
        },
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "FOR",
        pollIntervalSeconds: 10,
      });

      const teamId = await client.getTeamId();

      expect(teamId).toBe("team-123");
    });
  });

  describe("isFreshTeam", () => {
    test("returns true when team has no issues", async () => {
      globalThis.fetch = mockFetch({
        status: 200,
        body: { data: { issues: { nodes: [] } } },
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const isFresh = await client.isFreshTeam();

      expect(isFresh).toBe(true);
    });

    test("returns false when team has issues", async () => {
      globalThis.fetch = mockFetch({
        status: 200,
        body: { data: { issues: { nodes: [{ id: "1" }] } } },
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const isFresh = await client.isFreshTeam();

      expect(isFresh).toBe(false);
    });
  });

  describe("hasForgeStates", () => {
    test("returns true when Forge states exist", async () => {
      globalThis.fetch = mockFetch({
        status: 200,
        body: {
          data: {
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
          },
        },
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const hasStates = await client.hasForgeStates();

      expect(hasStates).toBe(true);
    });

    test("returns false when no Forge states exist", async () => {
      globalThis.fetch = mockFetch({
        status: 200,
        body: {
          data: {
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
          },
        },
      }) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "loopworx",
        pollIntervalSeconds: 10,
      });

      const hasStates = await client.hasForgeStates();

      expect(hasStates).toBe(false);
    });
  });

  describe("ensureWorkflowStates", () => {
    test("skips states that already exist", async () => {
      const mockResponses = [
        {
          status: 200,
          body: {
            data: {
              teams: { nodes: [{ id: "team-123", name: "Forge", key: "FOR" }] },
            },
          },
        },
        {
          status: 200,
          body: {
            data: {
              teams: {
                nodes: [{
                  states: {
                    nodes: FORGE_STATES.map((name, i) => ({
                      id: `s${i}`, name, type: "unstarted", position: i * 1000,
                    })),
                  },
                }],
              },
            },
          },
        },
      ];

      globalThis.fetch = mockFetchMulti(mockResponses) as typeof fetch;

      const client = new LinearClient({
        apiKey: "test-key",
        teamKey: "FOR",
        pollIntervalSeconds: 10,
      });

      const result = await client.ensureWorkflowStates();

      expect(result.created).toHaveLength(0);
      expect(result.existing.length).toBeGreaterThan(0);
    });
  });
});

const FORGE_STATES = [
  "in-analysis", "ready-for-dev", "in-dev", "in-deskcheck",
  "ready-for-qa", "in-qa", "ready-for-acceptance", "in-acceptance",
  "ready-to-deploy", "done",
  "halted-stall", "halted-ambiguous", "halted-human-gate", "halted-unsafe",
];
