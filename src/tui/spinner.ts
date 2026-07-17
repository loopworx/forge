const FRAMES = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
const FRAME_DURATION_MS = 80;

const DOTS = [".", "..", "..."];

export class Spinner {
  private elapsed = 0;
  private dotIndex = 0;

  advance(deltaTimeMs: number): void {
    this.elapsed += deltaTimeMs;
  }

  getFrame(): string {
    const idx = Math.floor(this.elapsed / FRAME_DURATION_MS) % FRAMES.length;
    return FRAMES[idx];
  }

  /**
   * Returns the next dot cycle: "." → ".." → "..." → "." (loops).
   * Each call advances the dot counter — so callers that want each render
   * to show the *next* dot stage must call this once per frame.
   */
  getDots(): string {
    const current = DOTS[this.dotIndex % DOTS.length];
    this.dotIndex = (this.dotIndex + 1) % DOTS.length;
    return current;
  }

  getLabel(toolName?: string | null): string {
    const frame = this.getFrame();
    if (toolName) {
      return `${frame} ${toolName}...`;
    }
    return `${frame} Thinking${this.getDots()}`;
  }

  reset(): void {
    this.elapsed = 0;
    this.dotIndex = 0;
  }
}

export function getSpinnerFrame(elapsedMs: number): string {
  const idx = Math.floor(elapsedMs / FRAME_DURATION_MS) % FRAMES.length;
  return FRAMES[idx];
}
