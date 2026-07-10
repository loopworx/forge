import { parseArgs } from "node:util";
import { join } from "node:path";
import { ProjectInitializer } from "../src/cli/project-initializer";
import { FilePersistence } from "../src/engine/file-persistence";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");

function printUsage(): never {
  console.log(`Usage: forge <command> [options]

Commands:
  init    Initialize a new Forge project

Options:
  --cwd <path>       Project directory (default: current directory)
  --team-id <id>     Linear team ID
  --team-name <n>    Linear team name
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
  const init = new ProjectInitializer(TEMPLATES_DIR, persistence);

  if (init.isInitialized(cwd)) {
    console.error("Forge already initialized in this directory.");
    process.exit(1);
  }

  init.initProject(cwd, {
    teamId: args.values["team-id"],
    teamName: args.values["team-name"],
  });

  console.error("Forge initialized successfully.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
