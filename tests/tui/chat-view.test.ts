import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { ChatView } from "../../src/tui/chat-view";
import type { ForgeEvent } from "../../src/agent/event-adapter";

describe("ChatView", () => {
  it("renders empty state", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    await renderOnce();
    expect(captureCharFrame()).toContain("waiting");
  });

  it("appends text deltas as conversation", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "text_delta", delta: "Hello world" } as ForgeEvent);
    await renderOnce();
    expect(captureCharFrame()).toContain("Hello world");
  });

  it("shows spinner when tool starts", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "tool_start", toolName: "bash" } as ForgeEvent);
    await renderOnce();
    expect(captureCharFrame()).toContain("bash");
  });

  it("clears spinner when tool ends", async () => {
    const { renderer, renderOnce } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "tool_start", toolName: "bash" } as ForgeEvent);
    chat.handleEvent({ type: "tool_end", toolName: "bash", isError: false } as ForgeEvent);
    await renderOnce();
    expect(chat.getCurrentToolName()).toBeNull();
  });

  it("shows error for failed tool", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
    const chat = new ChatView();
    chat.mount(renderer);
    chat.handleEvent({ type: "tool_start", toolName: "edit" } as ForgeEvent);
    chat.handleEvent({ type: "tool_end", toolName: "edit", isError: true } as ForgeEvent);
    await renderOnce();
    expect(captureCharFrame()).toContain("failed");
  });
});
