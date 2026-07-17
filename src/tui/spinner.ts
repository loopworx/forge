const FRAMES = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
const FRAME_DURATION_MS = 80;

export class Spinner {
  private elapsed = 0;

  advance(deltaTimeMs: number): void {
    this.elapsed += deltaTimeMs;
  }

  getFrame(): string {
    const idx = Math.floor(this.elapsed / FRAME_DURATION_MS) % FRAMES.length;
    return FRAMES[idx];
  }

  getLabel(toolName?: string | null): string {
    if (toolName) {
      return `${this.getFrame()} ${toolName}...`;
    }
    return this.getFrame();
  }

  reset(): void {
    this.elapsed = 0;
  }
}

export function getSpinnerFrame(elapsedMs: number): string {
  const idx = Math.floor(elapsedMs / FRAME_DURATION_MS) % FRAMES.length;
  return FRAMES[idx];
}
