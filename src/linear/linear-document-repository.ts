import type { ArtifactRepository } from "../engine/interfaces";
import type { Artifact } from "../engine/types";
import { LinearClient } from "./linear-story-repository";

export class LinearDocumentRepository implements ArtifactRepository {
  constructor(private client: LinearClient) {}

  async createArtifact(title: string, content: string): Promise<string> {
    const data = await this.client.graphql(`mutation($input: DocumentCreateInput!) {
      documentCreate(input: $input) { document { id } }
    }`, {
      input: { title, content, teamId: this.client.teamId },
    });
    const docId = data?.documentCreate?.document?.id;
    if (!docId) throw new Error("Failed to create document");
    return docId;
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    const data = await this.client.graphql(`query($id: String!) {
      document(id: $id) { id title content }
    }`, { id });
    const doc = data?.document;
    return doc ? { id: doc.id, title: doc.title ?? "", content: doc.content ?? "" } : null;
  }

  async verifyArtifact(id: string): Promise<boolean> {
    const doc = await this.getArtifact(id);
    return doc !== null && doc.content.length > 100;
  }
}
