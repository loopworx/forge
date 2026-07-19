/**
 * Braille spinner for the TUI.
 *
 * Pure functions (`SPINNER_FRAMES`, `FRAME_DURATION_MS`, `getSpinnerFrame`,
 * `formatThinkingLabel`, `formatToolLabel`) are exported for direct unit
 * testing. The stateful `Spinner` class is a thin wrapper that tracks
 * elapsed time and delegates label formatting to the pure functions.
 */

export const SPINNER_FRAMES: string[] = [
  "\u280b", "\u2819", "\u2839", "\u2838", "\u283c",
  "\u2834", "\u2826", "\u2827", "\u2807", "\u280f",
];

export const FRAME_DURATION_MS = 80;

/**
 * Return the braille frame for the given elapsed time (ms). Wraps around
 * the 10-frame cycle. Pure — no state.
 */
export function getSpinnerFrame(elapsedMs: number): string {
  const idx = Math.floor(elapsedMs / FRAME_DURATION_MS) % SPINNER_FRAMES.length;
  return SPINNER_FRAMES[idx];
}

/**
 * Format the "Thinking" label for a given braille frame. Pure.
 * No animated dots — the spinner frame itself provides the animation.
 */
export function formatThinkingLabel(frame: string): string {
  return `${frame} Thinking`;
}

/**
 * Format the tool label for a given braille frame + tool name. Pure.
 * No trailing "..." — the spinner frame provides the animation.
 */
export function formatToolLabel(frame: string, toolName: string): string {
  return `${frame} ${toolName}`;
}

/**
 * Stateful spinner that tracks elapsed time and renders labels via the
 * pure functions above. Used by ChatView and WorkIndicator.
 */
export class Spinner {
  private elapsed = 0;

  advance(deltaTimeMs: number): void {
    this.elapsed += deltaTimeMs;
  }

  getFrame(): string {
    return getSpinnerFrame(this.elapsed);
  }

  getLabel(toolName?: string | null): string {
    const frame = this.getFrame();
    if (toolName) {
      return formatToolLabel(frame, toolName);
    }
    return formatThinkingLabel(frame);
  }

  reset(): void {
    this.elapsed = 0;
  }
}
