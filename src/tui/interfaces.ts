/**
 * TUI layer interfaces — minimal surfaces the ForgeApp depends on.
 *
 * These exist so the TUI can be tested and extended without depending on
 * concrete engine/session/command classes. `bin/forge.ts` passes concrete
 * instances that satisfy these interfaces; tests pass mock objects.
 */

/** Minimal project state shape the TUI reads from the engine. */
export interface ProjectState {
  mode: "inception" | "development";
  inception: {
    mode: "inception" | "development";
    currentPhase: number;
    phaseSessionId: string | null;
    artifacts: Record<number, string>;
  };
}

/** Provider for project state + active sessions + inception phase info. */
export interface ProjectStateProvider {
  getProjectState(): ProjectState;
  getActiveSessions(): Array<{
    sessionId: string;
    agentRole: string;
    storyId: string;
    workflowState?: string;
    sessionStartTime?: number;
    isRecovery?: boolean;
  }>;
  getInceptionPhaseInfo?(phaseIndex?: number): { name: string; agent: string; total: number } | null;
}

/** Controller for the work indicator (gear spinner below the input bar). */
export interface WorkIndicatorController {
  setWorking(working: boolean, toolName?: string | null): void;
  isVisible(): boolean;
  dispose(): void;
}

/** Controller for the chat view (messages + spinner). */
export interface ChatViewController {
  displayMessage(text: string): void;
  displayUserMessage(text: string): void;
  setThinking(value: boolean): void;
  handleEvent(event: any): void;
  getLastAgentMessage(): string | null;
  dispose(): void;
}

/** Controller for the input bar. */
export interface InputBarController {
  focus(): void;
  setInput(text: string): void;
  setOnSend(handler: (text: string) => void): void;
  setOnCommand(handler: (name: string, args: string) => void): void;
}
