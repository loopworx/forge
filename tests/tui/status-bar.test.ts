import { describe, expect, it } from "bun:test";
import {
  StatusBar,
  formatTokens,
  formatMaxTokens,
  formatPercent,
  buildLeftChunks,
  buildRightChunks,
  buildPlainText,
  type StatusBarState,
} from "../../src/tui/status-bar";

describe("StatusBar (pure functions)", () => {
  describe("formatTokens", () => {
    it("formats raw number for < 1000", () => {
      expect(formatTokens(0)).toBe("0");
      expect(formatTokens(42)).toBe("42");
      expect(formatTokens(999)).toBe("999");
    });
    it("formats as 'Nk' for >= 1000 (floored)", () => {
      expect(formatTokens(1000)).toBe("1k");
      expect(formatTokens(12000)).toBe("12k");
      expect(formatTokens(1234567)).toBe("1234k");
    });
  });

  describe("formatMaxTokens", () => {
    it("formats raw number for < 1000000", () => {
      expect(formatMaxTokens(0)).toBe("0");
      expect(formatMaxTokens(100000)).toBe("100000");
    });
    it("formats as 'NM' for >= 1000000", () => {
      expect(formatMaxTokens(1000000)).toBe("1M");
      expect(formatMaxTokens(2000000)).toBe("2M");
    });
  });

  describe("formatPercent", () => {
    it("returns '0.0' when max <= 0", () => {
      expect(formatPercent(100, 0)).toBe("0.0");
      expect(formatPercent(100, -1)).toBe("0.0");
    });
    it("computes tokens/max * 100 with 1 decimal", () => {
      expect(formatPercent(0, 1000)).toBe("0.0");
      expect(formatPercent(120, 1000)).toBe("12.0");
      expect(formatPercent(50, 200)).toBe("25.0");
    });
  });

  describe("buildLeftChunks", () => {
    it("returns 'Not configured' chunk when unconfigured", () => {
      const state: StatusBarState = {
        agent: "", model: "", provider: "", thinking: "",
        tokens: 0, maxTokens: 0, mode: "inception",
      };
      const chunks = buildLeftChunks(state);
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain("Not configured");
    });
    it("returns 6 chunks for configured state (agent · sep · model · provider · sep · thinking)", () => {
      const state: StatusBarState = {
        agent: "po-agent", model: "glm-5.2", provider: "synthetic",
        thinking: "high", tokens: 0, maxTokens: 16384, mode: "inception",
      };
      const chunks = buildLeftChunks(state);
      expect(chunks.length).toBe(6);
      expect(chunks[0].text).toBe("po-agent");
      expect(chunks[0].bold).toBe(true);
      expect(chunks[2].text).toBe("glm-5.2");
      expect(chunks[5].text).toBe("high");
      expect(chunks[5].bold).toBe(true);
    });
  });

  describe("buildRightChunks", () => {
    it("returns [] when unconfigured", () => {
      const state: StatusBarState = {
        agent: "", model: "", provider: "", thinking: "",
        tokens: 0, maxTokens: 0, mode: "inception",
      };
      expect(buildRightChunks(state)).toEqual([]);
    });
    it("returns single chunk with tokens/max (pct%) · mode", () => {
      const state: StatusBarState = {
        agent: "po-agent", model: "glm-5.2", provider: "synthetic",
        thinking: "high", tokens: 12000, maxTokens: 1000000, mode: "inception",
      };
      const chunks = buildRightChunks(state);
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain("12k/1M");
      expect(chunks[0].text).toContain("1.2%");
      expect(chunks[0].text).toContain("inception");
    });
  });

  describe("buildPlainText", () => {
    it("returns 'Not configured' when unconfigured", () => {
      const state: StatusBarState = {
        agent: "", model: "", provider: "", thinking: "",
        tokens: 0, maxTokens: 0, mode: "inception",
      };
      const text = buildPlainText(state);
      expect(text).toContain("Not configured");
    });
    it("includes all fields when configured", () => {
      const state: StatusBarState = {
        agent: "po-agent", model: "glm-5.2", provider: "synthetic",
        thinking: "high", tokens: 12000, maxTokens: 1000000, mode: "inception",
      };
      const text = buildPlainText(state);
      expect(text).toContain("po-agent");
      expect(text).toContain("glm-5.2");
      expect(text).toContain("synthetic");
      expect(text).toContain("high");
      expect(text).toContain("1.2%");
      expect(text).toContain("inception");
    });
  });
});

describe("StatusBar", () => {
  describe("getPlainText (legacy)", () => {
    it("formats agent, model, provider, thinking, tokens, mode", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const text = bar.getPlainText();
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
      const text = bar.getPlainText();
      expect(text).toContain("0.0%");
      expect(text).toContain("development");
    });

    it("shows 'Not configured' message when no model is set", () => {
      const bar = new StatusBar();
      const text = bar.getPlainText();
      expect(text).toContain("Not configured");
      expect(text).toContain("/forge-new");
    });
  });

  describe("getLeft chunks", () => {
    it("returns StyledText with multiple chunks when configured", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getLeftChunks();
      expect(chunks.length).toBeGreaterThanOrEqual(4);
      // The agent chunk should be bold
      const agentChunk = chunks.find(c => typeof c === "object" && c.text.includes("po-agent"));
      expect(agentChunk).toBeDefined();
      expect((agentChunk as any).bold).toBe(true);
      expect((agentChunk as any).fg?.toLowerCase()).toBe("#fab283");
    });

    it("agent chunk is bold orange (primary)", () => {
      const bar = new StatusBar();
      bar.setInfo("architect-agent", "claude-opus", "anthropic", "medium", 500, 200000, "inception");
      const chunks = bar.getLeftChunks();
      const agentChunk = chunks.find(c => typeof c === "object" && "text" in c && c.text.includes("architect-agent")) as any;
      expect(agentChunk).toBeDefined();
      expect(agentChunk.bold).toBe(true);
      expect(agentChunk.fg?.toLowerCase()).toBe("#fab283");
    });

    it("model chunk is white / text color", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getLeftChunks();
      const modelChunk = chunks.find(c => typeof c === "object" && "text" in c && c.text.includes("glm-5.2")) as any;
      expect(modelChunk).toBeDefined();
      expect(modelChunk.fg?.toLowerCase()).toBe("#eeeeee");
      expect(modelChunk.bold).not.toBe(true);
    });

    it("provider chunk is muted gray", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getLeftChunks();
      const providerChunk = chunks.find(c => typeof c === "object" && "text" in c && c.text.includes("synthetic")) as any;
      expect(providerChunk).toBeDefined();
      expect(providerChunk.fg?.toLowerCase()).toBe("#808080");
    });

    it("thinking chunk is bold orange (warning)", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getLeftChunks();
      const thinkingChunk = chunks.find(c => typeof c === "object" && "text" in c && c.text.includes("high")) as any;
      expect(thinkingChunk).toBeDefined();
      expect(thinkingChunk.bold).toBe(true);
      expect(thinkingChunk.fg?.toLowerCase()).toBe("#f5a742");
    });

    it("returns single muted chunk with 'Not configured' when unconfigured", () => {
      const bar = new StatusBar();
      const chunks = bar.getLeftChunks();
      expect(chunks.length).toBe(1);
      const c = chunks[0] as any;
      expect(c.text).toContain("Not configured");
      expect(c.fg?.toLowerCase()).toBe("#808080");
    });
  });

  describe("getRight chunks", () => {
    it("returns chunks containing tokens/max pct and mode", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 15000, 200000, "inception");
      const chunks = bar.getRightChunks();
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      const text = chunks.map((c: any) => c.text ?? "").join("");
      expect(text).toContain("7.5%");
      expect(text).toContain("inception");
    });

    it("formats tokens in k when >= 1000", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getRightChunks();
      const text = chunks.map((c: any) => c.text ?? "").join("");
      expect(text).toContain("12k");
    });

    it("formats contextWindow in M when >= 1000000", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getRightChunks();
      const text = chunks.map((c: any) => c.text ?? "").join("");
      expect(text).toContain("1M");
    });

    it("returns empty chunks when unconfigured", () => {
      const bar = new StatusBar();
      const chunks = bar.getRightChunks();
      expect(chunks.length).toBe(0);
    });

    it("right chunk is muted gray (dim)", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getRightChunks();
      const chunk = chunks[0] as any;
      expect(chunk.fg?.toLowerCase()).toBe("#808080");
    });

    it("left chunks do NOT contain tokens/max/pct (no duplicate with right side)", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getLeftChunks();
      const text = chunks.map(c => c.text).join("");
      expect(text).not.toContain("12k");
      expect(text).not.toContain("1M");
      expect(text).not.toContain("1.2%");
      expect(text).not.toContain("inception");
    });

    it("right chunks contain tokens/max/pct/mode (context info)", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 12000, 1000000, "inception");
      const chunks = bar.getRightChunks();
      const text = chunks.map(c => c.text).join("");
      expect(text).toContain("12k");
      expect(text).toContain("1M");
      expect(text).toContain("1.2%");
      expect(text).toContain("inception");
    });
  });

  describe("setContext (live context tracking)", () => {
    it("updates tokens and contextWindow independently", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 0, 200000, "inception");
      bar.setContext(18000, 200000, 9.0);
      const text = bar.getPlainText();
      expect(text).toContain("9.0%");
      expect(text).toContain("18k");
    });

    it("setContext overrides the percentage", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 1000, 100000, "inception");
      // 1000/100000 = 1.0% by default calc
      bar.setContext(5000, 100000, 5.0);
      const text = bar.getPlainText();
      expect(text).toContain("5.0%");
    });

    it("reflects updated context in right chunks", () => {
      const bar = new StatusBar();
      bar.setInfo("po-agent", "glm-5.2", "synthetic", "high", 0, 200000, "inception");
      bar.setContext(25000, 200000, 12.5);
      const chunks = bar.getRightChunks();
      const text = chunks.map((c: any) => c.text ?? "").join("");
      expect(text).toContain("12.5%");
      expect(text).toContain("25k");
    });
  });
});
