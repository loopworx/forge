import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LinearClient } from "../../src/linear/linear-story-repository";

const TMP_DIR = join(import.meta.dir ?? ".", ".tmp-linear-test");
const AUTH_FILE = join(TMP_DIR, "linear-auth.json");
const TEST_TEAM_ID = "87fdc827-cb83-43ae-838b-ed7d978f3dff";

function graphQLResponse(data: unknown) {
  return { status: 200, body: { data } };
}

const mockFetch = (response: { status: number; body: unknown }) => {
  return mock(async () => ({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: async () => response.body,
    text: async () => JSON.stringify(response.body),
    headers: new Headers({ "content-type": "application/json" }),
  } as Response));
};

function createClient(): LinearClient {
  const client = new LinearClient({ authPath: AUTH_FILE });
  client.teamId = TEST_TEAM_ID;
  client.teamName = "Forge-test";
  return client;
}

function writeAuthFile(token = "test-token", refresh = "test-refresh", expiresIn = 3600) {
  mkdirSync(TMP_DIR, { recursive: true });
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

  describe("discoverTeam", () => {
    test("returns team info when exactly 1 team exists", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: { nodes: [{ id: "team-1", name: "My Team" }] },
      })) as unknown as typeof fetch;

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
      globalThis.fetch = mockFetch(graphQLResponse({ teams: { nodes: [] } })) as unknown as typeof fetch;

      const client = new LinearClient({ authPath: AUTH_FILE });
      const team = await client.discoverTeam();

      expect(team).toBeNull();
      expect(client.teamId).toBeNull();
    });

    test("returns null when multiple teams exist", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        teams: { nodes: [{ id: "t1", name: "A" }, { id: "t2", name: "B" }] },
      })) as unknown as typeof fetch;

      const client = new LinearClient({ authPath: AUTH_FILE });
      const team = await client.discoverTeam();

      expect(team).toBeNull();
    });
  });

  describe("pollStories", () => {
    test("returns stories in pull state", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({
        issues: { nodes: [{
          id: "S-1", identifier: "S-1", title: "Test", state: { name: "ready-for-dev" },
          assignee: null, project: null, labels: { nodes: [] }, url: "https://lin.ear/S-1",
        }] },
      })) as unknown as typeof fetch;

      const client = createClient();
      const stories = await client.pollStories(["ready-for-dev"]);

      expect(stories).toHaveLength(1);
      expect(stories[0].id).toBe("S-1");
    });

    test("returns empty array when no stories", async () => {
      writeAuthFile();
      globalThis.fetch = mockFetch(graphQLResponse({ issues: { nodes: [] } })) as unknown as typeof fetch;

      const client = createClient();
      const stories = await client.pollStories(["ready-for-dev"]);
      expect(stories).toEqual([]);
    });

    test("retries on API error", async () => {
      writeAuthFile();
      let calls = 0;
      globalThis.fetch = mock(async () => {
        calls++;
        if (calls < 3) return { ok: false, status: 500, json: async () => ({}), text: async () => "{}", headers: new Headers() } as Response;
        return { ok: true, status: 200, json: async () => graphQLResponse({ issues: { nodes: [] } }).body, text: async () => "{}", headers: new Headers({ "content-type": "application/json" }) } as Response;
      }) as unknown as typeof fetch;

      const client = new LinearClient({ authPath: AUTH_FILE, maxRetries: 3, retryDelayMs: 1 });
      client.teamId = TEST_TEAM_ID;
      client.teamName = "Forge-test";
      await client.pollStories(["ready-for-dev"]);

      expect(calls).toBe(3);
    });
  });
});
