import { describe, expect, it } from "bun:test";
import { ForgeTabBarComponent } from "../../src/dashboard/forge-tab-bar";
import { TabManager } from "../../src/dashboard/tab-manager";

describe("ForgeTabBarComponent", () => {
  it("renders empty when no tabs", () => {
    const tm = new TabManager();
    const bar = new ForgeTabBarComponent(tm);
    const lines = bar.render(80);
    expect(lines.length).toBe(0);
  });

  it("renders one tab with selected marker", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const bar = new ForgeTabBarComponent(tm);
    const lines = bar.render(80);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("FOR-5");
    expect(lines[0]).toContain("*");
  });

  it("renders multiple tabs with selected marker on active", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    tm.addTab("s2", "FOR-8", "qa-agent");
    const bar = new ForgeTabBarComponent(tm);
    const lines = bar.render(80);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("FOR-5");
    expect(lines[0]).toContain("FOR-8");
    // Selected is s1, so it should have * before FOR-5
    expect(lines[0]).toContain("*FOR-5");
    // FOR-8 should NOT have * before it
    expect(lines[0]).not.toContain("*FOR-8");
  });

  it("renders (auto) or (manual) indicator", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const bar = new ForgeTabBarComponent(tm);
    const autoLines = bar.render(80);
    expect(autoLines[0]).toContain("auto");
    tm.setManual();
    bar.invalidate();
    const manualLines = bar.render(80);
    expect(manualLines[0]).toContain("manual");
  });

  it("all lines fit within width", () => {
    const tm = new TabManager();
    for (let i = 0; i < 5; i++) {
      tm.addTab(`s${i}`, `FOR-${i}`, "developer-agent");
    }
    const bar = new ForgeTabBarComponent(tm);
    const width = 40;
    const lines = bar.render(width);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(width);
    }
  });

  it("invalidate clears cache", () => {
    const tm = new TabManager();
    tm.addTab("s1", "FOR-5", "developer-agent");
    const bar = new ForgeTabBarComponent(tm);
    bar.render(80);
    expect(() => bar.invalidate()).not.toThrow();
  });
});
