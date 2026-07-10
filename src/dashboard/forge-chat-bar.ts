import type { DashboardComponent } from "../engine/interfaces";

export class ForgeChatBar implements DashboardComponent {
  private input = "";
  private submitHandler: ((text: string) => void) | null = null;

  onSubmit(handler: (text: string) => void): void {
    this.submitHandler = handler;
  }

  render(width: number): string[] {
    const w = Math.max(width, 10);
    const display = this.input.length > 0
      ? ` > ${this.input}`
      : " > ";
    return [display.slice(0, w).padEnd(w)];
  }

  handleInput(data: string): void {
    if (data === "\r" || data === "\n") {
      if (this.input.trim()) {
        const text = this.input;
        this.input = "";
        this.submitHandler?.(text);
      }
      return;
    }

    if (data === "\x7f" || data === "\b") {
      this.input = this.input.slice(0, -1);
      return;
    }

    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.input += data;
    }
  }

  invalidate(): void {
    this.input = "";
  }
}
