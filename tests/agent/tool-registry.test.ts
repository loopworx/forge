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
});
