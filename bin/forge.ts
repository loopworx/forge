#!/usr/bin/env bun
import { Command } from "commander";
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { parse, stringify } from "yaml";
import { generateForgeYaml } from "../src/config";
import { LinearClient } from "../src/linear-client";

const FORGE_CLIENT_ID = "383e63c709107d75f0468505bc68eb20";
const CALLBACK_PORT = 43117;
const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}/callback`;

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function authStatus(authFile: string): "authenticated" | "not-authenticated" {
  try {
    const raw = readFileSync(authFile, "utf-8");
    const data = JSON.parse(raw);
    if (!data?.accessToken) return "not-authenticated";
    if (Date.now() / 1000 >= (data.expiresAt ?? 0) - 60) return "not-authenticated";
    return "authenticated";
  } catch {
    return "not-authenticated";
  }
}

async function runOAuth(authFile: string): Promise<boolean> {
  const { verifier, challenge } = generatePKCE();
  const state = base64url(randomBytes(16));

  const authUrl = new URL("https://linear.app/oauth/authorize");
  authUrl.searchParams.set("client_id", FORGE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", CALLBACK_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "read,write");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("actor", "app");
  authUrl.searchParams.set("prompt", "consent");

  return new Promise((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.stop();
        resolve(false);
      }
    }, 120000);

    const server = Bun.serve({
      port: CALLBACK_PORT,
      hostname: CALLBACK_HOST,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/callback") {
          return new Response("Not found", { status: 404 });
        }

        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (returnedState !== state) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            server.stop();
            resolve(false);
          }
          return new Response("Invalid state parameter", { status: 400 });
        }

        if (!code) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            server.stop();
            resolve(false);
          }
          return new Response("Missing authorization code", { status: 400 });
        }

        try {
          const tokenParams = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: CALLBACK_URI,
            client_id: FORGE_CLIENT_ID,
            code_verifier: verifier,
          });

          const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenParams.toString(),
          });

          if (!tokenResponse.ok) {
            const errText = await tokenResponse.text();
            clearTimeout(timeout);
            if (!resolved) {
              resolved = true;
              server.stop();
              resolve(false);
            }
            return new Response(`Token exchange failed: ${errText}`, { status: 500 });
          }

          const tokenData = await tokenResponse.json();

          const authDir = authFile.substring(0, authFile.lastIndexOf("/"));
          mkdirSync(authDir, { recursive: true });
          writeFileSync(
            authFile,
            JSON.stringify({
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              expiresAt: Date.now() / 1000 + tokenData.expires_in,
            }, null, 2)
          );

          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            server.stop();
            resolve(true);
          }
          return new Response("Forge authenticated successfully! You can close this tab.");
        } catch (err) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            server.stop();
            resolve(false);
          }
          return new Response(`Error: ${(err as Error).message}`, { status: 500 });
        }
      },
    });

    const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
    spawnSync(openCmd, [authUrl.toString()], { stdio: "ignore" });
  });
}

const program = new Command();

program
  .name("forge")
  .description("Forge — lean software delivery framework for AI agents")
  .version("0.1.1");

program
  .command("init")
  .description("Initialize Forge in the current project")
  .option("--no-integrations", "Skip interactive integration selection")
  .option("--skip-auth", "Skip Linear authentication")
  .option("--re-auth", "Force re-authentication with Linear")
  .action(async (opts) => {
    const cwd = process.cwd();
    const packageRoot = join(import.meta.dir, "..");

    console.log("Forge Init");
    console.log("=".repeat(60));

    const opencodeDir = join(cwd, ".opencode");
    const agentsDir = join(opencodeDir, "agents");
    const skillsDir = join(opencodeDir, "skills");
    const commandsDir = join(opencodeDir, "commands", "forge");

    mkdirSync(agentsDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(commandsDir, { recursive: true });

    const srcAgents = join(packageRoot, "agents");
    if (existsSync(srcAgents)) {
      cpSync(srcAgents, agentsDir, { recursive: true });
      console.log("  ✓ Agent definitions installed (.opencode/agents/)");
    }

    const srcSkills = join(packageRoot, "skills");
    if (existsSync(srcSkills)) {
      cpSync(srcSkills, skillsDir, { recursive: true });
      console.log("  ✓ Skills installed (.opencode/skills/)");
    }

    const srcCommands = join(packageRoot, "commands", "forge");
    if (existsSync(srcCommands)) {
      cpSync(srcCommands, commandsDir, { recursive: true });
      console.log("  ✓ Commands installed (.opencode/commands/forge/)");
    }

    const distPlugin = join(packageRoot, "dist", "plugin.js");
    const pluginDir = join(opencodeDir, "plugins");
    if (existsSync(distPlugin)) {
      mkdirSync(pluginDir, { recursive: true });
      cpSync(distPlugin, join(pluginDir, "forge.js"));
      console.log("  ✓ Plugin installed (.opencode/plugins/forge.js)");
    }

    const configPath = join(cwd, "forge.yaml");
    if (!existsSync(configPath)) {
      writeFileSync(configPath, generateForgeYaml());
      console.log("  ✓ forge.yaml created");
    } else {
      console.log("  ✓ forge.yaml already exists (skipped)");
    }

    const opencodeJsonPath = join(cwd, "opencode.json");
    if (!existsSync(opencodeJsonPath)) {
      const config = {
        $schema: "https://opencode.ai/config.json",
      };
      writeFileSync(opencodeJsonPath, JSON.stringify(config, null, 2));
      console.log("  ✓ opencode.json created (Forge plugin auto-loads from .opencode/plugins/)");
    } else {
      console.log("  ✓ opencode.json already exists (skipped)");
    }

    mkdirSync(join(cwd, "stories"), { recursive: true });
    writeFileSync(join(cwd, "stories", ".gitkeep"), "");
    console.log("  ✓ stories/ directory created");

    if (opts.skipAuth) {
      console.log();
      console.log("Skipped Linear authentication (--skip-auth).");
      return;
    }

    console.log();
    console.log("Linear setup");
    console.log("-".repeat(30));

    const forgeDir = join(cwd, ".forge");
    mkdirSync(forgeDir, { recursive: true });
    const authFile = join(forgeDir, "linear-auth.json");

    if (opts.reAuth && existsSync(authFile)) {
      rmSync(authFile);
      console.log("  Cleared existing auth (--re-auth)");
    }

    const status = authStatus(authFile);
    let needsTeamSelection = false;

    if (status === "authenticated") {
      console.log("  ✓ Linear already authenticated");
      needsTeamSelection = true;
    } else {
      console.log("  Authenticating with Linear (opens browser)...");
      const ok = await runOAuth(authFile);
      if (!ok) {
        console.log("  ⚠  Authentication was cancelled or failed.");
        console.log("     Run manually: forge init");
        return;
      }
      console.log("  ✓ Linear authenticated");
      needsTeamSelection = true;
    }

    if (needsTeamSelection) {
      const existingConfig = parse(readFileSync(configPath, "utf-8"));

      if (existingConfig.linear?.team_id) {
        console.log(`  ✓ Team already configured: ${existingConfig.linear.team_name || existingConfig.linear.team_id}`);
      } else {
        console.log("  Fetching your teams...");
        const linear = new LinearClient({ authPath: authFile });
        const teams = await linear.listTeams();

        if (teams.length === 0) {
          console.log("  ⚠  No teams found in your Linear workspace.");
        } else if (teams.length === 1) {
          existingConfig.linear = existingConfig.linear || {};
          existingConfig.linear.team_id = teams[0].id;
          existingConfig.linear.team_name = teams[0].name;
          writeFileSync(configPath, stringify(existingConfig));
          console.log(`  ✓ Team auto-selected: ${teams[0].name}`);
        } else {
          console.log("  Available teams:");
          teams.forEach((t, i) => console.log(`    ${i + 1}. ${t.name}`));
          process.stdout.write("  Select team number: ");

          const answer = await new Promise<string>((resolve) => {
            process.stdin.once("data", (data) => resolve(data.toString().trim()));
          });

          const idx = parseInt(answer, 10) - 1;
          if (idx >= 0 && idx < teams.length) {
            existingConfig.linear = existingConfig.linear || {};
            existingConfig.linear.team_id = teams[idx].id;
            existingConfig.linear.team_name = teams[idx].name;
            writeFileSync(configPath, stringify(existingConfig));
            console.log(`  ✓ Team selected: ${teams[idx].name}`);
          } else {
            console.log("  ⚠  Invalid selection. Run forge init again to select a team.");
          }
        }
      }
    }

    console.log();
    console.log("Forge is ready. Open opencode and run: /forge new project");
  });

program.parse();
