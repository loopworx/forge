#!/usr/bin/env bun
import { Command } from "commander";
import { existsSync, copyFileSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const program = new Command();

program
  .name("forge")
  .description("Forge — lean software delivery framework for AI agents")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize Forge in the current project")
  .option("--no-integrations", "Skip interactive integration selection")
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

    const srcCommands = join(packageRoot, ".opencode", "commands", "forge");
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
      const templatePath = join(packageRoot, "forge.yaml");
      if (existsSync(templatePath)) {
        copyFileSync(templatePath, configPath);
        console.log("  ✓ forge.yaml created (edit to add your Linear API key)");
      }
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
    console.log("  1. Edit forge.yaml — add your Linear team_key and api_key");
    console.log("  2. Run: opencode mcp auth linear  (authenticate with Linear)");
    console.log("  3. Open opencode and run: /forge new project");
  });

program.parse();
