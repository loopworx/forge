import type { Clock } from "./interfaces";

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
