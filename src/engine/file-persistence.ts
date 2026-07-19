import type { Persistence } from "./interfaces";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export class FilePersistence implements Persistence {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  private filePath(key: string): string {
    return join(this.dir, `${key}.json`);
  }

  read<T>(key: string): T | null {
    const path = this.filePath(key);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as T;
    } catch (err) {
      // Corrupt JSON — log so the user can diagnose, but don't crash
      // (returning null lets the caller fall back to defaults).
      console.error(`[file-persistence] failed to read ${path}: ${(err as Error).message}`);
      return null;
    }
  }

  write<T>(key: string, value: T): void {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.filePath(key), JSON.stringify(value, null, 2));
  }

  exists(key: string): boolean {
    return existsSync(this.filePath(key));
  }

  delete(key: string): void {
    const path = this.filePath(key);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }
}
