import type { Clock } from "./interfaces";

export class FakeClock implements Clock {
  private time: number;

  constructor(initialTime: number = 0) {
    this.time = initialTime;
  }

  now(): number {
    return this.time;
  }

  advance(ms: number): void {
    this.time += ms;
  }

  setTime(time: number): void {
    this.time = time;
  }
}
