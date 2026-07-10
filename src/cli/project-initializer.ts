import { mkdirSync, existsSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import type { Persistence } from "../engine/interfaces";

export interface InitOptions {
  teamId?: string;
  teamName?: string;
}

export class ProjectInitializer {
  constructor(
    private templatesDir: string,
    private persistence: Persistence,
    private bundleDir?: string,
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
    const skillsDst = join(cwd, "skills");
    if (existsSync(skillsSrc)) {
      cpSync(skillsSrc, skillsDst, { recursive: true });
    }

    const agentsSrc = join(this.templatesDir, "agents");
    const agentsDst = join(cwd, "agents");
    if (existsSync(agentsSrc)) {
      cpSync(agentsSrc, agentsDst, { recursive: true });
    }

    mkdirSync(join(cwd, "stories"), { recursive: true });
    mkdirSync(join(cwd, "adr"), { recursive: true });
    mkdirSync(join(cwd, "design-system"), { recursive: true });
    mkdirSync(join(cwd, "docs"), { recursive: true });

    const extDir = join(cwd, ".pi", "extensions");
    mkdirSync(extDir, { recursive: true });
    const bundlePath = this.bundleDir ? join(this.bundleDir, "pi-bridge.js") : null;
    if (bundlePath && existsSync(bundlePath)) {
      cpSync(bundlePath, join(extDir, "forge.js"));
    } else {
      const extContent = `import { piBridge } from "@loopworx/forge";

export default piBridge;
`;
      writeFileSync(join(extDir, "forge.ts"), extContent);
    }

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

  isInitialized(cwd: string): boolean {
    return existsSync(join(cwd, ".forge")) && existsSync(join(cwd, "forge.yaml"));
  }
}
