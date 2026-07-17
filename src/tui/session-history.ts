/**
 * Replays persisted session entries into a ChatView so the user can see the
 * full conversation structure (user prompts, agent responses, tool calls,
 * compaction summaries, model changes) when resuming a session.
 *
 * Pure function — drives the existing ChatView public API (displayUserMessage,
 * displayMessage, handleEvent) rather than manipulating the renderable tree
 * directly. This keeps the module testable without a renderer instance.
 *
 * Entry shape mirrors the SDK's SessionEntry discriminated union from
 * @earendil-works/pi-coding-agent (session-manager.d.ts).
 */

/** Minimal interface for ChatView — what we call from here. */
export interface ReplayChatView {
  displayUserMessage(text: string): void;
  displayMessage(text: string): void;
  handleEvent(event: any): void;
}

/** Anything with a `type` field — the SDK's SessionEntry shape, loosely. */
interface SessionEntryLike {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Extract plain text from a message's content, which may be a string (user
 * messages) or an array of content blocks (assistant: TextContent /
 * ThinkingContent / ToolCall). Non-text blocks are skipped.
 */
export function extractTextContent(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content as any[]) {
    if (block && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}

/**
 * One-line summary of a tool call's arguments, truncated to 80 chars.
 * Format: `toolName(JSON.stringify(args))`.
 */
export function summarizeToolCall(call: { name?: string; arguments?: Record<string, any> }): string {
  const name = call?.name ?? "tool";
  const argsJson = call?.arguments ? JSON.stringify(call.arguments) : "{}";
  const full = `${name}(${argsJson})`;
  if (full.length <= 80) return full;
  return full.slice(0, 77) + "...";
}

/**
 * Truncated preview of a tool result message's first text content, suitable
 * for a single-line display under the tool call.
 */
export function summarizeToolResult(message: {
  toolName?: string;
  content?: any[] | unknown;
  isError?: boolean;
}): string {
  const preview = extractTextContent(message.content).trim();
  if (!preview) return "(no output)";
  // First line only, capped at 80 chars.
  const firstLine = preview.split("\n")[0] ?? "";
  if (firstLine.length <= 80) return firstLine;
  return firstLine.slice(0, 77) + "...";
}

/**
 * Replay `entries` into `chatView` in order, calling the existing ChatView
 * public methods so the rendered chat matches what would have happened in
 * real time.
 *
 * Entries are the SDK's `SessionEntry[]` returned by
 * `sessionManager.buildContextEntries()`.
 */
export function replaySessionHistory(chatView: ReplayChatView, entries: SessionEntryLike[]): void {
  chatView.displayMessage("\u23ea Restoring session history...");

  let count = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || typeof entry.type !== "string") continue;
    try {
      const handled = replayEntry(chatView, entry);
      if (handled) count++;
    } catch {
      // Defensive: a malformed entry must not abort the whole replay.
      // Logged to console (Forge's logger isn't available here — pure module).
      // eslint-disable-next-line no-console
      console.error(`[session-history] failed to replay entry ${entry.id ?? "?"}:`, entry);
    }
  }

  chatView.displayMessage(`\u2713 Session history restored (${count} entries)`);
}

/** Dispatch a single entry to ChatView. Returns true if the entry was handled. */
function replayEntry(chatView: ReplayChatView, entry: SessionEntryLike): boolean {
  switch (entry.type) {
    case "message": {
      const message = entry.message as any;
      if (!message || typeof message !== "object") return false;
      return replayMessage(chatView, message);
    }
    case "compaction": {
      const summary = (entry.summary as string) ?? "(no summary)";
      chatView.displayMessage(`\u2699 Context compacted: ${summary}`);
      return true;
    }
    case "branch_summary": {
      const summary = (entry.summary as string) ?? "(no summary)";
      chatView.displayMessage(`\u2387 Branch: ${summary}`);
      return true;
    }
    case "thinking_level_change": {
      const level = (entry.thinkingLevel as string) ?? "unknown";
      chatView.displayMessage(`\u2699 Thinking level: ${level}`);
      return true;
    }
    case "model_change": {
      const provider = (entry.provider as string) ?? "unknown";
      const modelId = (entry.modelId as string) ?? "unknown";
      chatView.displayMessage(`\u2699 Model: ${provider}/${modelId}`);
      return true;
    }
    case "session_info": {
      const name = entry.name;
      if (typeof name === "string" && name.length > 0) {
        chatView.displayMessage(`\u2699 Session: ${name}`);
        return true;
      }
      return false;
    }
    case "custom_message": {
      if ((entry.display as boolean) !== true) return false;
      const content = extractTextContent(entry.content);
      const customType = (entry.customType as string) ?? "note";
      chatView.displayMessage(`\u2709 ${customType}: ${content}`);
      return true;
    }
    case "custom":
    case "label":
      // Extension state / user navigation markers — not part of the displayed conversation.
      return false;
    default:
      // Unknown entry type — skip silently rather than crash.
      return false;
  }
}

/** Replay a single message (user / assistant / toolResult) into ChatView. */
function replayMessage(chatView: ReplayChatView, message: any): boolean {
  const role = message?.role;
  if (role === "user") {
    const text = extractTextContent(message.content);
    if (text.length > 0) chatView.displayUserMessage(text);
    return true;
  }
  if (role === "assistant") {
    const content = Array.isArray(message.content) ? message.content : [];
    // One assistant message: walk content blocks, emitting text_delta for text
    // blocks (accumulated by ChatView) and tool_start/tool_end for tool calls.
    // Thinking blocks are skipped (verbose, not part of "essential content").
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "text" && typeof block.text === "string") {
        chatView.handleEvent({ type: "text_delta", delta: block.text });
      } else if (block.type === "toolCall" && typeof block.name === "string") {
        chatView.handleEvent({ type: "tool_start", toolName: block.name });
        chatView.handleEvent({
          type: "tool_end",
          toolName: block.name,
          isError: false,
        });
      }
      // thinking blocks ignored
    }
    // Flush the accumulated text into a single agent message row + add a
    // blank system line as a visual separator (mirrors live behavior).
    chatView.handleEvent({ type: "message_end", role: "assistant" });
    return true;
  }
  if (role === "toolResult") {
    const toolName = (message.toolName as string) ?? "tool";
    const isError = (message.isError as boolean) ?? false;
    const preview = summarizeToolResult(message);
    if (isError) {
      chatView.displayMessage(`\u26a0 ${toolName}: ${preview}`);
    } else {
      chatView.displayMessage(`  \u21b3 ${toolName}: ${preview}`);
    }
    return true;
  }
  // Unknown role — ignore.
  return false;
}
