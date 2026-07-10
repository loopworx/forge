import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { piBridge } from "../../src/bridge/pi-bridge";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dir, "..", ".test-pi-bridge");

describe("piBridge", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".forge"), { recursive: true });
    mkdirSync(join(TEST_DIR, "skills"), { recursive: true });
    writeFileSync(join(TEST_DIR, "forge.yaml"), `active: true
maxConcurrentStories: 1
linear:
  pollIntervalSeconds: 999
  teamId: ""
  teamName: ""
agents:
  developer-agent:
    pullStates: [ready-for-dev]
    activeState: in-dev
    primarySkill: running-atdd-sessions
    interactive: false
    humanGate: false
inception:
  phases:
    - phase: 1
      name: Test
      skill: test-skill
      agent: architect-agent
      output: test
dashboard:
  sidebarWidth: 40
`);
    writeFileSync(join(TEST_DIR, ".forge", "auth.json"), JSON.stringify({
      access_token: "test-token",
      token_type: "Bearer",
      expires_at: Date.now() + 3600000,
    }));
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("is a function that accepts an API parameter", async () => {
    const originalCwd = process.cwd();
    process.chdir(TEST_DIR);

    try {
      const mockApi = {
        registerTool: () => {},
        on: () => {},
        setStatus: () => {},
        registerCommand: () => {},
      };

      const result = await piBridge(mockApi);
      expect(result).toBeDefined();
      expect(typeof (result as any).engine.activeSessionCount).toBe("number");
      expect(typeof (result as any).forgeLayout.render).toBe("function");
    } finally {
      process.chdir(originalCwd);
    }
  });
});
