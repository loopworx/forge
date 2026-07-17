import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createForgeLogger } from "../../src/cli/forge-logger";

const TMP_DIR = join(import.meta.dir, "..", ".test-logger");

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createForgeLogger", () => {
  beforeEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
  });

  it("writes info messages with [INFO] prefix and timestamp", async () => {
    const logPath = join(TMP_DIR, "forge.log");
    const logger = createForgeLogger(logPath);
    logger.info("Test info message");
    await wait(100);
    expect(existsSync(logPath)).toBe(true);
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("[INFO]");
    expect(content).toContain("Test info message");
    expect(content).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    logger.close();
  });

  it("writes error messages with [ERROR] prefix", async () => {
    const logPath = join(TMP_DIR, "forge.log");
    const logger = createForgeLogger(logPath);
    logger.error("Something went wrong");
    await wait(100);
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("[ERROR]");
    expect(content).toContain("Something went wrong");
    logger.close();
  });

  it("appends to existing log file without overwriting", async () => {
    const logPath = join(TMP_DIR, "forge.log");
    writeFileSync(logPath, "previous content\n");
    const logger = createForgeLogger(logPath);
    logger.info("new message");
    await wait(100);
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("previous content");
    expect(content).toContain("new message");
    logger.close();
  });

  it("creates parent directories if they do not exist", async () => {
    const logPath = join(TMP_DIR, "nested", "deep", "forge.log");
    const logger = createForgeLogger(logPath);
    logger.info("deep log");
    await wait(100);
    expect(existsSync(logPath)).toBe(true);
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("deep log");
    logger.close();
  });

  it("writes debug messages with [DEBUG] prefix", async () => {
    const logPath = join(TMP_DIR, "forge.log");
    const logger = createForgeLogger(logPath);
    logger.debug("Debug detail");
    await wait(100);
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("[DEBUG]");
    expect(content).toContain("Debug detail");
    logger.close();
  });
});
