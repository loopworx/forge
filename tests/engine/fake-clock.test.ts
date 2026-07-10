import { describe, expect, it } from "bun:test";
import { FakeClock } from "../../src/engine/fake-clock";
import { SystemClock } from "../../src/engine/system-clock";

describe("SystemClock", () => {
  it("returns current epoch milliseconds", () => {
    const clock = new SystemClock();
    const before = Date.now();
    const result = clock.now();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

describe("FakeClock", () => {
  it("returns the set time", () => {
    const clock = new FakeClock(1000);
    expect(clock.now()).toBe(1000);
  });

  it("advances when advance() is called", () => {
    const clock = new FakeClock(1000);
    clock.advance(5000);
    expect(clock.now()).toBe(6000);
  });

  it("can be set to a specific time", () => {
    const clock = new FakeClock(0);
    clock.setTime(99999);
    expect(clock.now()).toBe(99999);
  });
});
