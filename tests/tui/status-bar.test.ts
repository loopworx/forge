import { describe, expect, it } from "bun:test";
import { StatusBar } from "../../src/tui/status-bar";

describe("StatusBar", () => {
  it("formats agent, model, provider, thinking, tokens, mode", () => {
    const bar = new StatusBar();
    bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
    const text = bar.getText();
    expect(text).toContain("po-agent");
    expect(text).toContain("glm-5.2");
    expect(text).toContain("synthetic");
    expect(text).toContain("high");
    expect(text).toContain("1.2%");
    expect(text).toContain("inception");
  });

  it("handles zero tokens", () => {
    const bar = new StatusBar();
    bar.setInfo("developer-agent", "deepseek-v4-pro", "opencode-go", "high", 0, 1000000, "development");
    const text = bar.getText();
    expect(text).toContain("0.0%");
    expect(text).toContain("development");
  });
});
