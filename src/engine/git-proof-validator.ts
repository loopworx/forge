import type { ProofValidator } from "./interfaces";
import { spawnSync } from "node:child_process";

export class GitProofValidator implements ProofValidator {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  async verifyGitCommit(storyId: string, acNumber: number): Promise<boolean> {
    const pattern = `feat(${storyId}): AC${acNumber}`;
    const result = spawnSync("git", ["log", "--oneline", "--grep", pattern], { cwd: this.cwd });
    return result.stdout.toString().trim().length > 0;
  }

  async verifyArtifact(_artifactId: string): Promise<boolean> {
    return true;
  }
}
