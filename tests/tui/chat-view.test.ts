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
});
