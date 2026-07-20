import { InputRenderable, InputRenderableEvents, BoxRenderable, TextRenderable } from "@opentui/core";
import type { CommandRegistry } from "../agent/command-registry";
import { THEME } from "./theme";

const MAX_AUTOCOMPLETE = 5;

export class InputBar {
  private input: InputRenderable | null = null;
  private container: BoxRenderable | null = null;
  private autocompleteBox: BoxRenderable | null = null;
  private onSend: ((text: string) => void) | null = null;
  private onCommand: ((name: string, args: string) => void) | null = null;

  constructor(private commands: CommandRegistry) {}

  mount(renderer: any): BoxRenderable {
    const container = new BoxRenderable(renderer, {
      id: "input-bar-container",
      flexDirection: "column",
      flexShrink: 0,
      paddingLeft: 1,
      paddingRight: 1,
    });

    this.autocompleteBox = new BoxRenderable(renderer, {
      id: "autocomplete",
      flexDirection: "column",
      visible: false,
    });
    container.add(this.autocompleteBox);

    const inputWrapper = new BoxRenderable(renderer, {
      id: "input-wrapper",
      flexDirection: "row",
      flexShrink: 0,
      width: "100%",
      // 2x the original height: minHeight 3→6, paddingY 1→2.
      // Total visual height = 6 (content) + 4 (padding) = 10 rows,
      // exactly 2x the original 5 rows (3 + 2).
      minHeight: 6,
      border: ["left"],
      borderColor: THEME.peach,
      backgroundColor: THEME.backgroundElement,
      paddingLeft: 1,
      paddingY: 2,
    });

    const promptIcon = new TextRenderable(renderer, {
      content: "\u276f",
      fg: THEME.peach,
    });
    inputWrapper.add(promptIcon);

    this.input = new InputRenderable(renderer, {
      id: "input",
      flexGrow: 1,
      placeholder: "Type a message or / for commands...",
    });

    this.input.on(InputRenderableEvents.INPUT, () => {
      this.updateAutocomplete();
    });

    this.input.on(InputRenderableEvents.ENTER, (value: string) => {
      this.handleSubmit(value);
    });

    inputWrapper.add(this.input);
    container.add(inputWrapper);
    this.container = container;
    renderer.root.add(container);
    return container;
  }

  focus(): void {
    this.input?.focus();
  }

  setInput(text: string): void {
    if (this.input) {
      this.input.value = text;
      this.updateAutocomplete();
    }
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

    const content = this.autocompleteBox;
    const oldChildren = [...content.getChildren()];
    for (const child of oldChildren) {
      child.destroyRecursively();
    }
    for (const item of items) {
      const text = new TextRenderable(content.ctx, {
        content: `  /${item}`,
        fg: THEME.textMuted,
      });
      content.add(text);
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
