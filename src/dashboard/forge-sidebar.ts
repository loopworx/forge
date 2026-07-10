import type { Sidebar } from "./split-layout";
import type { SessionInfo, Transition } from "../engine/types";

function shortRole(role: string): string {
  return role.replace("-agent", "");
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export class ForgeSidebar implements Sidebar {
  private sessions: SessionInfo[] = [];
  private transitions: Transition[] = [];
  private guardianStatus = "OK";
  private selectedIndex = 0;

  setSessions(sessions: SessionInfo[]): void {
    this.sessions = sessions;
  }

  setTransitions(transitions: Transition[]): void {
    this.transitions = transitions.slice(-10);
  }

  setGuardianStatus(status: string): void {
    this.guardianStatus = status;
  }

  render(width: number): string[] {
    const lines: string[] = [];
    const w = Math.max(width, 10);

    lines.push(" Forge".padEnd(w));
    lines.push("".padEnd(w, "\u2500"));

    lines.push(" Sessions".padEnd(w));
    if (this.sessions.length === 0) {
      lines.push(" No active sessions".padEnd(w));
    } else {
      for (let i = 0; i < this.sessions.length; i++) {
        const s = this.sessions[i];
        const prefix = i === this.selectedIndex ? ">" : " ";
        const busy = s.isBusy ? "*" : " ";
        const line = ` ${prefix}${busy} ${s.storyId} ${shortRole(s.agentRole).padEnd(4)} ${formatElapsed(s.elapsedTime)}`;
        lines.push(line.slice(0, w).padEnd(w));
      }
    }

    lines.push("".padEnd(w));

    lines.push(" Guardians".padEnd(w));
    lines.push(` Status: ${this.guardianStatus}`.slice(0, w).padEnd(w));

    lines.push("".padEnd(w));

    if (this.transitions.length > 0) {
      lines.push(" Recent".padEnd(w));
      for (const t of this.transitions.slice(-5)) {
        lines.push(` ${t.storyId}: ${t.toState}`.slice(0, w).padEnd(w));
      }
    }

    while (lines.length < 20) {
      lines.push("".padEnd(w));
    }

    return lines;
  }

  handleInput(data: string): void {
    if (data === "\x1b[A" && this.sessions.length > 0) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    }
    if (data === "\x1b[B" && this.sessions.length > 0) {
      this.selectedIndex = Math.min(this.sessions.length - 1, this.selectedIndex + 1);
    }
  }

  invalidate(): void {}
}
