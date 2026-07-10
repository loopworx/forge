import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { rmSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  generatePKCE,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  writeAuthTokens,
  runOAuth,
  FORGE_CLIENT_ID,
  CALLBACK_PORT,
} from "../../src/linear/linear-oauth";

const vi = { fn: mock };

const TEST_DIR = join(import.meta.dir, "..", ".test-oauth");

describe("linear-oauth", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("generatePKCE", () => {
    it("returns verifier, challenge, and state", () => {
      const pkce = generatePKCE();
      expect(pkce.verifier).toBeTruthy();
      expect(pkce.challenge).toBeTruthy();
      expect(pkce.state).toBeTruthy();
      expect(typeof pkce.verifier).toBe("string");
      expect(typeof pkce.challenge).toBe("string");
      expect(typeof pkce.state).toBe("string");
    });

    it("produces different values on each call", () => {
      const a = generatePKCE();
      const b = generatePKCE();
      expect(a.verifier).not.toBe(b.verifier);
      expect(a.state).not.toBe(b.state);
    });

    it("verifier is long enough for security (>= 43 chars)", () => {
      const pkce = generatePKCE();
      expect(pkce.verifier.length).toBeGreaterThanOrEqual(43);
    });
  });

  describe("buildAuthorizeUrl", () => {
    it("builds a valid Linear OAuth URL with PKCE parameters", () => {
      const pkce = generatePKCE();
      const url = buildAuthorizeUrl(pkce);

      expect(url).toContain("https://linear.app/oauth/authorize");
      expect(url).toContain(`client_id=${FORGE_CLIENT_ID}`);
      expect(url).toContain("response_type=code");
      expect(url).toContain("code_challenge=");
      expect(url).toContain("code_challenge_method=S256");
      expect(url).toContain(`state=${pkce.state}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(`http://127.0.0.1:${CALLBACK_PORT}/callback`)}`);
    });

    it("includes read,write,admin scopes", () => {
      const pkce = generatePKCE();
      const url = buildAuthorizeUrl(pkce);
      expect(url).toContain("scope=read");
      expect(url).toContain("write");
      expect(url).toContain("admin");
    });
  });

  describe("writeAuthTokens", () => {
    it("writes auth tokens to the specified path as JSON", () => {
      const authPath = join(TEST_DIR, ".forge", "auth.json");
      writeAuthTokens(authPath, {
        accessToken: "test-access",
        refreshToken: "test-refresh",
        expiresAt: 1234567890,
      });

      expect(existsSync(authPath)).toBe(true);
      const data = JSON.parse(readFileSync(authPath, "utf-8"));
      expect(data.accessToken).toBe("test-access");
      expect(data.refreshToken).toBe("test-refresh");
      expect(data.expiresAt).toBe(1234567890);
    });

    it("creates parent directory if it doesn't exist", () => {
      const authPath = join(TEST_DIR, "nested", "deep", "auth.json");
      writeAuthTokens(authPath, {
        accessToken: "a",
        refreshToken: "r",
        expiresAt: 0,
      });

      expect(existsSync(authPath)).toBe(true);
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("POSTs to Linear token endpoint and returns parsed tokens", async () => {
      const mockFetch = (globalThis.fetch = vi.fn() as any);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "exchanged-access",
          refresh_token: "exchanged-refresh",
          expires_in: 3600,
        }),
      });

      const tokens = await exchangeCodeForTokens("auth-code", "verifier");

      expect(tokens.accessToken).toBe("exchanged-access");
      expect(tokens.refreshToken).toBe("exchanged-refresh");
      expect(tokens.expiresAt).toBeGreaterThan(Date.now() / 1000);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.linear.app/oauth/token");
      const body = opts.body as string;
      expect(body).toContain("authorization_code");
      expect(body).toContain("auth-code");
      expect(body).toContain("verifier");
      expect(body).toContain(FORGE_CLIENT_ID);
    });

    it("throws on non-ok response", async () => {
      const mockFetch = (globalThis.fetch = vi.fn() as any);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "invalid_grant" }),
      });

      await expect(exchangeCodeForTokens("bad", "bad")).rejects.toThrow();
    });
  });

  describe("runOAuth", () => {
    it("throws if callback server fails to start", async () => {
      // We can't easily test the full flow without a browser,
      // but we can test error handling
      await expect(
        runOAuth(join(TEST_DIR, "auth.json"), { openBrowser: false, timeoutMs: 100 }),
      ).rejects.toThrow();
    });
  });
});
