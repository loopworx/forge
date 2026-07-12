import type { ProjectState, AgentSessionMeta } from "../engine/types";

export class Sidebar {
  private lines: string[] = [];

  setState(state: ProjectState, sessions: AgentSessionMeta[], phaseName?: string, phaseAgent?: string): void {
    const lines: string[] = [];
    lines.push(" Forge");
    lines.push("─".repeat(28));
    if (state.mode === "inception") {
      lines.push(" Mode: Inception");
      lines.push(` Phase: ${state.inception.currentPhase}/8`);
      if (phaseName) lines.push(` ${phaseName}`);
      if (phaseAgent) lines.push(` (${phaseAgent})`);
    } else {
      lines.push(" Mode: Development");
    }
    lines.push("─".repeat(28));
    if (state.mode === "development") {
      lines.push(` Sessions (${sessions.length}):`);
      if (sessions.length === 0) {
        lines.push("  No active sessions");
      } else {
        for (const s of sessions) {
          lines.push(`  ${s.storyId} ${s.agentRole.replace("-agent", "")} ${s.workflowState}`);
        }
      }
      lines.push("─".repeat(28));
    }
    lines.push(" Guardians: OK");
    this.lines = lines;
  }

  getText(): string[] {
    return [...this.lines];
  }
}
