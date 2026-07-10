import type { Transition, AgentRole } from "./types";
import type { EventBus } from "./interfaces";

export type EngineEvent =
  | { type: "session_created"; sessionId: string; storyId: string; agentRole: AgentRole }
  | { type: "session_settled"; sessionId: string; storyId: string }
  | { type: "session_error"; sessionId: string; storyId: string; error: string }
  | { type: "transition"; transition: Transition }
  | { type: "output"; sessionId: string; delta: string }
  | { type: "phase_started"; phase: number; name: string; sessionId: string }
  | { type: "phase_completed"; phase: number; artifactId: string }
  | { type: "inception_complete" }
  | { type: "story_claimed"; storyId: string; agentRole: AgentRole }
  | { type: "story_halted"; storyId: string; reason: string }
  | { type: "recovery_started"; sessionId: string; storyId: string };

export class EngineEventBus implements EventBus {
  private listeners: Array<(event: unknown) => void> = [];

  publish(event: unknown): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: (event: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
