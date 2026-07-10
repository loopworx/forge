import { describe, expect, it, beforeEach } from "bun:test";
import { LinearDocumentRepository } from "../../src/linear/linear-document-repository";
import { LinearClient } from "../../src/linear/linear-story-repository";

class MockLinearClient {
  documents = new Map<string, { id: string; title: string; content: string }>();
  nextId = 1;
  teamId = "team-1";

  async graphql(_query: string, variables?: any) {
    if (_query.includes("DocumentCreate")) {
      const input = variables?.input;
      const id = `doc-${this.nextId++}`;
      this.documents.set(id, { id, title: input?.title ?? "", content: input?.content ?? "" });
      return { documentCreate: { document: { id } } };
    }
    if (_query.includes("document(id:")) {
      const doc = this.documents.get(variables?.id);
      return { document: doc ?? null };
    }
    return null;
  }
}

describe("LinearDocumentRepository", () => {
  let mock: MockLinearClient;
  let repo: LinearDocumentRepository;

  beforeEach(() => {
    mock = new MockLinearClient();
    repo = new LinearDocumentRepository(mock as unknown as LinearClient);
  });

  it("creates a document and returns its ID", async () => {
    const id = await repo.createArtifact("Phase 1", "Content here");
    expect(id).toMatch(/^doc-/);
    expect(mock.documents.get(id)?.title).toBe("Phase 1");
  });

  it("returns null for missing document", async () => {
    const doc = await repo.getArtifact("nonexistent");
    expect(doc).toBeNull();
  });

  it("returns document by ID", async () => {
    const id = await repo.createArtifact("Test", "some content");
    const doc = await repo.getArtifact(id);
    expect(doc).not.toBeNull();
    expect(doc!.title).toBe("Test");
  });

  it("verifies artifact exists with sufficient content", async () => {
    const id = await repo.createArtifact("Phase 1", "x".repeat(200));
    const valid = await repo.verifyArtifact(id);
    expect(valid).toBe(true);
  });

  it("rejects verification for too-short content", async () => {
    const id = await repo.createArtifact("Short", "too short");
    const valid = await repo.verifyArtifact(id);
    expect(valid).toBe(false);
  });

  it("rejects verification for nonexistent artifact", async () => {
    const valid = await repo.verifyArtifact("nonexistent");
    expect(valid).toBe(false);
  });
});
