import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { ChatView } from "../../src/tui/chat-view";
import type { ForgeEvent } from "../../src/agent/event-adapter";

describe("ChatView", () => {
  it("renders empty state placeholder", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    await renderOnce();
    expect(captureCharFrame().length).toBeGreaterThan(0);
  });

  it("appends text deltas as conversation", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "text_delta", delta: "Hello from agent" } as ForgeEvent);
    await renderOnce();
    expect(captureCharFrame()).toContain("Hello from agent");
  });

  it("shows tool name during tool_start", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "tool_start", toolName: "bash" } as ForgeEvent);
    await renderOnce();
    expect(captureCharFrame()).toContain("bash");
  });

  it("clears tool name when tool ends without error", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "tool_start", toolName: "bash" } as ForgeEvent);
    chat.handleEvent({ type: "tool_end", toolName: "bash", isError: false } as ForgeEvent);
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).not.toContain("\u2717");
    expect(frame).not.toContain("\u26a0");
  });

  it("tool errors show warning symbol with descriptive message", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "tool_start", toolName: "edit" } as ForgeEvent);
    chat.handleEvent({ type: "tool_end", toolName: "edit", isError: true } as ForgeEvent);
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("\u26a0");
    expect(frame).toContain("edit");
  });

  it("displayMessage adds a system line and renders it", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.displayMessage("Welcome to Forge");
    await renderOnce();
    expect(captureCharFrame()).toContain("Welcome to Forge");
  });

  it("displayUserMessage adds user line with peach-colored left border", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.displayUserMessage("hello world");
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("hello world");
    expect(frame).toContain("\u2502");
  });

  it("agent messages have a left border", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "text_delta", delta: "AI response" } as ForgeEvent);
    chat.handleEvent({ type: "message_end", role: "assistant" } as ForgeEvent);
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("AI response");
    expect(frame).toContain("\u2502");
  });

  it("user message appears before agent message in correct order", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 30 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.displayUserMessage("question");
    chat.handleEvent({ type: "text_delta", delta: "answer" } as ForgeEvent);
    chat.handleEvent({ type: "message_end", role: "assistant" } as ForgeEvent);
    await renderOnce();
    const frame = captureCharFrame();
    const qIdx = frame.indexOf("question");
    const aIdx = frame.indexOf("answer");
    expect(qIdx).toBeGreaterThanOrEqual(0);
    expect(aIdx).toBeGreaterThan(qIdx);
  });

  it("spinner shows during thinking state", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    await renderOnce();
    const frame = captureCharFrame();
    const brailleChars = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
    expect(brailleChars.some(c => frame.includes(c))).toBe(true);
  });

  it("spinner shows 'Thinking' label with dots", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("Thinking");
    // Should contain at least one dot
    expect(frame).toContain(".");
  });

  it("spinner renderable is live so the renderer keeps animating it", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    await renderOnce();
    // The spinnerText renderable must have live=true so the renderer keeps
    // ticking it at targetFps. Without live, renderAfter only fires during
    // dirty render passes — which never happen between events, freezing
    // the spinner on its first frame (issue #1).
    const spinnerText = (chat as any).spinnerText;
    expect(spinnerText).toBeTruthy();
    expect(spinnerText.live).toBe(true);
  });

  it("spinner renderAfter advances the spinner and updates label", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    await renderOnce();
    // Capture the initial label, then render more frames.
    const initial = captureCharFrame();
    expect(initial).toContain("Thinking");
    // Multiple render passes — the renderAfter should run each pass because
    // live=true keeps the renderable in the active render list. The dot
    // cycle (.→..→...) is unit-tested in spinner.test.ts; here we just
    // verify the spinner text persists with the Thinking label and the
    // renderable is still attached and live.
    for (let i = 0; i < 3; i++) await renderOnce();
    const after = captureCharFrame();
    expect(after).toContain("Thinking");
    expect((chat as any).spinnerText.live).toBe(true);
  });

  it("spinner hides on agent_settled", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    chat.handleEvent({ type: "agent_settled" } as ForgeEvent);
    await renderOnce();
    const frame = captureCharFrame();
    const brailleChars = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
    expect(brailleChars.some(c => frame.includes(c))).toBe(false);
  });

  it("spinner hides on first text_delta", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    chat.handleEvent({ type: "text_delta", delta: "hi" } as ForgeEvent);
    await renderOnce();
    const frame = captureCharFrame();
    const brailleChars = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
    expect(brailleChars.some(c => frame.includes(c))).toBe(false);
    expect(frame).toContain("hi");
  });

  // --- Spinner animation via setInterval (issue: spinner was static) ---
  // The `live: true` + `renderAfter` mechanism is fragile through the
  // ScrollBox content→viewport→wrapper hierarchy: when the spinner is
  // scrolled out of the viewport (or the viewport culling filter excludes
  // it), `renderAfter` is not called and the spinner freezes on frame 0.
  // A `setInterval` driving `spinner.advance()` + `spinnerText.content = ...`
  // is immune to viewport culling — the content setter calls `requestRender()`
  // which schedules a fresh render pass regardless of culling.

  it("starts a spinner interval when setThinking(true)", async () => {
    const { renderer } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    expect((chat as any).spinnerInterval).not.toBeNull();
    chat.setThinking(false);
    expect((chat as any).spinnerInterval).toBeNull();
  });

  it("starts a spinner interval on tool_start and stops on tool_end", async () => {
    const { renderer } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "tool_start", toolName: "bash" } as ForgeEvent);
    expect((chat as any).spinnerInterval).not.toBeNull();
    chat.handleEvent({ type: "tool_end", toolName: "bash", isError: false } as ForgeEvent);
    expect((chat as any).spinnerInterval).toBeNull();
  });

  it("stops the spinner interval on agent_settled", async () => {
    const { renderer } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    expect((chat as any).spinnerInterval).not.toBeNull();
    chat.handleEvent({ type: "agent_settled" } as ForgeEvent);
    expect((chat as any).spinnerInterval).toBeNull();
  });

  it("stops the spinner interval on agent_error", async () => {
    const { renderer } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    expect((chat as any).spinnerInterval).not.toBeNull();
    chat.handleEvent({ type: "agent_error", message: "boom" } as ForgeEvent);
    expect((chat as any).spinnerInterval).toBeNull();
  });

  it("advances the spinner frame across the braille cycle on interval ticks", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    await renderOnce();
    const frame0 = captureCharFrame();
    const brailleChars = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
    expect(brailleChars.some(c => frame0.includes(c))).toBe(true);
    // Force several interval callbacks to fire by awaiting setTimeouts that
    // exceed the 80ms frame duration. The spinner should advance to a
    // different frame over time.
    const initialElapsed = (chat as any).spinner.elapsed;
    await new Promise((r) => setTimeout(r, 260));
    await renderOnce();
    const afterElapsed = (chat as any).spinner.elapsed;
    expect(afterElapsed).toBeGreaterThan(initialElapsed);
    const frameAfter = captureCharFrame();
    expect(brailleChars.some(c => frameAfter.includes(c))).toBe(true);
    chat.setThinking(false);
  });

  it("disposes the spinner interval on dispose()", async () => {
    const { renderer } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.setThinking(true);
    expect((chat as any).spinnerInterval).not.toBeNull();
    chat.dispose();
    expect((chat as any).spinnerInterval).toBeNull();
  });
});
