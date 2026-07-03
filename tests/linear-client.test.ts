import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { McpClient } from "../src/mcp-client";

const TMP_DIR = join(import.meta.dir, ".tmp-linear-test");

function mcpResponse(innerData: unknown) {
  return {
    status: 200,
    body: {
      result: {
        content: [{ type: "text", text: JSON.stringify(innerData) }],
      },
      jsonrpc: "2.0",
      id: 1,
    },
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

describe("McpClient", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    mock.restore();
  });

  describe("pollStories", () => {
    test("returns stories in ready-for-dev state", async () => {
      globalThis.fetch = mockFetch(mcpResponse({
        issues: [
          {
            id: "STORY-001",
            title: "Implement order form",
            status: "ready-for-dev",
            assignee: null,
            labels: [{ name: "story-001-order-form" }],
            url: "https://linear.app/issue/STORY-001",
          },
        ],
      })) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const stories = await client.pollStories(["ready-for-dev"]);

      expect(stories).toHaveLength(1);
      expect(stories[0].id).toBe("STORY-001");
      expect(stories[0].title).toBe("Implement order form");
      expect(stories[0].state).toBe("ready-for-dev");
      expect(stories[0].url).toBe("https://linear.app/issue/STORY-001");
      expect(stories[0].featureFlag).toBe("story-001-order-form");
    });

    test("returns empty array when no stories in pull states", async () => {
      globalThis.fetch = mockFetch(mcpResponse({ issues: [] })) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
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
          json: async () => mcpResponse({ issues: [] }).body,
          text: async () => "{}",
          headers: new Headers({ "content-type": "application/json" }),
        } as Response;
      }) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx", projectFilter: "Iteration 1" });
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
            json: async () => ({}),
            text: async () => "{}",
            headers: new Headers(),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => mcpResponse({ issues: [] }).body,
          text: async () => "{}",
          headers: new Headers({ "content-type": "application/json" }),
        } as Response;
      }) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx", maxRetries: 3, retryDelayMs: 1 });
      const stories = await client.pollStories(["ready-for-dev"]);

      expect(callCount).toBe(3);
      expect(stories).toEqual([]);
    });

    test("returns empty after max retries (resilient per-state)", async () => {
      let callCount = 0;
      globalThis.fetch = mock(async () => {
        callCount++;
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
          text: async () => "{}",
          headers: new Headers(),
        } as Response;
      }) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx", maxRetries: 2, retryDelayMs: 1 });
      const stories = await client.pollStories(["ready-for-dev"]);

      expect(callCount).toBe(2);
      expect(stories).toEqual([]);
    });
  });

  describe("getStoryState", () => {
    test("returns current state of a story", async () => {
      globalThis.fetch = mockFetch(mcpResponse({
        id: "STORY-001",
        status: "in-dev",
        title: "test",
      })) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const state = await client.getStoryState("STORY-001");

      expect(state).toBe("in-dev");
    });
  });

  describe("getIssueCount", () => {
    test("returns 0 for fresh team", async () => {
      globalThis.fetch = mockFetch(mcpResponse({ issues: [] })) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const count = await client.getIssueCount();

      expect(count).toBe(0);
    });

    test("returns count for team with issues", async () => {
      globalThis.fetch = mockFetch(mcpResponse({
        issues: [{ id: "1" }, { id: "2" }],
      })) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const count = await client.getIssueCount();

      expect(count).toBe(2);
    });
  });

  describe("getWorkflowStates", () => {
    test("returns existing workflow states", async () => {
      globalThis.fetch = mockFetch(mcpResponse([
        { id: "s1", name: "in-analysis", type: "unstarted", position: 1000 },
        { id: "s2", name: "ready-for-dev", type: "unstarted", position: 2000 },
      ])) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const states = await client.getWorkflowStates();

      expect(states).toHaveLength(2);
      expect(states[0].name).toBe("in-analysis");
      expect(states[1].name).toBe("ready-for-dev");
    });
  });

  describe("getTeamId", () => {
    test("returns team ID", async () => {
      globalThis.fetch = mockFetch(mcpResponse({
        id: "team-123",
        name: "Forge-test",
        key: "FOR",
      })) as typeof fetch;

      const client = new McpClient({ teamKey: "FOR" });
      const teamId = await client.getTeamId();

      expect(teamId).toBe("team-123");
    });
  });

  describe("isFreshTeam", () => {
    test("returns true when team has no issues", async () => {
      globalThis.fetch = mockFetch(mcpResponse({ issues: [] })) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const isFresh = await client.isFreshTeam();

      expect(isFresh).toBe(true);
    });

    test("returns false when team has issues", async () => {
      globalThis.fetch = mockFetch(mcpResponse({ issues: [{ id: "1" }] })) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const isFresh = await client.isFreshTeam();

      expect(isFresh).toBe(false);
    });
  });

  describe("hasForgeStates", () => {
    test("returns true when Forge states exist", async () => {
      globalThis.fetch = mockFetch(mcpResponse([
        { id: "s1", name: "in-analysis", type: "unstarted", position: 1000 },
        { id: "s2", name: "ready-for-dev", type: "unstarted", position: 2000 },
      ])) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const hasStates = await client.hasForgeStates();

      expect(hasStates).toBe(true);
    });

    test("returns false when no Forge states exist", async () => {
      globalThis.fetch = mockFetch(mcpResponse([
        { id: "s1", name: "Todo", type: "unstarted", position: 0 },
        { id: "s2", name: "Done", type: "completed", position: 3 },
      ])) as typeof fetch;

      const client = new McpClient({ teamKey: "loopworx" });
      const hasStates = await client.hasForgeStates();

      expect(hasStates).toBe(false);
    });
  });

  describe("ensureWorkflowStates", () => {
    test("reports existing states (no creation via MCP)", async () => {
      globalThis.fetch = mockFetch(mcpResponse([
        { id: "s1", name: "in-analysis", type: "unstarted", position: 1000 },
        { id: "s2", name: "ready-for-dev", type: "unstarted", position: 2000 },
      ])) as typeof fetch;

      const client = new McpClient({ teamKey: "FOR" });
      const result = await client.ensureWorkflowStates();

      expect(result.created).toHaveLength(0);
      expect(result.skipped.length).toBeGreaterThan(0);
      expect(result.existing).toContain("in-analysis");
      expect(result.existing).toContain("ready-for-dev");
    });
  });
});
