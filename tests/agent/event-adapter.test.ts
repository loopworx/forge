import { describe, expect, it } from "bun:test";
import { adaptSdkEvent } from "../../src/agent/event-adapter";

describe("adaptSdkEvent", () => {
  describe("message_update", () => {
    it("adapts text_delta to ForgeEvent", () => {
      const raw = {
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: { type: "text_delta", delta: "Hello", contentIndex: 0 },
      };
      expect(adaptSdkEvent(raw)).toEqual({ type: "text_delta", delta: "Hello" });
    });

    it("adapts error subtype to agent_error", () => {
      const raw = {
        type: "message_update",
        message: { role: "assistant" },
        assistantMessageEvent: { type: "error", error: "Auth failed" },
      };
      expect(adaptSdkEvent(raw)).toEqual({ type: "agent_error", message: "Auth failed" });
    });

    it("returns null for text_start subtype", () => {
      const raw = {
        type: "message_update",
        assistantMessageEvent: { type: "text_start", contentIndex: 0 },
      };
      expect(adaptSdkEvent(raw)).toBeNull();
    });

    it("returns null for thinking_delta subtype", () => {
      const raw = {
        type: "message_update",
        assistantMessageEvent: { type: "thinking_delta", delta: "hmm", contentIndex: 0 },
      };
      expect(adaptSdkEvent(raw)).toBeNull();
    });

    it("returns null for toolcall_start subtype", () => {
      const raw = {
        type: "message_update",
        assistantMessageEvent: { type: "toolcall_start", contentIndex: 0 },
      };
      expect(adaptSdkEvent(raw)).toBeNull();
    });

    it("returns null when assistantMessageEvent is missing", () => {
      const raw = { type: "message_update", message: { role: "assistant" } };
      expect(adaptSdkEvent(raw)).toBeNull();
    });
  });

  describe("message_end", () => {
    it("adapts assistant role to message_end", () => {
      const raw = { type: "message_end", message: { role: "assistant" } };
      expect(adaptSdkEvent(raw)).toEqual({ type: "message_end", role: "assistant" });
    });

    it("returns null for user role", () => {
      const raw = { type: "message_end", message: { role: "user" } };
      expect(adaptSdkEvent(raw)).toBeNull();
    });

    it("returns null for toolResult role", () => {
      const raw = { type: "message_end", message: { role: "toolResult" } };
      expect(adaptSdkEvent(raw)).toBeNull();
    });

    it("returns null when message is missing", () => {
      const raw = { type: "message_end" };
      expect(adaptSdkEvent(raw)).toBeNull();
    });
  });

  describe("tool_execution_start", () => {
    it("adapts to tool_start", () => {
      const raw = { type: "tool_execution_start", toolName: "bash", toolCallId: "1", args: {} };
      expect(adaptSdkEvent(raw)).toEqual({ type: "tool_start", toolName: "bash" });
    });

    it("returns null when toolName is missing", () => {
      const raw = { type: "tool_execution_start", toolCallId: "1", args: {} };
      expect(adaptSdkEvent(raw)).toBeNull();
    });
  });

  describe("tool_execution_end", () => {
    it("adapts successful execution to tool_end", () => {
      const raw = {
        type: "tool_execution_end",
        toolName: "bash",
        isError: false,
        toolCallId: "1",
        result: "ok",
      };
      expect(adaptSdkEvent(raw)).toEqual({ type: "tool_end", toolName: "bash", isError: false });
    });

    it("adapts failed execution to tool_end with isError true", () => {
      const raw = {
        type: "tool_execution_end",
        toolName: "bash",
        isError: true,
        toolCallId: "1",
        result: { error: "boom" },
      };
      expect(adaptSdkEvent(raw)).toEqual({ type: "tool_end", toolName: "bash", isError: true });
    });

    it("defaults isError to false when missing", () => {
      const raw = { type: "tool_execution_end", toolName: "edit", toolCallId: "1" };
      expect(adaptSdkEvent(raw)).toEqual({ type: "tool_end", toolName: "edit", isError: false });
    });

    it("returns null when toolName is missing", () => {
      const raw = { type: "tool_execution_end", isError: false, toolCallId: "1" };
      expect(adaptSdkEvent(raw)).toBeNull();
    });
  });

  describe("agent_settled", () => {
    it("adapts to agent_settled", () => {
      expect(adaptSdkEvent({ type: "agent_settled" })).toEqual({ type: "agent_settled" });
    });
  });

  describe("unknown / ignored events", () => {
    it("returns null for an unrecognized top-level type", () => {
      expect(adaptSdkEvent({ type: "turn_start" })).toBeNull();
    });

    it("returns null for an event with no type field", () => {
      expect(adaptSdkEvent({ foo: "bar" })).toBeNull();
    });

    it("returns null for non-object input", () => {
      expect(adaptSdkEvent(null)).toBeNull();
      expect(adaptSdkEvent("message_update")).toBeNull();
      expect(adaptSdkEvent(42)).toBeNull();
      expect(adaptSdkEvent(undefined)).toBeNull();
    });
  });
});
