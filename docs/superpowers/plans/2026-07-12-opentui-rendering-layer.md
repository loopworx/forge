# OpenTUI Rendering Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the actual OpenTUI-based full-screen TUI — conversation rendering with markdown, multi-line input with slash command autocomplete, session tab bar, and the top-level app controller that wires agent events to the TUI.

**Architecture:** The existing foundation (agent layer + logic-only TUI components) is already built and tested. This plan adds OpenTUI renderable components on top: renderer.ts (createCliRenderer), chat-view.ts (ScrollBox + Markdown), input-bar.ts (InputRenderable + autocomplete), tab-bar.ts (session tabs), and app.ts (top-level controller). The existing theme.ts, status-bar.ts, and sidebar.ts are wrapped in OpenTUI renderables or used directly.

**Tech Stack:** OpenTUI (@opentui/core), pi-coding-agent SDK, Bun, TypeScript strict mode. All TUI tests use createTestRenderer from @opentui/core/testing.

## Global Constraints

- Bun runtime, TypeScript strict mode (noEmit: true, skipLibCheck: true)
- ALL TUI tests use createTestRenderer from @opentui/core/testing — no real terminal, deterministic
- OpenTUI imports from @opentui/core (single package, exports everything)
- Key OpenTUI components: Box, Text, ScrollBox, Input, Select, MarkdownRenderable, createCliRenderer
- OpenTUI layout uses Yoga flexbox (flexDirection, flexGrow, width, height, padding, gap)
- Existing ForgeEvent type at src/agent/event-adapter.ts is the event union consumed by the TUI
- Existing AgentSessionManager at src/agent/session-manager.ts implements SessionManager
- Existing CommandRegistry at src/agent/command-registry.ts provides slash command lookup
- Existing Sidebar at src/tui/sidebar.ts provides text lines for sidebar content
- Existing StatusBar at src/tui/status-bar.ts provides formatted status text
- Existing THEME and AGENT_COLORS at src/tui/theme.ts provide color constants
- TDD: RED to GREEN to REFACTOR for every task
- Frequent commits after each passing test

---

## Task 1: ChatView — conversation rendering with ScrollBox

**Files:**
- Create: `src/tui/chat-view.ts`
- Test: `tests/tui/chat-view.test.ts`

**Interfaces:**
- Consumes: ForgeEvent from src/agent/event-adapter.ts, THEME from src/tui/theme.ts
- Produces: ChatView class with handleEvent(event: ForgeEvent): void, mount(renderer): ScrollBoxRenderable, getCurrentToolName(): string | null

- [ ] **Step 1: Write the failing test**

```typescript
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
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 20 });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tui/chat-view.test.ts`
Expected: FAIL — "Cannot find module '../../src/tui/chat-view'"

- [ ] **Step 3: Write minimal implementation**

Create `src/tui/chat-view.ts`:

```typescript
import type { ForgeEvent } from "../agent/event-adapter";
import { THEME } from "./theme";
import { ScrollBoxRenderable, TextRenderable } from "@opentui/core";

export class ChatView {
  private scrollbox: ScrollBoxRenderable | null = null;
  private lines: string[] = [];
  private currentAgentText = "";
  private currentToolName: string | null = null;

  mount(renderer: any): ScrollBoxRenderable {
    this.scrollbox = new ScrollBoxRenderable(renderer, {
      id: "chat-view",
      flexGrow: 1,
      minHeight: 0,
      stickyScroll: true,
      stickyStart: "bottom",
      flexDirection: "column",
    });
    this.updateContent();
    return this.scrollbox;
  }

  handleEvent(event: ForgeEvent): void {
    switch (event.type) {
      case "text_delta":
        this.currentAgentText += event.delta;
        break;
      case "message_end":
        this.flushAgentText();
        this.lines.push("");
        break;
      case "tool_start":
        this.flushAgentText();
        this.currentToolName = event.toolName;
        break;
      case "tool_end":
        this.flushAgentText();
        if (event.isError) {
          this.lines.push(`\u2717 ${event.toolName} failed`);
        }
        this.currentToolName = null;
        break;
      case "agent_error":
        this.flushAgentText();
        this.lines.push(`\u2717 ${event.message}`);
        break;
      case "agent_settled":
        break;
    }
    this.updateContent();
  }

  getCurrentToolName(): string | null {
    return this.currentToolName;
  }

  private flushAgentText(): void {
    if (this.currentAgentText.length > 0) {
      this.lines.push(this.currentAgentText);
      this.currentAgentText = "";
    }
  }

  private updateContent(): void {
    if (!this.scrollbox) return;
    this.scrollbox.content.clear();

    const allLines = [...this.lines];
    if (this.currentAgentText) allLines.push(this.currentAgentText);
    if (this.currentToolName) allLines.push(`\u2699 ${this.currentToolName}...`);

    if (allLines.length === 0) {
      const placeholder = new TextRenderable(this.scrollbox.ctx, {
        content: " (waiting for agent output...)",
        fg: THEME.textMuted,
      });
      this.scrollbox.content.add(placeholder);
    } else {
      for (const line of allLines) {
        const text = new TextRenderable(this.scrollbox.ctx, {
          content: line,
          fg: line.startsWith("\u2717") ? THEME.error : THEME.text,
        });
        this.scrollbox.content.add(text);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/tui/chat-view.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/chat-view.ts tests/tui/chat-view.test.ts
git commit -m "feat: chat view with ScrollBox, streaming text, tool spinner"
```

---

## Task 2: InputBar — input with slash command autocomplete

**Files:**
- Create: `src/tui/input-bar.ts`
- Test: `tests/tui/input-bar.test.ts`

**Interfaces:**
- Consumes: CommandRegistry from src/agent/command-registry.ts, THEME from src/tui/theme.ts
- Produces: InputBar class with mount(renderer): BoxRenderable, setOnSend(handler), setOnCommand(handler), focus()

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { InputBar } from "../../src/tui/input-bar";
import { CommandRegistry } from "../../src/agent/command-registry";

describe("InputBar", () => {
  it("renders input field", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 10 });
    const commands = new CommandRegistry();
    const bar = new InputBar(commands);
    bar.mount(renderer);
    await renderOnce();
    expect(captureCharFrame().length).toBeGreaterThan(0);
  });

  it("shows autocomplete when typing /", async () => {
    const { renderer, renderOnce, captureCharFrame, mockInput } = await createTestRenderer({ width: 60, height: 15 });
    const commands = new CommandRegistry();
    commands.register("forge-new", async () => {});
    commands.register("forge-next", async () => {});
    const bar = new InputBar(commands);
    bar.mount(renderer);
    bar.focus();
    mockInput({ name: "/" });
    await renderOnce();
    expect(captureCharFrame()).toContain("forge-new");
    expect(captureCharFrame()).toContain("forge-next");
  });

  it("Enter sends message via onSend", async () => {
    const { renderer, renderOnce, mockInput } = await createTestRenderer({ width: 60, height: 10 });
    const commands = new CommandRegistry();
    const bar = new InputBar(commands);
    let sent: any = null;
    bar.setOnSend((text: string) => { sent = text; });
    bar.mount(renderer);
    bar.focus();
    mockInput({ name: "h" });
    mockInput({ name: "i" });
    mockInput({ name: "return" });
    await renderOnce();
    expect(sent).toBe("hi");
  });

  it("Enter on /forge-new calls onCommand", async () => {
    const { renderer, renderOnce, mockInput } = await createTestRenderer({ width: 60, height: 15 });
    const commands = new CommandRegistry();
    commands.register("forge-new", async () => {});
    const bar = new InputBar(commands);
    let cmdName: any = null;
    bar.setOnCommand((name: string) => { cmdName = name; });
    bar.mount(renderer);
    bar.focus();
    for (const ch of "/forge-new") mockInput({ sequence: ch });
    mockInput({ name: "return" });
    await renderOnce();
    expect(cmdName).toBe("forge-new");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tui/input-bar.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `src/tui/input-bar.ts`:

```typescript
import { InputRenderable, InputRenderableEvents, BoxRenderable, TextRenderable } from "@opentui/core";
import type { CommandRegistry } from "../agent/command-registry";
import { THEME } from "./theme";

const MAX_AUTOCOMPLETE = 5;

export class InputBar {
  private input: InputRenderable | null = null;
  private container: any = null;
  private autocompleteBox: any = null;
  private onSend: ((text: string) => void) | null = null;
  private onCommand: ((name: string, args: string) => void) | null = null;

  constructor(private commands: CommandRegistry) {}

  mount(renderer: any): any {
    const container = new BoxRenderable(renderer, {
      id: "input-bar-container",
      flexDirection: "column",
      flexShrink: 0,
    });

    this.autocompleteBox = new BoxRenderable(renderer, {
      id: "autocomplete",
      flexDirection: "column",
      visible: false,
    });
    container.add(this.autocompleteBox);

    this.input = new InputRenderable(renderer, {
      id: "input",
      width: "100%",
      placeholder: "Type a message or / for commands...",
    });

    this.input.on(InputRenderableEvents.INPUT, () => {
      this.updateAutocomplete();
    });

    this.input.on(InputRenderableEvents.ENTER, (value: string) => {
      this.handleSubmit(value);
    });

    container.add(this.input);
    this.container = container;
    return container;
  }

  focus(): void {
    this.input?.focus();
  }

  setOnSend(handler: (text: string) => void): void {
    this.onSend = handler;
  }

  setOnCommand(handler: (name: string, args: string) => void): void {
    this.onCommand = handler;
  }

  private updateAutocomplete(): void {
    if (!this.input || !this.autocompleteBox) return;
    const value = this.input.value;

    if (!value.startsWith("/")) {
      this.autocompleteBox.visible = false;
      return;
    }

    const prefix = value.slice(1).toLowerCase();
    const items = this.commands.filterByPrefix(prefix).slice(0, MAX_AUTOCOMPLETE);

    if (items.length === 0) {
      this.autocompleteBox.visible = false;
      return;
    }

    this.autocompleteBox.content.clear();
    for (const item of items) {
      const text = new TextRenderable(this.autocompleteBox.ctx, {
        content: `  /${item}`,
        fg: THEME.textMuted,
      });
      this.autocompleteBox.content.add(text);
    }
    this.autocompleteBox.visible = true;
  }

  private handleSubmit(value: string): void {
    const text = value.trim();
    if (!text) return;

    if (text.startsWith("/")) {
      const sp = text.indexOf(" ");
      const name = sp > 0 ? text.slice(1, sp) : text.slice(1);
      const args = sp > 0 ? text.slice(sp + 1) : "";
      this.onCommand?.(name, args);
    } else {
      this.onSend?.(text);
    }

    if (this.input) this.input.value = "";
    this.updateAutocomplete();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/tui/input-bar.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/input-bar.ts tests/tui/input-bar.test.ts
git commit -m "feat: input bar with slash command autocomplete"
```

---

## Task 3: TabBar — session tabs for development mode

**Files:**
- Create: `src/tui/tab-bar.ts`
- Test: `tests/tui/tab-bar.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { TabBar } from "../../src/tui/tab-bar";

describe("TabBar", () => {
  it("renders empty when no tabs", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 60, height: 5 });
    const bar = new TabBar();
    bar.mount(renderer);
    await renderOnce();
    expect(captureCharFrame().length).toBeGreaterThan(0);
  });

  it("renders tabs with labels", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 5 });
    const bar = new TabBar();
    bar.mount(renderer);
    bar.setTabs([
      { sessionId: "s1", label: "FOR-5 dev" },
      { sessionId: "s2", label: "FOR-8 qa" },
    ]);
    bar.setSelected("s1");
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("FOR-5");
    expect(frame).toContain("FOR-8");
  });

  it("shows auto/manual indicator", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 5 });
    const bar = new TabBar();
    bar.mount(renderer);
    bar.setTabs([{ sessionId: "s1", label: "FOR-5" }]);
    bar.setAutoCycling(true);
    await renderOnce();
    expect(captureCharFrame()).toContain("auto");
    bar.setAutoCycling(false);
    await renderOnce();
    expect(captureCharFrame()).toContain("manual");
  });

  it("cycleNext advances selected", () => {
    const bar = new TabBar();
    bar.setTabs([
      { sessionId: "s1", label: "FOR-5" },
      { sessionId: "s2", label: "FOR-8" },
    ]);
    bar.setSelected("s1");
    bar.cycleNext();
    expect(bar.getSelectedId()).toBe("s2");
    bar.cycleNext();
    expect(bar.getSelectedId()).toBe("s1");
  });

  it("cyclePrev goes backward", () => {
    const bar = new TabBar();
    bar.setTabs([
      { sessionId: "s1", label: "FOR-5" },
      { sessionId: "s2", label: "FOR-8" },
    ]);
    bar.setSelected("s1");
    bar.cyclePrev();
    expect(bar.getSelectedId()).toBe("s2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tui/tab-bar.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `src/tui/tab-bar.ts`:

```typescript
import { BoxRenderable, TextRenderable } from "@opentui/core";
import { THEME } from "./theme";

interface Tab {
  sessionId: string;
  label: string;
}

export class TabBar {
  private container: any = null;
  private tabs: Tab[] = [];
  private selectedId: string | null = null;
  private autoCycling = true;

  mount(renderer: any): any {
    this.container = new BoxRenderable(renderer, {
      id: "tab-bar",
      flexDirection: "row",
      flexShrink: 0,
      gap: 2,
    });
    this.renderTabs();
    return this.container;
  }

  setTabs(tabs: Tab[]): void {
    this.tabs = tabs;
    if (this.selectedId && !tabs.find(t => t.sessionId === this.selectedId)) {
      this.selectedId = tabs.length > 0 ? tabs[0].sessionId : null;
    } else if (!this.selectedId && tabs.length > 0) {
      this.selectedId = tabs[0].sessionId;
    }
    this.renderTabs();
  }

  setSelected(id: string): void {
    this.selectedId = id;
    this.renderTabs();
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  setAutoCycling(auto: boolean): void {
    this.autoCycling = auto;
    this.renderTabs();
  }

  cycleNext(): void {
    if (this.tabs.length === 0) return;
    const idx = this.tabs.findIndex(t => t.sessionId === this.selectedId);
    const next = (idx + 1) % this.tabs.length;
    this.selectedId = this.tabs[next].sessionId;
    this.renderTabs();
  }

  cyclePrev(): void {
    if (this.tabs.length === 0) return;
    const idx = this.tabs.findIndex(t => t.sessionId === this.selectedId);
    const prev = (idx - 1 + this.tabs.length) % this.tabs.length;
    this.selectedId = this.tabs[prev].sessionId;
    this.renderTabs();
  }

  private renderTabs(): void {
    if (!this.container) return;
    this.container.content.clear();

    for (const tab of this.tabs) {
      const isSelected = tab.sessionId === this.selectedId;
      const marker = isSelected ? "*" : " ";
      const text = new TextRenderable(this.container.ctx, {
        content: `${marker}${tab.label}`,
        fg: isSelected ? THEME.text : THEME.textMuted,
      });
      this.container.add(text);
    }

    const modeLabel = this.autoCycling ? "(auto)" : "(manual)";
    const mode = new TextRenderable(this.container.ctx, {
      content: `  ${modeLabel}`,
      fg: THEME.textMuted,
    });
    this.container.add(mode);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/tui/tab-bar.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/tab-bar.ts tests/tui/tab-bar.test.ts
git commit -m "feat: tab bar with session tabs, auto/manual cycling"
```

---

## Task 4: App controller — top-level layout, mode switching, event wiring

**Files:**
- Create: `src/tui/app.ts`
- Test: `tests/tui/app.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { ForgeApp } from "../../src/tui/app";

describe("ForgeApp", () => {
  it("renders inception mode layout", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 1, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const mockCommands = { getAll: () => [], filterByPrefix: () => [] } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: mockCommands, mode: "inception" });
    app.layout();
    await renderOnce();
    const frame = captureCharFrame();
    expect(frame).toContain("Inception");
    expect(frame).toContain("Forge");
  });

  it("renders development mode with tab bar", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "development", inception: { mode: "development", currentPhase: 8, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [{ sessionId: "s1", storyId: "FOR-5", agentRole: "developer-agent", workflowState: "in-dev", sessionStartTime: Date.now(), isRecovery: false }],
    } as any;
    const mockCommands = { getAll: () => [], filterByPrefix: () => [] } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: mockCommands, mode: "development" });
    app.layout();
    await renderOnce();
    expect(captureCharFrame()).toContain("Development");
  });

  it("handles text_delta events", async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 100, height: 30 });
    const mockEngine = {
      getProjectState: () => ({ mode: "inception", inception: { mode: "inception", currentPhase: 1, phaseSessionId: null, artifacts: {} } }),
      getActiveSessions: () => [],
    } as any;
    const app = new ForgeApp({ renderer, engine: mockEngine, sessions: {} as any, commands: {} as any, mode: "inception" });
    app.layout();
    app.handleForgeEvent({ type: "text_delta", delta: "Hello from agent" });
    await renderOnce();
    expect(captureCharFrame()).toContain("Hello from agent");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tui/app.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `src/tui/app.ts`:

```typescript
import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { ForgeEvent } from "../agent/event-adapter";
import { ChatView } from "./chat-view";
import { InputBar } from "./input-bar";
import { TabBar } from "./tab-bar";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { THEME } from "./theme";
import type { WorkflowEngine } from "../engine/workflow-engine";
import type { AgentSessionManager } from "../agent/session-manager";
import type { CommandRegistry } from "../agent/command-registry";

export interface ForgeAppOptions {
  renderer: any;
  engine: WorkflowEngine;
  sessions: AgentSessionManager;
  commands: CommandRegistry;
  mode: "inception" | "development";
}

export class ForgeApp {
  private chatView: ChatView;
  private inputBar: InputBar;
  private tabBar: TabBar;
  private sidebar: Sidebar;
  private statusBar: StatusBar;

  constructor(private opts: ForgeAppOptions) {
    this.chatView = new ChatView();
    this.inputBar = new InputBar(opts.commands);
    this.tabBar = new TabBar();
    this.sidebar = new Sidebar();
    this.statusBar = new StatusBar();
  }

  layout(): void {
    const renderer = this.opts.renderer;
    const state = this.opts.engine.getProjectState();
    const sessions = this.opts.engine.getActiveSessions();

    const root = new BoxRenderable(renderer, {
      id: "forge-root",
      flexDirection: "row",
      width: "100%",
      height: "100%",
      flexGrow: 1,
      backgroundColor: THEME.backgroundPanel,
    });

    const mainColumn = new BoxRenderable(renderer, {
      id: "main-column",
      flexDirection: "column",
      flexGrow: 1,
      minHeight: 0,
    });

    if (state.mode === "development") {
      mainColumn.add(this.tabBar.mount(renderer));
    }

    mainColumn.add(this.chatView.mount(renderer));
    mainColumn.add(this.inputBar.mount(renderer));

    const statusText = new TextRenderable(renderer, {
      content: this.statusBar.getText(),
      fg: THEME.textMuted,
    });
    mainColumn.add(statusText);

    root.add(mainColumn);

    const sidebarBox = new BoxRenderable(renderer, {
      id: "sidebar",
      width: 28,
      height: "100%",
      flexDirection: "column",
      backgroundColor: THEME.backgroundPanel,
      border: ["left"],
      borderColor: THEME.border,
    });

    this.sidebar.setState(state, sessions);
    for (const line of this.sidebar.getText()) {
      sidebarBox.add(new TextRenderable(renderer, { content: line, fg: THEME.text }));
    }
    root.add(sidebarBox);

    renderer.root.add(root);
  }

  handleForgeEvent(event: ForgeEvent): void {
    this.chatView.handleEvent(event);
  }

  handleEngineEvent(event: any): void {
    const state = this.opts.engine.getProjectState();
    this.sidebar.setState(state, this.opts.engine.getActiveSessions());
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/tui/app.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tui/app.ts tests/tui/app.test.ts
git commit -m "feat: app controller with layout, mode switching, event wiring"
```

---

## Task 5: Wire TUI launch in bin/forge.ts + create renderer.ts

**Files:**
- Create: `src/tui/renderer.ts`
- Modify: `bin/forge.ts` (replace TUI launch stub)

- [ ] **Step 1: Create `src/tui/renderer.ts`**

```typescript
import { createCliRenderer } from "@opentui/core";

export async function createForgeRenderer() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: "alternate-screen",
    targetFps: 30,
    backgroundColor: "transparent",
  });
  return renderer;
}
```

- [ ] **Step 2: Update `bin/forge.ts` TUI launch section**

Replace the stub that says "Launching Forge TUI... (not yet implemented)" with dynamic imports of ForgeApp, createForgeRenderer, and all engine/agent modules. Wire engine events to app.handleEngineEvent(), start polling if development mode.

- [ ] **Step 3: Run typecheck** — `tsc --noEmit`

- [ ] **Step 4: Run all tests** — `bun test`

- [ ] **Step 5: Build** — `bun run build`

- [ ] **Step 6: Commit**

```bash
git add src/tui/renderer.ts bin/forge.ts
git commit -m "feat: wire TUI launch in forge CLI"
```

---

## Task 6: Full test suite + lint + typecheck + build + push

- [ ] **Step 1:** `bun test` — all pass
- [ ] **Step 2:** `tsc --noEmit` — 0 errors
- [ ] **Step 3:** `npx oxlint src/ tests/ bin/` — 0 warnings
- [ ] **Step 4:** `bun run build` — dist/forge.js created
- [ ] **Step 5:** `git push origin main`
- [ ] **Step 6:** Verify CI green
