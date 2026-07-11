import { describe, expect, it } from "bun:test";
import { TabManager } from "../../src/dashboard/tab-manager";

describe("TabManager", () => {
  it("starts empty with auto-cycling on", () => {
    const tm = new TabManager();
    expect(tm.getTabs()).toEqual([]);
    expect(tm.getSelectedId()).toBeNull();
    expect(tm.isAutoCycling()).toBe(true);
  });

  it("adds a tab and selects it if none selected", () => {
    const tm = new TabManager();
    tm.addTab("session-1", "FOR-5", "dev");
    expect(tm.getTabs().length).toBe(1);
    expect(tm.getSelectedId()).toBe("session-1");
  });

  it("adds a tab without changing selection if one exists", () => {
    const tm = new TabManager();
    tm.addTab("session-1", "FOR-5", "dev");
    tm.addTab("session-2", "FOR-8", "qa");
    expect(tm.getTabs().length).toBe(2);
    expect(tm.getSelectedId()).toBe("session-1");
  });

  it("removes a tab and selects next if selected", () => {
    const tm = new TabManager();
    tm.addTab("session-1", "FOR-5", "dev");
    tm.addTab("session-2", "FOR-8", "qa");
    tm.removeTab("session-1");
    expect(tm.getTabs().length).toBe(1);
    expect(tm.getSelectedId()).toBe("session-2");
  });

  it("removes last tab and clears selection", () => {
    const tm = new TabManager();
    tm.addTab("session-1", "FOR-5", "dev");
    tm.removeTab("session-1");
    expect(tm.getTabs()).toEqual([]);
    expect(tm.getSelectedId()).toBeNull();
  });

  it("cycleNext wraps to first", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-1", "dev");
    tm.addTab("s2", "FOR-2", "qa");
    tm.addTab("s3", "FOR-3", "po");
    expect(tm.getSelectedId()).toBe("s1");
    tm.cycleNext();
    expect(tm.getSelectedId()).toBe("s2");
    tm.cycleNext();
    expect(tm.getSelectedId()).toBe("s3");
    tm.cycleNext();
    expect(tm.getSelectedId()).toBe("s1");
  });

  it("cyclePrev wraps to last", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-1", "dev");
    tm.addTab("s2", "FOR-2", "qa");
    tm.addTab("s3", "FOR-3", "po");
    tm.cyclePrev();
    expect(tm.getSelectedId()).toBe("s3");
    tm.cyclePrev();
    expect(tm.getSelectedId()).toBe("s2");
  });

  it("manual mode stops auto-cycling", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-1", "dev");
    tm.addTab("s2", "FOR-2", "qa");
    expect(tm.isAutoCycling()).toBe(true);
    tm.setManual();
    expect(tm.isAutoCycling()).toBe(false);
  });

  it("setAuto resumes auto-cycling", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-1", "dev");
    tm.setManual();
    tm.setAuto();
    expect(tm.isAutoCycling()).toBe(true);
  });

  it("onActivity switches to session with important activity (auto mode only)", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-1", "dev");
    tm.addTab("s2", "FOR-2", "qa");
    tm.onActivity("s2", true);
    expect(tm.getSelectedId()).toBe("s2");
  });

  it("onActivity does NOT switch for low-priority events", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-1", "dev");
    tm.addTab("s2", "FOR-2", "qa");
    tm.onActivity("s2", false);
    expect(tm.getSelectedId()).toBe("s1");
  });

  it("onActivity does NOT switch when in manual mode", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-1", "dev");
    tm.addTab("s2", "FOR-2", "qa");
    tm.setManual();
    tm.onActivity("s2", true);
    expect(tm.getSelectedId()).toBe("s1");
  });

  it("getTabLabel returns formatted label", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const label = tm.getTabLabel("s1");
    expect(label).toContain("FOR-5");
    expect(label).toContain("dev");
  });
});
