import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { FilePersistence } from "../../src/engine/file-persistence";
import { MemoryPersistence } from "../../src/engine/memory-persistence";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dir, "..", ".test-persistence");

describe("MemoryPersistence", () => {
  it("writes and reads values", () => {
    const p = new MemoryPersistence();
    p.write("key", { foo: "bar" });
    expect(p.read<{ foo: string }>("key")).toEqual({ foo: "bar" });
  });

  it("returns null for missing keys", () => {
    const p = new MemoryPersistence();
    expect(p.read("missing")).toBeNull();
  });

  it("checks existence", () => {
    const p = new MemoryPersistence();
    p.write("key", "value");
    expect(p.exists("key")).toBe(true);
    expect(p.exists("missing")).toBe(false);
  });

  it("deletes values", () => {
    const p = new MemoryPersistence();
    p.write("key", "value");
    p.delete("key");
    expect(p.exists("key")).toBe(false);
  });
});

describe("FilePersistence", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("writes and reads JSON values", () => {
    const p = new FilePersistence(TEST_DIR);
    p.write("sessions", { id: "abc", count: 42 });
    expect(p.read<{ id: string; count: number }>("sessions")).toEqual({ id: "abc", count: 42 });
  });

  it("returns null for missing files", () => {
    const p = new FilePersistence(TEST_DIR);
    expect(p.read("never")).toBeNull();
  });

  it("checks existence", () => {
    const p = new FilePersistence(TEST_DIR);
    p.write("key", "value");
    expect(p.exists("key")).toBe(true);
    expect(p.exists("missing")).toBe(false);
  });

  it("deletes files", () => {
    const p = new FilePersistence(TEST_DIR);
    p.write("key", "value");
    p.delete("key");
    expect(p.exists("key")).toBe(false);
  });

  it("overwrites existing values", () => {
    const p = new FilePersistence(TEST_DIR);
    p.write("key", { v: 1 });
    p.write("key", { v: 2 });
    expect(p.read<{ v: number }>("key")).toEqual({ v: 2 });
  });

  it("creates directory if it doesn't exist", () => {
    const nestedDir = join(TEST_DIR, "nested", "deep");
    const p = new FilePersistence(nestedDir);
    p.write("key", "value");
    expect(p.exists("key")).toBe(true);
  });
});
