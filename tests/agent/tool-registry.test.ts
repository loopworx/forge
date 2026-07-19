import { describe, expect, it } from "bun:test";
import { ToolRegistry } from "../../src/agent/tool-registry";

describe("ToolRegistry", () => {
  it("creates forge tools that call engine methods", async () => {
    const mockEngine = {
      claimStory: async (_role: string) => ({ id: "FOR-1", title: "Test", state: "in-dev", assignee: null, iteration: null, featureFlag: null, url: "" }),
      completeAc: async (_id: string, _ac: number, _sha: string) => true,
      handoff: async () => ({ success: true }),
    } as any;

    const mockArtifacts = {
      createArtifact: async (_title: string, _content: string) => "doc-1",
    } as any;

    const registry = new ToolRegistry();
    const tools = registry.registerForgeTools(mockEngine, mockArtifacts);

    const names = tools.map((t: any) => t.name);
    expect(names).toContain("forge_claim_story");
    expect(names).toContain("forge_complete_ac");
    expect(names).toContain("forge_handoff");
    expect(names).toContain("forge_create_artifact");
    expect(names).toContain("forge_log_progress");

    const claimTool = tools.find((t: any) => t.name === "forge_claim_story")!;
    const result = await claimTool.execute("call-1", { agentRole: "developer-agent" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("FOR-1");
  });

  it("getToolNames returns all forge tool names", () => {
    const registry = new ToolRegistry();
    registry.registerForgeTools({} as any, {} as any);
    const names = registry.getToolNames();
    expect(names).toContain("forge_claim_story");
    expect(names).toContain("forge_complete_ac");
    expect(names.length).toBe(5);
  });

  it("forge_claim_story returns 'No stories available' when none found", async () => {
    const engine = { claimStory: async () => null };
    const registry = new ToolRegistry();
    const tools = registry.registerForgeTools(engine as any, {} as any);
    const tool = tools.find((t: any) => t.name === "forge_claim_story")!;
    const result = await tool.execute("call-1", { agentRole: "developer-agent" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No stories available");
  });

  it("forge_complete_ac returns error when git proof fails", async () => {
    const engine = { completeAc: async () => ({ success: false }) };
    const registry = new ToolRegistry();
    const tools = registry.registerForgeTools(engine as any, {} as any);
    const tool = tools.find((t: any) => t.name === "forge_complete_ac")!;
    const result = await tool.execute("call-1", { storyId: "FOR-1", acNumber: 1, commitSha: "abc123" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Git proof failed");
  });

  it("forge_handoff returns error when handoff fails", async () => {
    const engine = { handoff: async () => ({ success: false, error: "Invalid transition" }) };
    const registry = new ToolRegistry();
    const tools = registry.registerForgeTools(engine as any, {} as any);
    const tool = tools.find((t: any) => t.name === "forge_handoff")!;
    const result = await tool.execute("call-1", { storyId: "FOR-1", agentRole: "developer", targetState: "in-qa", accomplishments: "done", remaining: "", testLocations: "" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Handoff failed");
  });

  it("forge_create_artifact creates an artifact and returns its id", async () => {
    const artifacts = { createArtifact: async () => "doc-42" };
    const registry = new ToolRegistry();
    const tools = registry.registerForgeTools({} as any, artifacts as any);
    const tool = tools.find((t: any) => t.name === "forge_create_artifact")!;
    const result = await tool.execute("call-1", { title: "Test Doc", content: "Hello" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("doc-42");
  });

  it("forge_log_progress returns a progress message", async () => {
    const registry = new ToolRegistry();
    const tools = registry.registerForgeTools({} as any, {} as any);
    const tool = tools.find((t: any) => t.name === "forge_log_progress")!;
    const result = await tool.execute("call-1", { message: "Working on AC2" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Working on AC2");
  });
});
