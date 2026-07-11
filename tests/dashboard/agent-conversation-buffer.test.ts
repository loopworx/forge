import { describe, expect, it } from "bun:test";
import { AgentConversationBuffer } from "../../src/dashboard/agent-conversation-buffer";
import type { SessionEvent } from "../../src/engine/interfaces";

describe("AgentConversationBuffer", () => {
  it("starts empty", () => {
    const buf = new AgentConversationBuffer("session-1");
    expect(buf.getLines()).toEqual([]);
  });

  it("captures text_delta events as plain agent text (no prefix)", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "Hello " } as SessionEvent);
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "world" } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("Hello world");
    expect(lines[0]).not.toContain("agent:");
  });

  it("starts a new line after message_end", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "First message" } as SessionEvent);
    buf.handleEvent({ type: "message_end", sessionId: "session-1" } as SessionEvent);
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "Second message" } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe("First message");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("Second message");
  });

  it("tool_call sets currentToolName but does not add lines", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "tool_call", sessionId: "session-1", toolName: "bash" } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(0);
    expect(buf.getCurrentToolName()).toBe("bash");
  });

  it("tool_result clears currentToolName and does not add lines on success", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "tool_call", sessionId: "session-1", toolName: "bash" } as SessionEvent);
    buf.handleEvent({ type: "tool_result", sessionId: "session-1", toolName: "bash", isError: false } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(0);
    expect(buf.getCurrentToolName()).toBeNull();
  });

  it("tool_result on error adds a failure line", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "tool_call", sessionId: "session-1", toolName: "bash" } as SessionEvent);
    buf.handleEvent({ type: "tool_result", sessionId: "session-1", toolName: "bash", isError: true } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("bash");
    expect(lines[0]).toContain("failed");
  });

  it("captures agent_error events", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "agent_error", sessionId: "session-1", isError: true } as SessionEvent);
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("error");
  });

  it("marks tool_call and tool_result errors as important", () => {
    const buf = new AgentConversationBuffer("session-1");
    expect(buf.hasImportantActivity()).toBe(false);
    buf.handleEvent({ type: "tool_call", sessionId: "session-1", toolName: "bash" } as SessionEvent);
    expect(buf.hasImportantActivity()).toBe(true);
    buf.clearImportantActivity();
    buf.handleEvent({ type: "tool_result", sessionId: "session-1", toolName: "bash", isError: true } as SessionEvent);
    expect(buf.hasImportantActivity()).toBe(true);
  });

  it("does not mark text_delta as important activity", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "thinking..." } as SessionEvent);
    expect(buf.hasImportantActivity()).toBe(false);
  });

  it("clears buffer and currentToolName", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "hello" } as SessionEvent);
    buf.handleEvent({ type: "tool_call", sessionId: "session-1", toolName: "bash" } as SessionEvent);
    buf.clear();
    expect(buf.getLines()).toEqual([]);
    expect(buf.getCurrentToolName()).toBeNull();
  });

  it("addUserMessage adds a user line with '> ' prefix", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.addUserMessage("Hello agent");
    const lines = buf.getLines();
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("> Hello agent");
  });

  it("addUserMessage flushes pending agent text before adding user line", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.handleEvent({ type: "text_delta", sessionId: "session-1", delta: "agent text" } as SessionEvent);
    buf.addUserMessage("user reply");
    const lines = buf.getLines();
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("agent text");
    expect(lines[1]).toBe("> user reply");
  });

  it("addUserMessage does not mark important activity", () => {
    const buf = new AgentConversationBuffer("session-1");
    buf.addUserMessage("hello");
    expect(buf.hasImportantActivity()).toBe(false);
  });

  it("rolls buffer at 500 lines", () => {
    const buf = new AgentConversationBuffer("session-1");
    for (let i = 0; i < 600; i++) {
      buf.addUserMessage(`line-${i}`);
    }
    expect(buf.getLines().length).toBe(500);
  });
});
