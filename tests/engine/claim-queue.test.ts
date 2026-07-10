import { describe, expect, it } from "bun:test";
import { ClaimQueue } from "../../src/engine/claim-queue";

describe("claim-queue", () => {
  it("executes operations sequentially", async () => {
    const queue = new ClaimQueue();
    const results: number[] = [];

    await Promise.all([
      queue.enqueue(async () => { results.push(1); }),
      queue.enqueue(async () => { results.push(2); }),
      queue.enqueue(async () => { results.push(3); }),
    ]);

    expect(results).toEqual([1, 2, 3]);
  });

  it("returns the result of the operation", async () => {
    const queue = new ClaimQueue();
    const result = await queue.enqueue(async () => 42);
    expect(result).toBe(42);
  });

  it("propagates errors to the caller", async () => {
    const queue = new ClaimQueue();

    expect(
      queue.enqueue(async () => { throw new Error("test error"); })
    ).rejects.toThrow("test error");
  });

  it("continues processing after an error", async () => {
    const queue = new ClaimQueue();

    const results: string[] = [];

    await queue.enqueue(async () => { results.push("first"); }).catch(() => {});
    await queue.enqueue(async () => { throw new Error("middle"); }).catch(() => {});
    const last = await queue.enqueue(async () => { results.push("last"); return "ok"; });

    expect(results).toEqual(["first", "last"]);
    expect(last).toBe("ok");
  });

  it("processes one at a time (no concurrency)", async () => {
    const queue = new ClaimQueue();
    const executionOrder: string[] = [];
    let secondStartedBeforeFirstFinished = false;

    const slowPromise = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 50));
      executionOrder.push("slow-done");
    });

    const fastPromise = queue.enqueue(async () => {
      executionOrder.push("fast-started");
      if (!executionOrder.includes("slow-done")) {
        secondStartedBeforeFirstFinished = true;
      }
    });

    await Promise.all([slowPromise, fastPromise]);

    expect(secondStartedBeforeFirstFinished).toBe(false);
    expect(executionOrder).toEqual(["slow-done", "fast-started"]);
  });
});
