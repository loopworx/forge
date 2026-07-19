import { describe, expect, it } from "bun:test";
import {
  Spinner,
  getSpinnerFrame,
  formatThinkingLabel,
  formatToolLabel,
  SPINNER_FRAMES,
  FRAME_DURATION_MS,
} from "../../src/tui/spinner";

const BRAILLE_FRAMES: string[] = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];

describe("Spinner (pure functions)", () => {
  it("SPINNER_FRAMES exports the 10 braille frames", () => {
    expect(SPINNER_FRAMES).toEqual(BRAILLE_FRAMES);
    expect(SPINNER_FRAMES.length).toBe(10);
  });

  it("FRAME_DURATION_MS is 80", () => {
    expect(FRAME_DURATION_MS).toBe(80);
  });

  it("formatThinkingLabel combines frame + 'Thinking' (no dots)", () => {
    expect(formatThinkingLabel(BRAILLE_FRAMES[0])).toBe(`${BRAILLE_FRAMES[0]} Thinking`);
    expect(formatThinkingLabel(BRAILLE_FRAMES[3])).toBe(`${BRAILLE_FRAMES[3]} Thinking`);
  });

  it("formatThinkingLabel does NOT contain dots", () => {
    for (const frame of BRAILLE_FRAMES) {
      const label = formatThinkingLabel(frame);
      expect(label).not.toContain(".");
    }
  });

  it("formatToolLabel combines frame + toolName (no '...')", () => {
    expect(formatToolLabel(BRAILLE_FRAMES[0], "bash")).toBe(`${BRAILLE_FRAMES[0]} bash`);
    expect(formatToolLabel(BRAILLE_FRAMES[5], "edit")).toBe(`${BRAILLE_FRAMES[5]} edit`);
  });

  it("formatToolLabel does NOT contain '...'", () => {
    for (const frame of BRAILLE_FRAMES) {
      const label = formatToolLabel(frame, "bash");
      expect(label).not.toContain("...");
    }
  });
});

describe("Spinner (stateful class)", () => {
  it("first frame is the first braille glyph", () => {
    const s = new Spinner();
    expect(s.getFrame()).toBe(BRAILLE_FRAMES[0]);
  });

  it("advances through all 10 braille frames", () => {
    const s = new Spinner();
    const frames: string[] = [];
    for (let i = 0; i < 10; i++) {
      frames.push(s.getFrame());
      s.advance(80);
    }
    expect(frames).toEqual(BRAILLE_FRAMES);
  });

  it("wraps back to frame 0 after one full cycle", () => {
    const s = new Spinner();
    s.advance(80 * 10); // exactly one cycle
    expect(s.getFrame()).toBe(BRAILLE_FRAMES[0]);
  });

  it("reset() returns to first frame", () => {
    const s = new Spinner();
    s.advance(80 * 3);
    s.reset();
    expect(s.getFrame()).toBe(BRAILLE_FRAMES[0]);
  });

  describe("getLabel", () => {
    it("thinking label has braille frame + 'Thinking' (no dots)", () => {
      const s = new Spinner();
      const label = s.getLabel(null);
      expect(label).toContain("Thinking");
      expect(label).not.toContain(".");
      expect(BRAILLE_FRAMES).toContain(label[0]);
    });

    it("thinking label is stable across calls (no dot cycling)", () => {
      const s = new Spinner();
      const l1 = s.getLabel(null);
      const l2 = s.getLabel(null);
      const l3 = s.getLabel(null);
      // Without dots, all calls return the same label (for the same frame).
      expect(l1).toBe(l2);
      expect(l2).toBe(l3);
    });

    it("tool label includes frame + toolName (no '...')", () => {
      const s = new Spinner();
      const label = s.getLabel("bash");
      expect(label).toContain("bash");
      expect(label).not.toContain("...");
      expect(BRAILLE_FRAMES).toContain(label[0]);
    });

    it("getLabel(null) and getLabel(undefined) return thinking label", () => {
      const s = new Spinner();
      expect(s.getLabel(null)).toBe(s.getLabel(undefined));
    });
  });
});

describe("getSpinnerFrame (pure helper)", () => {
  it("returns frames by elapsed ms", () => {
    expect(getSpinnerFrame(0)).toBe(BRAILLE_FRAMES[0]);
    expect(getSpinnerFrame(80)).toBe(BRAILLE_FRAMES[1]);
    expect(getSpinnerFrame(800)).toBe(BRAILLE_FRAMES[0]); // wraps
  });
});


