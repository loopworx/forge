import { parseArgs } from "node:util";
import { join } from "node:path";
import { ProjectInitializer } from "../src/cli/project-initializer";
import { FilePersistence } from "../src/engine/file-persistence";
import { LinearClient } from "../src/linear/linear-story-repository";
import { runOAuth } from "../src/linear/linear-oauth";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");
const BUNDLE_DIR = join(import.meta.dir);

function printUsage(): never {
  console.log(`Usage: forge <command> [options]

Commands:
  init    Initialize a new Forge project

Options:
  --cwd <path>       Project directory (default: current directory)
  --team-id <id>     Linear team ID
  --team-name <n>    Linear team name
  --skip-auth        Skip Linear OAuth flow
  --re-auth          Re-authenticate with Linear (deletes existing tokens)
`);
  process.exit(1);
}

async function main() {
  const args = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      cwd: { type: "string" },
      "team-id": { type: "string" },
      "team-name": { type: "string" },
      "skip-auth": { type: "boolean", default: false },
      "re-auth": { type: "boolean", default: false },
    },
  });

  const command = args.positionals[0];
  if (!command || command === "help") {
    printUsage();
  }

  if (command !== "init") {
    console.error(`Unknown command: ${command}`);
    printUsage();
  }

  const cwd = args.values.cwd ?? process.cwd();
  const persistenceDir = join(cwd, ".forge");
  const persistence = new FilePersistence(persistenceDir);
  const init = new ProjectInitializer(TEMPLATES_DIR, persistence, BUNDLE_DIR);

  if (init.isInitialized(cwd)) {
    console.error("Forge already initialized in this directory.");
    process.exit(1);
  }

  console.log("Initializing Forge project...");
  init.initProject(cwd, {
    teamId: args.values["team-id"],
    teamName: args.values["team-name"],
  });

  const skipAuth = args.values["skip-auth"] ?? false;
  const reAuth = args.values["re-auth"] ?? false;
  const authPath = join(persistenceDir, "auth.json");

  if (!skipAuth) {
    console.log("\nLinear Authentication");
    console.log("=====================");

    if (reAuth) {
      const { rmSync } = await import("node:fs");
      try { rmSync(authPath, { force: true }); } catch {}
    }

    try {
      console.log("Opening browser for Linear OAuth...");
      console.log("If the browser doesn't open, visit:");
      console.log("  https://linear.app/login");
      console.log("Then switch your workspace (top-right dropdown).");
      console.log("\nWaiting for authentication...");
      await runOAuth(authPath);
      console.log("Linear authenticated successfully!");
    } catch (err) {
      console.error(`Linear auth failed: ${(err as Error).message}`);
      console.error("You can re-run with --re-auth later.");
      console.error("Continuing without auth...\n");
    }

    if (!reAuth) {
      try {
        const linear = new LinearClient({ authPath });
        const team = await linear.discoverTeam();
        if (team) {
          console.log(`Discovered team: ${team.name} (${team.id})`);
          const { readFileSync, writeFileSync } = await import("node:fs");
          const yamlPath = join(cwd, "forge.yaml");
          let yaml = readFileSync(yamlPath, "utf-8");
          yaml = yaml.replace(/teamId:\s*""/, `teamId: "${team.id}"`);
          yaml = yaml.replace(/teamName:\s*""/, `teamName: "${team.name}"`);
          writeFileSync(yamlPath, yaml);

          console.log("\nCreating Linear workflow states...");
          const result = await linear.ensureWorkflowStates();
          console.log(`  Created: ${result.created.length} states`);
          console.log(`  Existing: ${result.existing.length} states`);
          if (result.skipped.length > 0) {
            console.log(`  Skipped: ${result.skipped.length}`);
          }
        } else {
          const teams = await linear.listTeams();
          if (teams.length > 1) {
            console.log("\nMultiple teams found:");
            teams.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} (${t.id})`));
            console.log("\nPlease re-run with --team-id <id> to select a team.");
          } else {
            console.log("No teams found in your Linear account.");
          }
        }
      } catch (err) {
        console.error(`Team discovery failed: ${(err as Error).message}`);
        console.error("You can configure teamId manually in forge.yaml.");
      }
    }
  }

  console.log("\nForge initialized successfully.");
  console.log("Run 'pi' and type /forge-new to start the inception flow.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
