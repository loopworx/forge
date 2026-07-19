import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { WorkIndicator } from "../../src/tui/work-indicator";

describe("WorkIndicator", () => {
  it("mounts a container renderable", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    const container = indicator.mount(renderer);
    expect(container).toBeDefined();
    expect(container.id).toBe("work-indicator");
    await renderOnce();
  });

  it("is not visible by default", async () => {
    const { renderer } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    expect(indicator.isVisible()).toBe(false);
  });

  it("setWorking(true) makes it visible", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true);
    await renderOnce();
    expect(indicator.isVisible()).toBe(true);
  });

  it("setWorking(false) makes it invisible", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true);
    indicator.setWorking(false);
    await renderOnce();
    expect(indicator.isVisible()).toBe(false);
  });

  it("shows gear icon when working", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true);
    await renderOnce();
    const frame = captureCharFrame();
    // Gear icon U+2699 = \u2699
    expect(frame).toContain("\u2699");
  });

  it("shows 'AI is working' text when working without tool name", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true);
    await renderOnce();
    expect(captureCharFrame()).toContain("AI is working");
  });

  it("shows tool name when working with a tool name", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true, "bash");
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("bash");
    expect(frame).toContain("\u2699");
  });

  it("shows ESC hint when working", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true);
    await renderOnce();
    expect(captureCharFrame()).toContain("ESC");
  });

  it("hides everything when not working", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true);
    await renderOnce();
    indicator.setWorking(false);
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).not.toContain("AI is working");
    expect(frame).not.toContain("\u2699");
  });

  it("starts a spinner interval when working and stops when not", async () => {
    const { renderer } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true);
    expect((indicator as any).interval).not.toBeNull();
    indicator.setWorking(false);
    expect((indicator as any).interval).toBeNull();
  });

  it("dispose stops the spinner interval", async () => {
    const { renderer } = await createTestRenderer({ width: 60, height: 20 });
    const indicator = new WorkIndicator();
    indicator.mount(renderer);
    indicator.setWorking(true);
    expect((indicator as any).interval).not.toBeNull();
    indicator.dispose();
    expect((indicator as any).interval).toBeNull();
  });
});
