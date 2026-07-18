import { describe, expect, it, mock } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { SelectOverlay } from "../../src/tui/select-overlay";

const sampleOptions = [
  { name: "Apple", description: "a red fruit", value: "apple" },
  { name: "Banana", description: "a yellow fruit", value: "banana" },
  { name: "Cherry", description: "a small red fruit", value: "cherry" },
];

describe("SelectOverlay", () => {
  it("renders without throwing", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick a fruit",
      options: sampleOptions,
      onSelect: () => {},
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    expect(captureCharFrame()).toContain("Pick a fruit");
  });

  it("renders all option names", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Fruits",
      options: sampleOptions,
      onSelect: () => {},
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("Apple");
    expect(frame).toContain("Banana");
    expect(frame).toContain("Cherry");
  });

  it("shows ESC hint", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect: () => {},
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    expect(captureCharFrame().toLowerCase()).toContain("esc");
  });

  it("calls onSelect with the selected value when confirmSelection() is invoked", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const onSelect = mock((_value: string) => {});
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect,
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    overlay.confirmSelection();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toBe("apple"); // first option is selected by default
  });

  it("calls onSelect with the value at the current index after moveDown()", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const onSelect = mock((_value: string) => {});
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect,
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    overlay.moveDown();
    overlay.confirmSelection();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toBe("banana");
  });

  it("wraps around when moveDown goes past the last option", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const onSelect = mock((_value: string) => {});
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect,
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    overlay.moveDown();
    overlay.moveDown();
    overlay.moveDown(); // should wrap back to Apple
    overlay.confirmSelection();
    expect(onSelect.mock.calls[0]?.[0]).toBe("apple");
  });

  it("calls onCancel when cancel() is invoked", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const onCancel = mock(() => {});
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect: () => {},
      onCancel,
    });
    overlay.show();
    await renderOnce();
    overlay.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("destroys itself after selection", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect: () => {},
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    expect(captureCharFrame()).toContain("Pick");
    overlay.confirmSelection();
    await renderOnce();
    // After confirm, overlay should be gone
    expect(captureCharFrame()).not.toContain("Pick");
  });

  it("destroys itself after cancel", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect: () => {},
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    expect(captureCharFrame()).toContain("Pick");
    overlay.cancel();
    await renderOnce();
    expect(captureCharFrame()).not.toContain("Pick");
  });

  it("showAsPromise resolves to the selected value", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
    });
    const promise = overlay.showAsPromise();
    overlay.show();
    await renderOnce();
    overlay.moveDown();
    overlay.confirmSelection();
    const value = await promise;
    expect(value).toBe("banana");
  });

  it("showAsPromise rejects on cancel", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
    });
    const promise = overlay.showAsPromise();
    overlay.show();
    await renderOnce();
    overlay.cancel();
    let rejected = false;
    try {
      await promise;
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });

  // --- Visibility / contrast fixes (issue: overlay invisible against dark root) ---
  // The root background is #0f0f0f (backgroundPanel). The overlay previously
  // used backgroundColor #0f0f0f + borderColor #484848 — both low-contrast
  // against the root, making the overlay nearly invisible. Fix: use
  // backgroundColor #161616 (backgroundElement, distinct from root) and
  // borderColor #606060 (borderActive, higher contrast).

  it("overlay box uses backgroundElement (#161616) for contrast against root", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect: () => {},
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    const box = (overlay as any).overlayBox;
    expect(box).toBeDefined();
    const bg = box.backgroundColor;
    expect(bg).toBeDefined();
    // #161616 = (22, 22, 22) — distinct from root #0f0f0f = (15, 15, 15).
    const [r, g, b] = bg.toInts();
    expect(r).toBe(22);
    expect(g).toBe(22);
    expect(b).toBe(22);
  });

  it("overlay box uses borderActive (#606060) for higher contrast border", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect: () => {},
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    const box = (overlay as any).overlayBox;
    expect(box).toBeDefined();
    const bc = box.borderColor;
    expect(bc).toBeDefined();
    // #606060 = (96, 96, 96) — higher contrast than #484848 = (72, 72, 72).
    const [r, g, b] = bc.toInts();
    expect(r).toBe(96);
    expect(g).toBe(96);
    expect(b).toBe(96);
  });

  it("overlay box has a maxHeight to avoid covering the entire screen", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const overlay = new SelectOverlay(renderer, {
      title: "Pick",
      options: sampleOptions,
      onSelect: () => {},
      onCancel: () => {},
    });
    overlay.show();
    await renderOnce();
    const box = (overlay as any).overlayBox;
    expect(box).toBeDefined();
    // maxHeight is a setter-only property on Renderable (stored on the
    // yoga node). Verify it was set by checking the computed height is
    // less than the full terminal height (20 rows). With maxHeight 60%,
    // the box should be at most 12 rows.
    expect(box.height).toBeLessThanOrEqual(12);
    expect(box.height).toBeGreaterThan(0);
  });
});
