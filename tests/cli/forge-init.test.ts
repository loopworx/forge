import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const TEST_PROJECT_DIR = join(import.meta.dir, "..", ".test-init-cli");
const FORGE_BIN = join(import.meta.dir, "..", "..", "bin", "forge.ts");

function cleanProjectDir() {
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }
}

describe("forge init CLI", () => {
  beforeEach(() => {
    cleanProjectDir();
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanProjectDir();
  });

  it("creates .forge directory and forge.yaml", async () => {
    const result = await $`bun run ${FORGE_BIN} init --cwd ${TEST_PROJECT_DIR} --team-id TEAM-1 --team-name test`.quiet();
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(TEST_PROJECT_DIR, ".forge"))).toBe(true);
    expect(existsSync(join(TEST_PROJECT_DIR, "forge.yaml"))).toBe(true);
  });

  it("prints success message", async () => {
    const result = await $`bun run ${FORGE_BIN} init --cwd ${TEST_PROJECT_DIR} --team-id TEAM-1 --team-name test`.quiet();
    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toContain("Forge initialized");
  });

  it("fails when project already initialized", async () => {
    const init = await $`bun run ${FORGE_BIN} init --cwd ${TEST_PROJECT_DIR}`.quiet();
    expect(init.exitCode).toBe(0);

    const secondInit = await $`bun run ${FORGE_BIN} init --cwd ${TEST_PROJECT_DIR}`.nothrow().quiet();
    expect(secondInit.exitCode).toBe(1);
  });

  it("copies skills and agents", async () => {
    const result = await $`bun run ${FORGE_BIN} init --cwd ${TEST_PROJECT_DIR}`.quiet();
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(TEST_PROJECT_DIR, "skills", "using-forge", "SKILL.md"))).toBe(true);
    expect(existsSync(join(TEST_PROJECT_DIR, "agents", "developer-agent.md"))).toBe(true);
  });
});
