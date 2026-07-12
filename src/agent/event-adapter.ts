/**
 * Event adapter: translates raw SDK events emitted by
 * `@earendil-works/pi-coding-agent`'s `AgentSession.subscribe()` into the clean,
 * discriminated `ForgeEvent` union consumed by the Forge TUI.
 *
 * The adapter is intentionally defensive: it accepts `unknown` and returns `null`
 * for anything it cannot map, so unrecognized SDK events are safely ignored.
 */

/** Clean event union consumed by the Forge TUI rendering layer. */
export type ForgeEvent =
  | { type: "text_delta"; delta: string }
  | { type: "message_end"; role: string }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_end"; toolName: string; isError: boolean }
  | { type: "agent_settled" }
  | { type: "agent_error"; message: string };

/** Extract a human-readable message from an SDK error payload. */
function extractErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }
  if (error !== null && typeof error === "object" && "errorMessage" in error) {
    const msg = (error as { errorMessage?: unknown }).errorMessage;
    if (typeof msg === "string") {
      return msg;
    }
  }
  return null;
}

/**
 * Translate a raw SDK event into a `ForgeEvent`, or `null` when the event is
 * unrecognized or carries no information the TUI cares about.
 */
export function adaptSdkEvent(raw: unknown): ForgeEvent | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }

  const type = (raw as { type?: unknown }).type;
  if (typeof type !== "string") {
    return null;
  }

  switch (type) {
    case "message_update": {
      const sub = (raw as { assistantMessageEvent?: unknown }).assistantMessageEvent;
      if (sub === null || typeof sub !== "object") {
        return null;
      }
      const subType = (sub as { type?: unknown }).type;
      if (subType === "text_delta") {
        const delta = (sub as { delta?: unknown }).delta;
        if (typeof delta !== "string") {
          return null;
        }
        return { type: "text_delta", delta };
      }
      if (subType === "error") {
        const message = extractErrorMessage((sub as { error?: unknown }).error);
        if (message === null) {
          return null;
        }
        return { type: "agent_error", message };
      }
      // Other subtypes (text_start, thinking_*, toolcall_*, done, start) are
      // ignored — the TUI only cares about streamed text deltas and errors.
      return null;
    }

    case "message_end": {
      const message = (raw as { message?: unknown }).message;
      if (message === null || typeof message !== "object") {
        return null;
      }
      const role = (message as { role?: unknown }).role;
      if (role !== "assistant") {
        // Only assistant turns are surfaced as message_end to the TUI.
        return null;
      }
      return { type: "message_end", role: "assistant" };
    }

    case "tool_execution_start": {
      const toolName = (raw as { toolName?: unknown }).toolName;
      if (typeof toolName !== "string") {
        return null;
      }
      return { type: "tool_start", toolName };
    }

    case "tool_execution_end": {
      const toolName = (raw as { toolName?: unknown }).toolName;
      if (typeof toolName !== "string") {
        return null;
      }
      const isError = (raw as { isError?: unknown }).isError === true;
      return { type: "tool_end", toolName, isError };
    }

    case "agent_settled": {
      return { type: "agent_settled" };
    }

    default:
      // Unknown / ignored top-level event types.
      return null;
  }
}
