import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { InputBar } from "../../src/tui/input-bar";
import { CommandRegistry } from "../../src/agent/command-registry";

describe("InputBar", () => {
  it("renders input field", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 10 });
    const commands = new CommandRegistry();
    const bar = new InputBar(commands);
    bar.mount(renderer);
    await renderOnce();
    expect(captureCharFrame().length).toBeGreaterThan(0);
  });

  it("shows autocomplete when typing /", async () => {
    const { renderer, renderOnce, captureCharFrame, mockInput } = await createTestRenderer({ width: 60, height: 15 });
    const commands = new CommandRegistry();
    commands.register("forge-new", async () => {});
    commands.register("forge-next", async () => {});
    const bar = new InputBar(commands);
    bar.mount(renderer);
    bar.focus();
    mockInput.pressKey("/");
    await renderOnce();
    expect(captureCharFrame()).toContain("forge-new");
    expect(captureCharFrame()).toContain("forge-next");
  });

  it("Enter sends message via onSend", async () => {
    const { renderer, renderOnce, mockInput } = await createTestRenderer({ width: 60, height: 10 });
    const commands = new CommandRegistry();
    const bar = new InputBar(commands);
    let sent: any = null;
    bar.setOnSend((text: string) => { sent = text; });
    bar.mount(renderer);
    bar.focus();
    mockInput.pressKey("h");
    mockInput.pressKey("i");
    mockInput.pressEnter();
    await renderOnce();
    expect(sent).toBe("hi");
  });

  it("Enter on /forge-new calls onCommand", async () => {
    const { renderer, renderOnce, mockInput } = await createTestRenderer({ width: 60, height: 15 });
    const commands = new CommandRegistry();
    commands.register("forge-new", async () => {});
    const bar = new InputBar(commands);
    let cmdName: any = null;
    bar.setOnCommand((name: string) => { cmdName = name; });
    bar.mount(renderer);
    bar.focus();
    for (const ch of "/forge-new") mockInput.pressKey(ch);
    mockInput.pressEnter();
    await renderOnce();
    expect(cmdName).toBe("forge-new");
  });
});
