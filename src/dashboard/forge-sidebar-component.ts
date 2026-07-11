import type { ProjectState, AgentSessionMeta } from "../engine/types";

function shortRole(role: string): string {
  return role.replace("-agent", "");
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  return text.slice(0, width - 3) + "...";
}

export class ForgeSidebarComponent {
  private projectState: ProjectState | null = null;
  private sessions: AgentSessionMeta[] = [];
  private phaseName: string | undefined;
  private phaseAgent: string | undefined;
  private guardianStatus: string = "OK";
  private cachedWidth: number | undefined;
  private cachedLines: string[] = [];

  setState(
    state: ProjectState,
    sessions: AgentSessionMeta[],
    phaseName?: string,
    phaseAgent?: string,
    guardianStatus?: string,
  ): void {
    this.projectState = state;
    this.sessions = sessions;
    this.phaseName = phaseName;
    this.phaseAgent = phaseAgent;
    if (guardianStatus !== undefined) this.guardianStatus = guardianStatus;
    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedWidth === width && this.cachedLines.length > 0) {
      return this.cachedLines;
    }

    const w = Math.max(width, 10);
    const lines: string[] = [];

    lines.push(truncate(" Forge", w));
    lines.push(truncate("─".repeat(w), w));

    if (this.projectState) {
      if (this.projectState.mode === "inception") {
        lines.push(truncate(` Mode: Inception`, w));
        const phase = this.projectState.inception.currentPhase;
        lines.push(truncate(` Phase: ${phase}/8`, w));
        if (this.phaseName) lines.push(truncate(` ${this.phaseName}`, w));
        if (this.phaseAgent) lines.push(truncate(` (${this.phaseAgent})`, w));
      } else {
        lines.push(truncate(` Mode: Development`, w));
      }
    }

    lines.push(truncate("─".repeat(w), w));

    if (this.projectState?.mode === "development") {
      lines.push(truncate(` Sessions (${this.sessions.length}):`, w));
      if (this.sessions.length === 0) {
        lines.push(truncate("  No active sessions", w));
      } else {
        for (const s of this.sessions) {
          const elapsed = Math.floor((Date.now() - s.sessionStartTime) / 1000);
          const line = `  ${s.storyId} ${shortRole(s.agentRole).padEnd(4)} ${formatElapsed(elapsed)} ${s.workflowState}`;
          lines.push(truncate(line, w));
        }
      }
      lines.push(truncate("─".repeat(w), w));
    }

    lines.push(truncate(` Guardians: ${this.guardianStatus}`, w));

    while (lines.length < 10) {
      lines.push("");
    }

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = [];
  }
}
