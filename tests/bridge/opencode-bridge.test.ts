import { describe, expect, it } from "bun:test";
import { opencodeBridge } from "../../src/bridge/opencode-bridge";

describe("opencodeBridge", () => {
  it("is a function that accepts an API parameter", async () => {
    expect(typeof opencodeBridge).toBe("function");
    const result = await opencodeBridge({});
    expect(result).toBeNull();
  });
});
