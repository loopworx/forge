import type { Persistence } from "./interfaces";

export class MemoryPersistence implements Persistence {
  private store = new Map<string, unknown>();

  read<T>(key: string): T | null {
    return (this.store.get(key) as T) ?? null;
  }

  write<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  exists(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}
