import { BoxRenderable, TextRenderable, SelectRenderable, SelectRenderableEvents, bold as boldText, t, type SelectOption } from "@opentui/core";
import { THEME } from "./theme";

export interface SelectOverlayOptions {
  title: string;
  options: SelectOption[];
  onSelect?: (value: any) => void;
  onCancel?: () => void;
}

/**
 * Modal overlay that displays a centered SelectRenderable on top of the TUI.
 *
 * Replaces `@inquirer/prompts` `select()` calls inside the TUI render loop.
 * Inquirer's readline-based `select()` fights with OpenTUI for stdin
 * ownership (raw mode toggling), which previously caused `process.exit(0)`
 * to fire on selection (OpenTUI's SIGINT handler in raw mode).
 *
 * The overlay uses OpenTUI's native `SelectRenderable`, which plays nicely
 * with the render loop's input model. SelectRenderable handles arrow-key
 * navigation natively; this class adds ESC-to-cancel and Enter-to-select
 * forwarding (SelectRenderable emits ITEM_SELECTED, which we translate to
 * `confirmSelection()`).
 *
 * Tests can also drive the overlay programmatically via `moveUp()` /
 * `moveDown()` / `confirmSelection()` / `cancel()`.
 */
export class SelectOverlay {
  private overlayBox: BoxRenderable | null = null;
  private select: SelectRenderable | null = null;
  private shown = false;
  private resolved = false;

  constructor(
    private renderer: any,
    private opts: SelectOverlayOptions,
  ) {}

  /** Mount the overlay on the renderer root. */
  show(): void {
    if (this.shown) return;
    this.shown = true;
    const r = this.renderer;

    const box = new BoxRenderable(r, {
      id: "select-overlay",
      flexDirection: "column",
      position: "absolute",
      top: "25%",
      left: "10%",
      width: "80%",
      backgroundColor: THEME.backgroundPanel,
      border: true,
      borderColor: THEME.border,
      zIndex: 100,
      padding: 1,
    });

    box.add(new TextRenderable(r, {
      content: t`${boldText(this.opts.title)}`,
      fg: THEME.primary,
    }));
    box.add(new TextRenderable(r, { content: "", fg: THEME.textMuted }));

    this.select = new SelectRenderable(r, {
      id: "select-overlay-list",
      options: this.opts.options,
      backgroundColor: THEME.backgroundPanel,
      textColor: THEME.text,
      focusedBackgroundColor: THEME.backgroundElement,
      focusedTextColor: THEME.text,
      selectedBackgroundColor: THEME.backgroundElement,
      selectedTextColor: THEME.primary,
      descriptionColor: THEME.textMuted,
      selectedDescriptionColor: THEME.text,
      wrapSelection: true,
      showDescription: true,
      showSelectionIndicator: true,
      flexGrow: 1,
      minHeight: this.opts.options.length * 2 + 1,
    });

    // SelectRenderable emits ITEM_SELECTED on Enter.
    this.select.on(SelectRenderableEvents.ITEM_SELECTED, () => {
      this.confirmSelection();
    });

    // ESC cancels. Forwarded via SelectRenderable's onKeyDown.
    this.select.onKeyDown = (key: any) => {
      if (key && (key.name === "escape" || key.name === "esc" ||
          (key.name === "c" && key.ctrl))) {
        this.cancel();
      }
    };

    box.add(this.select);
    box.add(new TextRenderable(r, {
      content: "ESC to cancel \u00b7 \u2191\u2193 to navigate \u00b7 Enter to select",
      fg: THEME.textMuted,
    }));

    this.renderer.root.add(box);
    this.overlayBox = box;
    this.select.focus();
  }

  /**
   * Convenience: show the overlay and return a Promise that resolves with
   * the selected value (or rejects on cancel). Mounts immediately.
   */
  showAsPromise(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.opts.onSelect = resolve;
      this.opts.onCancel = () => reject(new Error("SelectOverlay cancelled"));
      this.show();
    });
  }

  /** Move selection up by `steps`. */
  moveUp(steps: number = 1): void {
    this.select?.moveUp(steps);
  }

  /** Move selection down by `steps`. */
  moveDown(steps: number = 1): void {
    this.select?.moveDown(steps);
  }

  /** Confirm the currently-focused option. Idempotent (no-op after first call). */
  confirmSelection(): void {
    if (this.resolved) return;
    this.resolved = true;
    const opt = this.select?.getSelectedOption();
    this.destroy();
    this.opts.onSelect?.(opt?.value);
  }

  /** Cancel the overlay. Idempotent. */
  cancel(): void {
    if (this.resolved) return;
    this.resolved = true;
    this.destroy();
    this.opts.onCancel?.();
  }

  /** Returns true if the overlay is currently mounted. */
  isVisible(): boolean {
    return this.shown && !this.resolved;
  }

  /** Returns the current selected option value, if any. */
  getSelectedValue(): any {
    return this.select?.getSelectedOption()?.value;
  }

  private destroy(): void {
    if (this.overlayBox) {
      this.renderer.root.remove(this.overlayBox);
      this.overlayBox.destroy();
      this.overlayBox = null;
    }
    this.select = null;
    this.shown = false;
  }
}
