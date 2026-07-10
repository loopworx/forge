import type { AgentPanel } from "./split-layout";

interface OutputEntry {
  text: string;
  timestamp: number;
}

export class ForgeAgentPanel implements AgentPanel {
  private outputs: OutputEntry[] = [];
  private activeSessionId: string | null = null;
  private cycleIndex = 0;
  private paused = false;

  pushOutput(text: string): void {
    this.outputs.push({ text, timestamp: Date.now() });
  }

  setActiveSession(id: string | null): void {
    this.activeSessionId = id;
  }

  clear(): void {
    this.outputs = [];
    this.activeSessionId = null;
    this.cycleIndex = 0;
  }

  cycleNext(): void {
    if (!this.paused && this.outputs.length > 1) {
      this.cycleIndex = (this.cycleIndex + 1) % this.outputs.length;
    }
  }

  cyclePause(): void {
    this.paused = true;
  }

  cycleResume(): void {
    this.paused = false;
  }

  render(width: number): string[] {
    const lines: string[] = [];
    const w = Math.max(width, 10);

    if (this.activeSessionId) {
      lines.push(` Session: ${this.activeSessionId}`.slice(0, w).padEnd(w));
      lines.push("".padEnd(w, "\u2500"));
    }

    if (this.outputs.length === 0) {
      lines.push(" No agent output".padEnd(w));
    } else {
      const entry = this.outputs[this.cycleIndex] ?? this.outputs[this.outputs.length - 1];
      const time = new Date(entry.timestamp).toLocaleTimeString();
      lines.push(` [${time}]`.slice(0, w).padEnd(w));
      const textLines = entry.text.split("\n");
      for (const tl of textLines) {
        lines.push(` ${tl}`.slice(0, w).padEnd(w));
      }
    }

    if (this.outputs.length > 1) {
      lines.push("");
      const status = this.paused ? "(paused)" : "(auto-cycling)";
      lines.push(` ${this.cycleIndex + 1}/${this.outputs.length} ${status}`.slice(0, w).padEnd(w));
    }

    while (lines.length < 15) {
      lines.push("".padEnd(w));
    }

    return lines;
  }

  handleInput(_data: string): void {}

  invalidate(): void {}
}
