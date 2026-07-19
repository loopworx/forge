import { describe, expect, it } from "bun:test";
import { SystemClock } from "../../src/engine/system-clock";

describe("SystemClock", () => {
  it("now() returns a number close to Date.now()", () => {
    const clock = new SystemClock();
    const before = Date.now();
    const result = clock.now();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});
