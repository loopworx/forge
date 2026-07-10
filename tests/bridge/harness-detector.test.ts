import { describe, expect, it, afterEach } from "bun:test";
import { detectHarness } from "../../src/bridge/harness-detector";

describe("harness-detector", () => {
  const origEnv = process.env.FORGE_HARNESS;

  afterEach(() => {
    if (origEnv) process.env.FORGE_HARNESS = origEnv;
    else delete process.env.FORGE_HARNESS;
  });

  it("returns pi.dev when FORGE_HARNESS is set to pi.dev", () => {
    process.env.FORGE_HARNESS = "pi.dev";
    expect(detectHarness()).toBe("pi.dev");
  });

  it("returns claude-code when FORGE_HARNESS is set", () => {
    process.env.FORGE_HARNESS = "claude-code";
    expect(detectHarness()).toBe("claude-code");
  });

  it("returns opencode when FORGE_HARNESS is set", () => {
    process.env.FORGE_HARNESS = "opencode";
    expect(detectHarness()).toBe("opencode");
  });

  it("returns unknown when FORGE_HARNESS is not set", () => {
    delete process.env.FORGE_HARNESS;
    expect(detectHarness()).toBe("unknown");
  });
});
