import { describe, expect, it } from "bun:test";
import { claudeBridge } from "../../src/bridge/claude-bridge";

describe("claudeBridge", () => {
  it("is a function that accepts an API parameter", async () => {
    expect(typeof claudeBridge).toBe("function");
    const result = await claudeBridge({});
    expect(result).toBeNull();
  });
});
