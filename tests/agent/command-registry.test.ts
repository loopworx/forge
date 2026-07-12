import { describe, expect, it } from "bun:test";
import { CommandRegistry } from "../../src/agent/command-registry";

describe("CommandRegistry", () => {
  it("registers and retrieves a command", () => {
    const reg = new CommandRegistry();
    const handler = async () => {};
    reg.register("forge-new", handler);
    expect(reg.get("forge-new")).toBe(handler);
  });

  it("returns undefined for unknown command", () => {
    const reg = new CommandRegistry();
    expect(reg.get("unknown")).toBeUndefined();
  });

  it("lists all registered command names", () => {
    const reg = new CommandRegistry();
    reg.register("forge-new", async () => {});
    reg.register("forge-next", async () => {});
    reg.register("forge-status", async () => {});
    const all = reg.getAll();
    expect(all).toContain("forge-new");
    expect(all).toContain("forge-next");
    expect(all).toContain("forge-status");
    expect(all.length).toBe(3);
  });

  it("filters by prefix for autocomplete", () => {
    const reg = new CommandRegistry();
    reg.register("forge-new", async () => {});
    reg.register("forge-next", async () => {});
    reg.register("forge-status", async () => {});
    reg.register("help", async () => {});
    const filtered = reg.filterByPrefix("forge");
    expect(filtered).toContain("forge-new");
    expect(filtered).toContain("forge-next");
    expect(filtered).toContain("forge-status");
    expect(filtered).not.toContain("help");
  });
});
