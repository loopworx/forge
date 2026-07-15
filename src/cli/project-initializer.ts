import { mkdirSync, existsSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import type { Persistence } from "../engine/interfaces";

export interface InitOptions {
  teamId?: string;
  teamName?: string;
  agentDir?: string;
}

export class ProjectInitializer {
  constructor(
    private templatesDir: string,
    private persistence: Persistence,
  ) {}

  initProject(cwd: string, opts: InitOptions = {}): void {
    mkdirSync(join(cwd, ".forge"), { recursive: true });

    const templatePath = join(this.templatesDir, "forge.yaml");
    let yaml = readFileSync(templatePath, "utf-8");

    if (opts.teamId) {
      yaml = yaml.replace(/teamId:\s*""/, `teamId: "${opts.teamId}"`);
    }
    if (opts.teamName) {
      yaml = yaml.replace(/teamName:\s*""/, `teamName: "${opts.teamName}"`);
    }

    writeFileSync(join(cwd, "forge.yaml"), yaml);

    const skillsSrc = join(this.templatesDir, "skills");
    const skillsDst = join(cwd, ".agents", "skills");
    if (existsSync(skillsSrc)) {
      mkdirSync(join(cwd, ".agents"), { recursive: true });
      cpSync(skillsSrc, skillsDst, { recursive: true });
    }

    const agentsSrc = join(this.templatesDir, "agents");
    const agentsDst = opts.agentDir ?? join(cwd, "agents");
    if (existsSync(agentsSrc)) {
      mkdirSync(agentsDst, { recursive: true });
      cpSync(agentsSrc, agentsDst, { recursive: true });
    }

    mkdirSync(join(cwd, "stories"), { recursive: true });
    mkdirSync(join(cwd, "adr"), { recursive: true });
    mkdirSync(join(cwd, "design-system"), { recursive: true });
    mkdirSync(join(cwd, "docs"), { recursive: true });

    this.ensureGitignore(cwd);

    this.persistence.write("project-state", {
      mode: "inception",
      inception: {
        mode: "inception",
        currentPhase: 0,
        phaseSessionId: null,
        artifacts: {} as Record<number, string>,
      },
    });
  }

  private ensureGitignore(cwd: string): void {
    const gitignorePath = join(cwd, ".gitignore");
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, ".forge/\n");
    } else {
      const content = readFileSync(gitignorePath, "utf-8");
      if (!content.includes(".forge")) {
        writeFileSync(gitignorePath, content.trimEnd() + "\n.forge/\n");
      }
    }
  }

  isInitialized(cwd: string): boolean {
    return existsSync(join(cwd, ".forge")) && existsSync(join(cwd, "forge.yaml"));
  }
}
