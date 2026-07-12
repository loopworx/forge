import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { TabBar } from "../../src/tui/tab-bar";

describe("TabBar", () => {
  it("renders empty when no tabs", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 5 });
    const bar = new TabBar();
    bar.mount(renderer);
    await renderOnce();
    expect(captureCharFrame().length).toBeGreaterThan(0);
  });

  it("renders tabs with labels", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 5 });
    const bar = new TabBar();
    bar.mount(renderer);
    bar.setTabs([
      { sessionId: "s1", label: "FOR-5 dev" },
      { sessionId: "s2", label: "FOR-8 qa" },
    ]);
    bar.setSelected("s1");
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("FOR-5");
    expect(frame).toContain("FOR-8");
  });

  it("shows auto/manual indicator", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 5 });
    const bar = new TabBar();
    bar.mount(renderer);
    bar.setTabs([{ sessionId: "s1", label: "FOR-5" }]);
    bar.setAutoCycling(true);
    await renderOnce();
    expect(captureCharFrame()).toContain("auto");
    bar.setAutoCycling(false);
    await renderOnce();
    expect(captureCharFrame()).toContain("manual");
  });

  it("cycleNext advances selected", () => {
    const bar = new TabBar();
    bar.setTabs([
      { sessionId: "s1", label: "FOR-5" },
      { sessionId: "s2", label: "FOR-8" },
    ]);
    bar.setSelected("s1");
    bar.cycleNext();
    expect(bar.getSelectedId()).toBe("s2");
    bar.cycleNext();
    expect(bar.getSelectedId()).toBe("s1");
  });

  it("cyclePrev goes backward", () => {
    const bar = new TabBar();
    bar.setTabs([
      { sessionId: "s1", label: "FOR-5" },
      { sessionId: "s2", label: "FOR-8" },
    ]);
    bar.setSelected("s1");
    bar.cyclePrev();
    expect(bar.getSelectedId()).toBe("s2");
  });
});
