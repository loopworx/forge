import { describe, expect, it, afterEach } from "bun:test";
import { forgeBridge } from "../../src/bridge/forge-bridge";

describe("forgeBridge", () => {
  afterEach(() => {
    delete process.env.FORGE_HARNESS;
  });

  it("calls the matching bridge function", async () => {
    process.env.FORGE_HARNESS = "test-harness";
    let bridgeCalled: string | null = null;

    await forgeBridge({ api: 42 }, {
      "test-harness": async (api: unknown) => { bridgeCalled = "called with " + (api as any).api; return null; },
    });

    expect(bridgeCalled).not.toBeNull();
    expect(bridgeCalled!).toBe("called with 42");
  });

  it("does nothing when harness has no matching bridge", async () => {
    process.env.FORGE_HARNESS = "nonexistent";

    await forgeBridge({}, {});
    // Should not throw
  });
});
