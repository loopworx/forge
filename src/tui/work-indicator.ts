import { BoxRenderable, TextRenderable } from "@opentui/core";
import { THEME } from "./theme";
import { Spinner } from "./spinner";

const GEAR_ICON = "\u2699";

/**
 * Work indicator: a gear icon + braille spinner + "AI is working" text +
 * "ESC to stop" hint, shown below the input bar when the AI is active.
 *
 * Separate from the ChatView spinner (which stays in the chat scroll area)
 * — this is a fixed-position indicator that never scrolls out of view and
 * also shows the ESC-to-stop hint.
 *
 * The spinner is driven by a `setInterval` (80ms) that advances the
 * `Spinner` and updates the spinner text's `content` (the content setter
 * triggers `requestRender()` regardless of viewport culling).
 */
export class WorkIndicator {
  private container: BoxRenderable | null = null;
  private spinner = new Spinner();
  private spinnerText: TextRenderable | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private working = false;
  private currentToolName: string | null = null;
  private static readonly INTERVAL_MS = 80;

  mount(renderer: any): BoxRenderable {
    const container = new BoxRenderable(renderer, {
      id: "work-indicator",
      flexDirection: "row",
      flexShrink: 0,
      width: "100%",
      paddingLeft: 1,
      visible: false,
    });

    this.container = container;
    this.spinnerText = new TextRenderable(renderer, {
      content: `${GEAR_ICON} AI is working`,
      fg: THEME.spinner,
    });
    container.add(this.spinnerText);

    const hint = new TextRenderable(renderer, {
      content: "  ESC to stop",
      fg: THEME.textMuted,
    });
    container.add(hint);

    renderer.root.add(container);
    return container;
  }

  setWorking(working: boolean, toolName?: string | null): void {
    this.working = working;
    this.currentToolName = toolName ?? null;
    if (this.container) {
      this.container.visible = working;
    }
    if (working) {
      this.spinner.reset();
      this.startInterval();
      this.updateLabel();
    } else {
      this.stopInterval();
    }
  }

  isVisible(): boolean {
    return this.working;
  }

  dispose(): void {
    this.stopInterval();
  }

  private startInterval(): void {
    if (this.interval !== null) return;
    this.interval = setInterval(() => {
      this.spinner.advance(WorkIndicator.INTERVAL_MS);
      this.updateLabel();
    }, WorkIndicator.INTERVAL_MS);
  }

  private stopInterval(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private updateLabel(): void {
    if (!this.spinnerText) return;
    const frame = this.spinner.getFrame();
    const text = this.currentToolName
      ? `${GEAR_ICON} ${frame} ${this.currentToolName}`
      : `${GEAR_ICON} ${frame} AI is working`;
    this.spinnerText.content = text;
  }
}
