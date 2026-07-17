import { describe, expect, it, mock } from "bun:test";
import { replaySessionHistory, extractTextContent, summarizeToolCall, summarizeToolResult } from "../../src/tui/session-history";

// Minimal mock for ChatView — captures the calls driven by replaySessionHistory.
function makeMockChatView() {
  const calls: string[] = [];
  return {
    calls,
    displayUserMessage: mock((text: string) => calls.push(`user(${text})`)),
    displayMessage: mock((text: string) => calls.push(`system(${text})`)),
    handleEvent: mock((e: any) => {
      // text_delta accumulates into a buffer; flush on message_end
      if (e.type === "text_delta") calls.push(`delta(${e.delta})`);
      else if (e.type === "message_end") calls.push(`message_end`);
      else if (e.type === "tool_start") calls.push(`tool_start(${e.toolName})`);
      else if (e.type === "tool_end") calls.push(`tool_end(${e.toolName}, isError=${e.isError})`);
      else if (e.type === "agent_settled") calls.push(`agent_settled`);
      else calls.push(`event(${e.type})`);
    }),
    setThinking: mock((v: boolean) => calls.push(`thinking(${v})`)),
  };
}

describe("extractTextContent", () => {
  it("returns the string as-is when content is a plain string", () => {
    expect(extractTextContent("hello")).toBe("hello");
  });

  it("joins all text contents with newlines", () => {
    expect(extractTextContent([
      { type: "text", text: "line1" },
      { type: "text", text: "line2" },
    ])).toBe("line1\nline2");
  });

  it("ignores non-text blocks like thinking", () => {
    expect(extractTextContent([
      { type: "text", text: "visible" },
      { type: "thinking", thinking: "hidden" } as any,
    ])).toBe("visible");
  });

  it("returns empty string when content is null or undefined", () => {
    expect(extractTextContent(null as any)).toBe("");
    expect(extractTextContent(undefined as any)).toBe("");
  });

  it("returns empty string when content array is empty", () => {
    expect(extractTextContent([])).toBe("");
  });
});

describe("summarizeToolCall", () => {
  it("returns 'toolName(args)' for a tool call with args", () => {
    expect(summarizeToolCall({ name: "bash", arguments: { command: "ls" } } as any))
      .toBe("bash({\"command\":\"ls\"})");
  });

  it("returns just the tool name when args are empty", () => {
    expect(summarizeToolCall({ name: "bash", arguments: {} } as any)).toBe("bash({})");
  });

  it("truncates long arg strings to 80 chars", () => {
    const longArg = "x".repeat(200);
    const result = summarizeToolCall({ name: "read", arguments: { path: longArg } } as any);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.startsWith("read")).toBe(true);
  });
});

describe("summarizeToolResult", () => {
  it("returns the trimmed first text content (truncated to 80 chars)", () => {
    expect(summarizeToolResult({
      role: "toolResult",
      toolName: "read",
      content: [{ type: "text", text: "file contents here" }] as any,
    } as any)).toBe("file contents here");
  });

  it("returns '(no output)' when content is empty", () => {
    expect(summarizeToolResult({
      role: "toolResult",
      toolName: "bash",
      content: [] as any,
    } as any)).toBe("(no output)");
  });

  it("truncates long results to 80 chars", () => {
    const long = "y".repeat(200);
    const result = summarizeToolResult({
      role: "toolResult",
      toolName: "bash",
      content: [{ type: "text", text: long }] as any,
    } as any);
    expect(result.length).toBeLessThanOrEqual(83); // "..." = 3 chars
  });
});

describe("replaySessionHistory", () => {
  it("handles empty entries array gracefully — shows a single 'restored' message", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, []);
    // Should show "restoring" + immediately "restored (0 entries)"
    expect(cv.calls.some(c => c.includes("Restoring"))).toBe(true);
    expect(cv.calls.some(c => c.includes("restored" ) && c.includes("0 entries"))).toBe(true);
  });

  it("replays a single user message as displayUserMessage", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "message",
        id: "e1",
        parentId: null,
        timestamp: "2026-01-01T00:00:00Z",
        message: { role: "user", content: "Hello there", timestamp: 0 },
      } as any,
    ]);
    expect(cv.calls.some(c => c === "user(Hello there)")).toBe(true);
  });

  it("replays assistant text content as a complete message_end", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "message",
        id: "e1",
        parentId: null,
        timestamp: "2026-01-01T00:00:00Z",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hi from AI" } as any],
          api: "openai-responses",
          provider: "synthetic",
          model: "glm-5.2",
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } as any,
          stopReason: "stop",
          timestamp: 0,
        },
      } as any,
    ]);
    expect(cv.calls.some(c => c === "delta(Hi from AI)")).toBe(true);
    expect(cv.calls.some(c => c === "message_end")).toBe(true);
    // delta must come BEFORE message_end
    const deltaIdx = cv.calls.findIndex(c => c === "delta(Hi from AI)");
    const endIdx = cv.calls.findIndex(c => c === "message_end");
    expect(deltaIdx).toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(deltaIdx);
  });

  it("skips thinking contents in assistant messages", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "message",
        id: "e1",
        parentId: null,
        timestamp: "...",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "internal reasoning" } as any,
            { type: "text", text: "outward answer" } as any,
          ],
          api: "openai-responses",
          provider: "synthetic",
          model: "glm-5.2",
          usage: {},
          stopReason: "stop",
          timestamp: 0,
        } as any,
      },
    ]);
    expect(cv.calls.some(c => c.includes("internal reasoning"))).toBe(false);
    expect(cv.calls.some(c => c === "delta(outward answer)")).toBe(true);
    expect(cv.calls.some(c => c === "message_end")).toBe(true);
  });

  it("emits tool_start + tool_end for assistant tool calls", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "message",
        id: "e1",
        parentId: null,
        timestamp: "...",
        message: {
          role: "assistant",
          content: [
            { type: "toolCall", id: "tc1", name: "bash", arguments: { command: "ls" } } as any,
          ],
          api: "openai-responses",
          provider: "synthetic",
          model: "glm-5.2",
          usage: {},
          stopReason: "toolUse",
          timestamp: 0,
        },
      } as any,
    ]);
    expect(cv.calls.some(c => c === "tool_start(bash)")).toBe(true);
    expect(cv.calls.some(c => c.startsWith("tool_end(bash") && c.includes("isError=false"))).toBe(true);
    const startIdx = cv.calls.findIndex(c => c === "tool_start(bash)");
    const endIdx = cv.calls.findIndex(c => c.startsWith("tool_end(bash"));
    expect(endIdx).toBeGreaterThan(startIdx);
  });

  it("emits a dim preview line for toolResult messages", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "message",
        id: "e1",
        parentId: null,
        timestamp: "...",
        message: {
          role: "toolResult",
          toolName: "bash",
          toolCallId: "tc1",
          content: [{ type: "text", text: "file1\nfile2" }] as any,
          isError: false,
          timestamp: 0,
        },
      } as any,
    ]);
    expect(cv.calls.some(c => c.startsWith("system") && c.includes("file1"))).toBe(true);
  });

  it("replays compaction entries as system messages with summary", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "compaction",
        id: "c1",
        parentId: null,
        timestamp: "...",
        summary: "Earlier conversation summarized",
        firstKeptEntryId: "x",
        tokensBefore: 50000,
      } as any,
    ]);
    expect(cv.calls.some(c => c.includes("compacted") && c.includes("Earlier conversation summarized"))).toBe(true);
  });

  it("replays branch_summary entries as system messages", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "branch_summary",
        id: "b1",
        parentId: null,
        timestamp: "...",
        fromId: "x",
        summary: "Forked from earlier point",
      } as any,
    ]);
    expect(cv.calls.some(c => c.includes("Branch") && c.includes("Forked from earlier point"))).toBe(true);
  });

  it("replays thinking_level_change entries", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "thinking_level_change",
        id: "t1",
        parentId: null,
        timestamp: "...",
        thinkingLevel: "high",
      } as any,
    ]);
    expect(cv.calls.some(c => c.includes("Thinking level") && c.includes("high"))).toBe(true);
  });

  it("replays model_change entries", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "model_change",
        id: "m1",
        parentId: null,
        timestamp: "...",
        provider: "anthropic",
        modelId: "claude-opus",
      } as any,
    ]);
    expect(cv.calls.some(c => c.includes("Model") && c.includes("anthropic") && c.includes("claude-opus"))).toBe(true);
  });

  it("replays session_info entries with name", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "session_info",
        id: "s1",
        parentId: null,
        timestamp: "...",
        name: "My inception session",
      } as any,
    ]);
    expect(cv.calls.some(c => c.includes("Session") && c.includes("My inception session"))).toBe(true);
  });

  it("replays custom_message entries with display:true", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "custom_message",
        id: "cm1",
        parentId: null,
        timestamp: "...",
        customType: "note",
        content: "Important note",
        display: true,
      } as any,
    ]);
    expect(cv.calls.some(c => c.includes("Important note"))).toBe(true);
  });

  it("skips custom_message entries with display:false", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      {
        type: "custom_message",
        id: "cm1",
        parentId: null,
        timestamp: "...",
        customType: "hidden",
        content: "should not appear",
        display: false,
      } as any,
    ]);
    expect(cv.calls.some(c => c.includes("should not appear"))).toBe(false);
  });

  it("preserves multi-turn order: user → assistant → user → assistant", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      { type: "message", id: "1", parentId: null, timestamp: "t", message: { role: "user", content: "Q1", timestamp: 0 } } as any,
      {
        type: "message", id: "2", parentId: "1", timestamp: "t", message: {
          role: "assistant", content: [{ type: "text", text: "A1" } as any],
          api: "openai-responses", provider: "p", model: "m", usage: {}, stopReason: "stop", timestamp: 0,
        },
      } as any,
      { type: "message", id: "3", parentId: "2", timestamp: "t", message: { role: "user", content: "Q2", timestamp: 0 } } as any,
      {
        type: "message", id: "4", parentId: "3", timestamp: "t", message: {
          role: "assistant", content: [{ type: "text", text: "A2" } as any],
          api: "openai-responses", provider: "p", model: "m", usage: {}, stopReason: "stop", timestamp: 0,
        },
      } as any,
    ]);
    const q1Idx = cv.calls.findIndex(c => c === "user(Q1)");
    const a1Idx = cv.calls.findIndex(c => c === "delta(A1)");
    const end1Idx = cv.calls.findIndex(c => c === "message_end");
    const q2Idx = cv.calls.findIndex(c => c === "user(Q2)");
    const a2Idx = cv.calls.findIndex(c => c === "delta(A2)");
    expect(q1Idx).toBeLessThan(a1Idx);
    expect(a1Idx).toBeLessThan(end1Idx);
    expect(end1Idx).toBeLessThan(q2Idx);
    expect(q2Idx).toBeLessThan(a2Idx);
  });

  it("does not crash on malformed entries (missing message field)", () => {
    const cv = makeMockChatView();
    expect(() => replaySessionHistory(cv as any, [
      { type: "message", id: "x", parentId: null, timestamp: "" } as any, // no `message`
      { type: "unknown_type" } as any, // unknown entry
    ])).not.toThrow();
    // Should still emit "restoring" and "restored" markers
    expect(cv.calls.some(c => c.includes("Restoring"))).toBe(true);
  });

  it("emits delimiters: 'Restoring...' before, 'restored (N entries)' after", () => {
    const cv = makeMockChatView();
    replaySessionHistory(cv as any, [
      { type: "message", id: "1", parentId: null, timestamp: "", message: { role: "user", content: "hi", timestamp: 0 } } as any,
      {
        type: "message", id: "2", parentId: "1", timestamp: "", message: {
          role: "assistant", content: [{ type: "text", text: "hello" } as any],
          api: "r", provider: "p", model: "m", usage: {}, stopReason: "stop", timestamp: 0,
        },
      } as any,
    ]);
    const restoreIdx = cv.calls.findIndex(c => c.includes("Restoring"));
    const contentIdx = cv.calls.findIndex(c => c === "user(hi)");
    const doneIdx = cv.calls.findIndex(c => c.includes("restored") && c.includes("2 entries"));
    expect(restoreIdx).toBeGreaterThanOrEqual(0);
    expect(restoreIdx).toBeLessThan(contentIdx);
    expect(contentIdx).toBeLessThan(doneIdx);
  });
});
