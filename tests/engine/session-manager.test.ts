import { describe, expect, it, beforeEach } from "bun:test";
import { SessionTracker } from "../../src/engine/session-manager";
import { MemoryPersistence } from "../../src/engine/memory-persistence";
import { FakeClock } from "../../src/engine/fake-clock";

describe("SessionTracker", () => {
  let persistence: MemoryPersistence;
  let clock: FakeClock;
  let tracker: SessionTracker;

  beforeEach(() => {
    persistence = new MemoryPersistence();
    clock = new FakeClock(1000);
    tracker = new SessionTracker(persistence, clock);
  });

  it("tracks a session", () => {
    tracker.track("session-1", "FORGE-1", "developer-agent", "in-dev");
    const sessions = tracker.getAll();
    expect(sessions.size).toBe(1);
    expect(sessions.get("session-1")?.storyId).toBe("FORGE-1");
    expect(sessions.get("session-1")?.agentRole).toBe("developer-agent");
    expect(sessions.get("session-1")?.workflowState).toBe("in-dev");
    expect(sessions.get("session-1")?.isRecovery).toBe(false);
  });

  it("tracks recovery sessions with flag", () => {
    tracker.track("session-1", "FORGE-1", "developer-agent", "in-dev", true);
    expect(tracker.get("session-1")?.isRecovery).toBe(true);
  });

  it("records session start time", () => {
    tracker.track("session-1", "FORGE-1", "developer-agent", "in-dev");
    expect(tracker.get("session-1")?.sessionStartTime).toBe(1000);
  });

  it("persists sessions across instances", () => {
    tracker.track("session-1", "FORGE-1", "developer-agent", "in-dev");
    const newTracker = new SessionTracker(persistence, clock);
    expect(newTracker.getAll().size).toBe(1);
    expect(newTracker.get("session-1")?.storyId).toBe("FORGE-1");
  });

  it("removes sessions", () => {
    tracker.track("session-1", "FORGE-1", "developer-agent", "in-dev");
    tracker.remove("session-1");
    expect(tracker.getAll().size).toBe(0);
    expect(tracker.get("session-1")).toBeNull();
  });

  it("persists removals", () => {
    tracker.track("session-1", "FORGE-1", "developer-agent", "in-dev");
    tracker.remove("session-1");
    const newTracker = new SessionTracker(persistence, clock);
    expect(newTracker.getAll().size).toBe(0);
  });

  it("finds sessions by story ID", () => {
    tracker.track("session-1", "FORGE-1", "developer-agent", "in-dev");
    tracker.track("session-2", "FORGE-2", "qa-agent", "in-qa");
    expect(tracker.findByStoryId("FORGE-1")?.sessionId).toBe("session-1");
    expect(tracker.findByStoryId("FORGE-2")?.sessionId).toBe("session-2");
    expect(tracker.findByStoryId("FORGE-3")).toBeNull();
  });

  it("returns the session count", () => {
    expect(tracker.count()).toBe(0);
    tracker.track("s1", "F-1", "developer-agent", "in-dev");
    tracker.track("s2", "F-2", "qa-agent", "in-qa");
    expect(tracker.count()).toBe(2);
  });

  it("returns null for unknown session ID", () => {
    expect(tracker.get("never-existed")).toBeNull();
  });
});
