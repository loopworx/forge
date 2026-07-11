import { describe, expect, it } from "bun:test";
import { AgentConversationBuffer } from "../../src/dashboard/agent-conversation-buffer";
import type { SessionEvent } from "../../src/engine/interfaces";

describe("AgentConversationBuffer", () => {
  it("starts empty", () => {
    const buf = new AgentConversationBuffer("session-1");
    expect(buf.getLines()).toEqual([]);
  });

  it("captures text_delta events as agent messages", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "Hello " } as SessionEvent);
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "world" } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("Hello world");
  });

  it("starts a new agent line after message_end", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "First message" } as SessionEvent);
    buf.handleEvent({ type: "message_end", sessionId: "session-1" } as SessionEvent);
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "Second message" } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("First message");
    expect(lines[1]).toBe("");
    expect(lines[2]).toContain("Second message");
  });

  it("captures tool_call events", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "tool_call", sessionId: "session-1", toolName: "bash" } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("bash");
    expect(lines[0]).toContain("tool");
  });

  it("captures tool_result events", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "tool_result", sessionId: "session-1", toolName: "bash" } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("result");
  });

  it("captures agent_error events", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "agent_error", sessionId: "session-1", isError: true } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("ERROR");
  });

  it("marks tool_result errors distinctly", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "tool_result", sessionId: "session-1", toolName: "bash", isError: true } as SessionEvent);
    const lines = buf.getLines();
    expect(lines[0]).toContain("ERROR");
  });

  it("rolls buffer at 500 lines", () => {
    const buf = new AgentConversationBuffer("session-1");
    for (let i = 0; i < 600; i++) {
      buf.handleEvent({ type: "tool_call", sessionId: "session-1", toolName: `tool-${i}` } as SessionEvent);
    }
    expect(buf.getLines().length).toBe(500);
  });

  it("identifies important events for auto-cycling", () => {
    const buf = new AgentConversationBuffer("session-1");
    expect(buf.hasImportantActivity()).toBe(false);
    buf.handleEvent({ type: "tool_call", sessionId: "session-1", toolName: "bash" } as SessionEvent);
    expect(buf.hasImportantActivity()).toBe(true);
    buf.clearImportantActivity();
    expect(buf.hasImportantActivity()).toBe(false);
  });

  it("does not mark text_delta as important activity", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "thinking..." } as SessionEvent);
    expect(buf.hasImportantActivity()).toBe(false);
  });

  it("clears buffer", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "hello" } as SessionEvent);
    buf.clear();
    expect(buf.getLines()).toEqual([]);
  });
});
