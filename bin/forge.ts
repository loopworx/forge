#!/usr/bin/env bun
import { Command } from "commander";
import { existsSync, mkdirSync, cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { generateForgeYaml } from "../src/config";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
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
  .action(async (_opts) => {
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

    const srcPlugin = join(packageRoot, "src", "plugin.ts");
    const pluginDir = join(opencodeDir, "plugins");
    if (existsSync(srcPlugin)) {
      mkdirSync(pluginDir, { recursive: true });
      cpSync(srcPlugin, join(pluginDir, "forge.ts"));
      console.log("  ✓ Plugin installed (.opencode/plugins/forge.ts)");
    }

    const configPath = join(cwd, "forge.yaml");
    if (!existsSync(configPath)) {
      console.log();
      console.log("Linear configuration");
      console.log("-".repeat(30));
      console.log("The Forge plugin needs a Linear API key and team key for its own operations");
      console.log("(separate from agent auth via OAuth — that's handled by 'opencode mcp auth linear').");
      console.log("If you prefer env vars, set LINEAR_API_KEY and LINEAR_TEAM_KEY and skip this.");
      console.log();

      const teamKey = await prompt("  Team key (e.g. FOR): ");
      const apiKey = await prompt("  API key (from https://linear.app/settings/api): ");

      const yaml = generateForgeYaml()
        .replace('team_key: ""', `team_key: "${teamKey || ""}"`)
        .replace('api_key: ""', `api_key: "${apiKey || ""}"`);
      writeFileSync(configPath, yaml);

      if (!teamKey || !apiKey) {
        console.log("  ⚠  Keys left blank — you can set LINEAR_API_KEY and LINEAR_TEAM_KEY env vars instead.");
      }
      console.log("  ✓ forge.yaml created");
    } else {
      console.log("  ✓ forge.yaml already exists (skipped)");
    }

    const opencodeJsonPath = join(cwd, "opencode.json");
    if (!existsSync(opencodeJsonPath)) {
      const config = {
        $schema: "https://opencode.ai/config.json",
        plugin: [
          ".opencode/plugins/forge.ts"
        ],
        mcp: {
          linear: {
            type: "remote",
            url: "https://mcp.linear.app/mcp",
            enabled: true,
            oauth: {},
          },
        },
      };
      writeFileSync(opencodeJsonPath, JSON.stringify(config, null, 2));
      console.log("  ✓ opencode.json created (with Linear MCP + Forge plugin config)");
      console.log("    Run: opencode mcp auth linear");
    } else {
      console.log("  ✓ opencode.json already exists (skipped)");
    }

    mkdirSync(join(cwd, "stories"), { recursive: true });
    writeFileSync(join(cwd, "stories", ".gitkeep"), "");
    console.log("  ✓ stories/ directory created");

    console.log();
    console.log("Forge is ready. Next steps:");
    console.log("  1. Run: opencode mcp auth linear  (OAuth for agent interactions)");
    console.log("  2. Open opencode and run: /forge new project");
  });

program.parse();
