import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const TMP_HOME = join(import.meta.dir, "..", ".test-setup-home");
const FORGE_BIN = join(import.meta.dir, "..", "..", "bin", "forge.ts");

describe("forge setup", () => {
  beforeEach(() => {
    if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
    mkdirSync(TMP_HOME, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TMP_HOME)) rmSync(TMP_HOME, { recursive: true });
  });

  it("writes forge.yaml in ~/.config/forge/", async () => {
    const configDir = join(TMP_HOME, ".config", "forge");
    const result = await $`bun run ${FORGE_BIN} setup`.env({ HOME: TMP_HOME }).quiet();
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(configDir, "forge.yaml"))).toBe(true);
  });

  it("writes a providers section with example provider", async () => {
    const configDir = join(TMP_HOME, ".config", "forge");
    await $`bun run ${FORGE_BIN} setup`.env({ HOME: TMP_HOME }).quiet();
    const yaml = readFileSync(join(configDir, "forge.yaml"), "utf-8");
    expect(yaml).toContain("providers:");
  });

  it("does not overwrite existing config", async () => {
    const configDir = join(TMP_HOME, ".config", "forge");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "forge.yaml"), "existing: config\n");
    const result = await $`bun run ${FORGE_BIN} setup`.env({ HOME: TMP_HOME }).quiet();
    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(configDir, "forge.yaml"), "utf-8")).toBe("existing: config\n");
  });
});
