import type { AgentRole } from "./types";

export function parseSessionTitle(title: string): { storyId: string; agentName: AgentRole; isRecovery: boolean } | null {
  const match = title.match(/^FORGE:\s+([A-Z]+-\d+)\s+—\s+(\S+?)(?:\s+\(recovery\))?$/);
  if (!match) return null;
  return {
    storyId: match[1],
    agentName: match[2] as AgentRole,
    isRecovery: title.includes("(recovery)"),
  };
}
