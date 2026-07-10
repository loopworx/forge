import { describe, expect, it, beforeEach } from "bun:test";
import { ForgeChatBar } from "../../src/dashboard/forge-chat-bar";

describe("ForgeChatBar", () => {
  let chatBar: ForgeChatBar;

  beforeEach(() => {
    chatBar = new ForgeChatBar();
  });

  it("implements DashboardComponent", () => {
    expect(typeof chatBar.render).toBe("function");
    expect(typeof chatBar.handleInput).toBe("function");
    expect(typeof chatBar.invalidate).toBe("function");
  });

  it("renders prompt indicator", () => {
    const lines = chatBar.render(40);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain(">");
  });

  it("shows typed input text", () => {
    chatBar.handleInput("h");
    chatBar.handleInput("e");
    chatBar.handleInput("l");
    chatBar.handleInput("l");
    chatBar.handleInput("o");
    const lines = chatBar.render(40);
    expect(lines.some(l => l.includes("hello"))).toBe(true);
  });

  it("handles backspace", () => {
    chatBar.handleInput("a");
    chatBar.handleInput("b");
    chatBar.handleInput("\x7f"); // backspace
    const lines = chatBar.render(40);
    expect(lines.some(l => l.includes("a"))).toBe(true);
    expect(lines.every(l => !l.includes("ab"))).toBe(true);
  });

  it("submits on Enter and clears input", () => {
    let submitted = "";
    chatBar.onSubmit((text) => { submitted = text; });

    chatBar.handleInput("y");
    chatBar.handleInput("e");
    chatBar.handleInput("s");
    chatBar.handleInput("\r"); // Enter

    expect(submitted).toBe("yes");
    const lines = chatBar.render(40);
    expect(lines.every(l => !l.includes("yes"))).toBe(true);
  });

  it("ignores non-printable characters", () => {
    chatBar.handleInput("\x1b");
    chatBar.handleInput("\x1b[A");
    const lines = chatBar.render(40);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("stays within max width", () => {
    for (let i = 0; i < 100; i++) {
      chatBar.handleInput("x");
    }
    const lines = chatBar.render(20);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  it("clears on invalidate", () => {
    chatBar.handleInput("text");
    chatBar.invalidate();
    const lines = chatBar.render(40);
    expect(lines.every(l => !l.includes("text"))).toBe(true);
  });
});
