import { describe, expect, it } from "bun:test";
import { GitProofValidator } from "../../src/engine/git-proof-validator";
import type { ProofValidator } from "../../src/engine/interfaces";

class MockProofValidator implements ProofValidator {
  verifyGitCommitCalls: Array<{ storyId: string; acNumber: number }> = [];
  verifyArtifactCalls: string[] = [];
  commitResult = true;
  artifactResult = true;

  async verifyGitCommit(storyId: string, acNumber: number): Promise<boolean> {
    this.verifyGitCommitCalls.push({ storyId, acNumber });
    return this.commitResult;
  }
  async verifyArtifact(artifactId: string): Promise<boolean> {
    this.verifyArtifactCalls.push(artifactId);
    return this.artifactResult;
  }
}

describe("ProofValidator", () => {
  it("mock can be used to test verifyGitCommit", async () => {
    const mock = new MockProofValidator();
    const result = await mock.verifyGitCommit("FORGE-1", 1);
    expect(result).toBe(true);
    expect(mock.verifyGitCommitCalls).toEqual([{ storyId: "FORGE-1", acNumber: 1 }]);
  });

  it("mock can return false for failed verification", async () => {
    const mock = new MockProofValidator();
    mock.commitResult = false;
    const result = await mock.verifyGitCommit("FORGE-1", 2);
    expect(result).toBe(false);
  });

  it("mock can be used to test verifyArtifact", async () => {
    const mock = new MockProofValidator();
    const result = await mock.verifyArtifact("doc-123");
    expect(result).toBe(true);
    expect(mock.verifyArtifactCalls).toEqual(["doc-123"]);
  });
});

describe("GitProofValidator", () => {
  it("is constructable with cwd parameter", () => {
    const validator = new GitProofValidator("/tmp/test");
    expect(validator).toBeDefined();
  });

  it("implements verifyGitCommit", async () => {
    const validator = new GitProofValidator(".");
    const result = await validator.verifyGitCommit("test", 1);
    expect(typeof result).toBe("boolean");
  });

  it("implements verifyArtifact", async () => {
    const validator = new GitProofValidator(".");
    const result = await validator.verifyArtifact("doc-1");
    expect(typeof result).toBe("boolean");
  });
});
