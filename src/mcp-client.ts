import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Story, LinearState, WorkflowStateInfo, CommentWithDate } from "./types";

const MCP_URL = "https://mcp.linear.app/mcp";
const TOKEN_URL = "https://mcp.linear.app/token";
const AUTH_FILE = join(homedir(), ".local", "share", "opencode", "mcp-auth.json");

interface McpClientOptions {
  teamKey: string;
  projectFilter?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
}

export class McpClient {
  private teamKey: string;
  private projectFilter: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private auth: AuthTokens | null = null;
  private requestId = 0;

  constructor(opts: McpClientOptions) {
    this.teamKey = opts.teamKey;
    this.projectFilter = opts.projectFilter ?? "";
    this.maxRetries = opts.maxRetries ?? 3;
    this.retryDelayMs = opts.retryDelayMs ?? 1000;
  }

  private async loadAuth(): Promise<AuthTokens> {
    if (this.auth && Date.now() / 1000 < this.auth.expiresAt - 60) {
      return this.auth;
    }

    try {
      const raw = readFileSync(AUTH_FILE, "utf-8");
      const data = JSON.parse(raw);
      const entry = data["linear"];
      if (!entry?.tokens?.accessToken) {
        throw new Error("Linear MCP auth not found. Run: opencode mcp auth linear");
      }

      this.auth = {
        accessToken: entry.tokens.accessToken,
        refreshToken: entry.tokens.refreshToken,
        expiresAt: entry.tokens.expiresAt,
        clientId: entry.clientInfo?.clientId ?? "",
      };
    } catch {
      throw new Error("Linear MCP auth not found. Run: opencode mcp auth linear");
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
      client_id: this.auth!.clientId,
      resource: MCP_URL,
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      this.auth = null;
      throw new Error("Token refresh failed. Re-run: opencode mcp auth linear");
    }

    const data = await response.json();
    this.auth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.auth!.refreshToken,
      expiresAt: Date.now() / 1000 + (data.expires_in ?? 3600),
      clientId: this.auth!.clientId,
    };

    try {
      const raw = readFileSync(AUTH_FILE, "utf-8");
      const stored = JSON.parse(raw);
      stored["linear"].tokens.accessToken = this.auth.accessToken;
      stored["linear"].tokens.refreshToken = this.auth.refreshToken;
      stored["linear"].tokens.expiresAt = this.auth.expiresAt;
      writeFileSync(AUTH_FILE, JSON.stringify(stored, null, 2));
    } catch {
      // best-effort write back to disk
    }
  }

  private async callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const auth = await this.loadAuth();
        const id = ++this.requestId;

        const response = await fetch(MCP_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${auth.accessToken}`,
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-11-25",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            method: "tools/call",
            params: { name, arguments: args },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          throw new Error(`MCP call error ${response.status}: ${errorBody}`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        let data: any;

        if (contentType.includes("text/event-stream")) {
          const text = await response.text();
          for (const line of text.split("\n")) {
            if (line.startsWith("data: ")) {
              data = JSON.parse(line.slice(6));
              break;
            }
          }
        } else {
          data = await response.json();
        }

        if (data?.error) {
          throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
        }

        const rawText = data?.result?.content?.[0]?.text;
        if (rawText !== undefined) {
          return JSON.parse(rawText);
        }

        return data?.result ?? data;
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.maxRetries - 1) {
          await Bun.sleep(this.retryDelayMs);
        }
      }
    }

    throw lastError ?? new Error("MCP call failed");
  }

  async pollStories(pullStates: LinearState[]): Promise<Story[]> {
    const allStories: Story[] = [];
    const seen = new Set<string>();

    for (const state of pullStates) {
      try {
        const args: Record<string, unknown> = {
          team: this.teamKey,
          state,
          limit: 50,
        };
        if (this.projectFilter) {
          args.project = this.projectFilter;
        }

        const result = await this.callTool("list_issues", args);
        const issues = result?.issues ?? [];

        for (const node of issues) {
          if (seen.has(node.id)) continue;
          seen.add(node.id);

          allStories.push({
            id: node.id,
            title: node.title,
            state: node.status as LinearState,
            assignee: node.assignee?.name ?? null,
            iteration: node.project?.name ?? null,
            featureFlag: node.labels?.[0]?.name ?? null,
            url: node.url,
          });
        }
      } catch {
        // skip this state on error, try the rest
      }
    }

    return allStories;
  }

  async getStoryState(storyId: string): Promise<LinearState> {
    const result = await this.callTool("get_issue", { id: storyId });
    return result?.status as LinearState;
  }

  async getIssueCount(): Promise<number> {
    const result = await this.callTool("list_issues", {
      team: this.teamKey,
      limit: 1,
    });
    return result?.issues?.length ?? 0;
  }

  async getWorkflowStates(): Promise<WorkflowStateInfo[]> {
    const result = await this.callTool("list_issue_statuses", {
      team: this.teamKey,
    });

    const states = Array.isArray(result) ? result : (result?.states ?? []);
    return states.map((s: any) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      position: s.position,
    }));
  }

  async getTeamId(): Promise<string> {
    const result = await this.callTool("get_team", { query: this.teamKey });
    return result?.id ?? "";
  }

  async ensureWorkflowStates(): Promise<{ created: string[]; existing: string[]; skipped: string[] }> {
    // The Linear MCP does not expose a "create workflow state" tool.
    // Workflow states must be created manually in Linear before using Forge.
    // We check which Forge states are present and which are missing.
    const existingStates = await this.getWorkflowStates();
    const existingNames = new Set(existingStates.map((s) => s.name));

    const FORGE_STATES = [
      "in-analysis", "ready-for-dev", "in-dev", "in-deskcheck",
      "ready-for-qa", "in-qa", "ready-for-acceptance", "in-acceptance",
      "ready-to-deploy", "done",
      "halted-stall", "halted-ambiguous", "halted-human-gate", "halted-unsafe",
    ];

    const existing: string[] = [];
    const skipped: string[] = [];

    for (const name of FORGE_STATES) {
      if (existingNames.has(name)) {
        existing.push(name);
      } else {
        skipped.push(name);
      }
    }

    return { created: [], existing, skipped };
  }

  async isFreshTeam(): Promise<boolean> {
    const count = await this.getIssueCount();
    return count === 0;
  }

  async hasForgeStates(): Promise<boolean> {
    const states = await this.getWorkflowStates();
    const FORGE_STATES = [
      "in-analysis", "ready-for-dev", "in-dev", "in-deskcheck",
      "ready-for-qa", "in-qa", "ready-for-acceptance", "in-acceptance",
      "ready-to-deploy", "done", "halted-stall",
    ];
    return FORGE_STATES.some((name) => states.some((s) => s.name === name));
  }

  async getLastComment(storyId: string): Promise<string | null> {
    const result = await this.callTool("list_comments", {
      issueId: storyId,
      limit: 1,
      orderBy: "createdAt",
    });
    const comments = result?.comments ?? [];
    if (comments.length === 0) return null;
    return comments[0]?.body ?? null;
  }

  async getLastCommentWithDate(storyId: string): Promise<CommentWithDate | null> {
    const result = await this.callTool("list_comments", {
      issueId: storyId,
      limit: 1,
      orderBy: "createdAt",
    });
    const comments = result?.comments ?? [];
    if (comments.length === 0) return null;
    const c = comments[0];
    if (!c?.body) return null;
    return { body: c.body, createdAt: c.createdAt };
  }

  async updateStoryState(storyId: string, stateName: string): Promise<void> {
    await this.callTool("save_issue", {
      id: storyId,
      state: stateName,
    });
  }

  async postComment(storyId: string, body: string): Promise<void> {
    await this.callTool("save_comment", {
      issueId: storyId,
      body,
    });
  }
}
