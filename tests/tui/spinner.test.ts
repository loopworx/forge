import { describe, expect, it } from "bun:test";
import { Spinner, getSpinnerFrame } from "../../src/tui/spinner";

const BRAILLE_FRAMES = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];

describe("Spinner", () => {
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

  describe("dots", () => {
    it("starts with a single dot", () => {
      const s = new Spinner();
      expect(s.getDots()).toBe(".");
    });

    it("cycles . → .. → ... → .", () => {
      const s = new Spinner();
      expect(s.getDots()).toBe(".");
      expect(s.getDots()).toBe("..");
      expect(s.getDots()).toBe("...");
      expect(s.getDots()).toBe(".");
      expect(s.getDots()).toBe("..");
    });

    it("getDots() advances the dot counter each call", () => {
      const s = new Spinner();
      expect(s.getDots()).toBe(".");
      expect(s.getDots()).toBe("..");
    });
  });

  describe("getLabel", () => {
    it("thinking label has braille frame + 'Thinking' + dots", () => {
      const s = new Spinner();
      const label = s.getLabel(null);
      expect(label).toContain("Thinking");
      expect(label).toContain(".");
      expect(BRAILLE_FRAMES).toContain(label[0]);
    });

    it("thinking label cycles dots across calls", () => {
      const s = new Spinner();
      const l1 = s.getLabel(null);
      const l2 = s.getLabel(null);
      const l3 = s.getLabel(null);
      const l4 = s.getLabel(null);
      expect(l1).toContain("Thinking.");
      expect(l1).not.toContain("Thinking..");
      expect(l2).toContain("Thinking..");
      expect(l2).not.toContain("Thinking...");
      expect(l3).toContain("Thinking...");
      expect(l4).toContain("Thinking.");
    });

    it("tool label includes frame + toolName + ...", () => {
      const s = new Spinner();
      const label = s.getLabel("bash");
      expect(label).toContain("bash");
      expect(label).toContain("...");
      expect(BRAILLE_FRAMES).toContain(label[0]);
    });
  });

  describe("getSpinnerFrame (legacy helper)", () => {
    it("returns frames by elapsed ms", () => {
      expect(getSpinnerFrame(0)).toBe(BRAILLE_FRAMES[0]);
      expect(getSpinnerFrame(80)).toBe(BRAILLE_FRAMES[1]);
      expect(getSpinnerFrame(800)).toBe(BRAILLE_FRAMES[0]); // wraps
    });
  });
});

