import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomBytes } from "node:crypto";

export const FORGE_CLIENT_ID = "383e63c709107d75f0468505bc68eb20";
export const CALLBACK_PORT = 43117;
export const LINEAR_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
export const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function base64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

export function generatePKCE(): {
  verifier: string;
  challenge: string;
  state: string;
} {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(pkce: {
  verifier: string;
  challenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: FORGE_CLIENT_ID,
    redirect_uri: `http://127.0.0.1:${CALLBACK_PORT}/callback`,
    response_type: "code",
    scope: "read,write,admin",
    state: pkce.state,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    prompt: "consent",
  });
  return `${LINEAR_AUTHORIZE_URL}?${params.toString()}`;
}

export function writeAuthTokens(authPath: string, tokens: AuthTokens): void {
  const dir = dirname(authPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(authPath, JSON.stringify(tokens, null, 2));
}

export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
): Promise<AuthTokens> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `http://127.0.0.1:${CALLBACK_PORT}/callback`,
    client_id: FORGE_CLIENT_ID,
    code_verifier: verifier,
  });

  const response = await fetch(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${JSON.stringify(body)}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresAt: Date.now() / 1000 + (data.expires_in ?? 3600),
  };
}

export interface RunOAuthOptions {
  openBrowser?: boolean;
  timeoutMs?: number;
}

export async function runOAuth(
  authPath: string,
  opts: RunOAuthOptions = {},
): Promise<AuthTokens> {
  const { openBrowser = true, timeoutMs = 120000 } = opts;
  const pkce = generatePKCE();
  const authorizeUrl = buildAuthorizeUrl(pkce);

  if (openBrowser) {
    const { default: open } = await import("open");
    await open(authorizeUrl);
  }

  return new Promise<AuthTokens>((resolve, reject) => {
    const server = Bun.serve({
      port: CALLBACK_PORT,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/callback") {
          return new Response("Not found", { status: 404 });
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          server.stop();
          reject(new Error(`OAuth error: ${error}`));
          return new Response(`<h1>Auth failed</h1><p>${error}</p>`, {
            headers: { "Content-Type": "text/html" },
          });
        }

        if (state !== pkce.state) {
          server.stop();
          reject(new Error("CSRF state mismatch"));
          return new Response("<h1>State mismatch</h1>", { status: 400 });
        }

        if (!code) {
          server.stop();
          reject(new Error("No authorization code received"));
          return new Response("<h1>No code</h1>", { status: 400 });
        }

        try {
          const tokens = await exchangeCodeForTokens(code, pkce.verifier);
          writeAuthTokens(authPath, tokens);
          server.stop();
          resolve(tokens);
          return new Response(
            "<h1>Forge authenticated!</h1><p>You can close this tab.</p>",
            { headers: { "Content-Type": "text/html" } },
          );
        } catch (err) {
          server.stop();
          reject(err as Error);
          return new Response(
            `<h1>Token exchange failed</h1><p>${(err as Error).message}</p>`,
            { status: 500 },
          );
        }
      },
    });

    setTimeout(() => {
      server.stop();
      reject(new Error("OAuth callback timed out"));
    }, timeoutMs);
  });
}
