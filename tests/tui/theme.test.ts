import { describe, expect, it } from "bun:test";
import { THEME, AGENT_COLORS, loadOpencodeTheme } from "../../src/tui/theme";

describe("theme", () => {
  it("has background colors", () => {
    expect(THEME.background).toBeDefined();
    expect(THEME.backgroundPanel).toBeDefined();
    expect(THEME.backgroundElement).toBeDefined();
  });

  it("has border colors", () => {
    expect(THEME.border).toBeDefined();
    expect(THEME.borderActive).toBeDefined();
  });

  it("has semantic colors", () => {
    expect(THEME.primary).toBeDefined();
    expect(THEME.success).toBeDefined();
    expect(THEME.warning).toBeDefined();
    expect(THEME.error).toBeDefined();
  });

  it("has text colors", () => {
    expect(THEME.text).toBeDefined();
    expect(THEME.textMuted).toBeDefined();
  });

  it("has agent colors for all 7 agents", () => {
    expect(AGENT_COLORS["po-agent"]).toBeDefined();
    expect(AGENT_COLORS["architect-agent"]).toBeDefined();
    expect(AGENT_COLORS["ux-agent"]).toBeDefined();
    expect(AGENT_COLORS["developer-agent"]).toBeDefined();
    expect(AGENT_COLORS["qa-agent"]).toBeDefined();
    expect(AGENT_COLORS["devops-agent"]).toBeDefined();
    expect(AGENT_COLORS["guardian-agent"]).toBeDefined();
  });

  it("has OpenCode theme colors", () => {
    expect(THEME.surfaceDark).toBeDefined();
    expect(THEME.surfaceTool).toBeDefined();
  });

  it("primary is OpenCode dark-mode orange (#fab283)", () => {
    expect(THEME.primary.toLowerCase()).toBe("#fab283");
  });

  it("warning is OpenCode dark-mode orange (#f5a742)", () => {
    expect(THEME.warning.toLowerCase()).toBe("#f5a742");
  });

  it("background is OpenCode dark-mode step1 (#0a0a0a)", () => {
    expect(THEME.background.toLowerCase()).toBe("#0a0a0a");
  });

  it("backgroundElement is OpenCode dark-mode step3 (#1e1e1e)", () => {
    expect(THEME.backgroundElement.toLowerCase()).toBe("#1e1e1e");
  });

  it("text is OpenCode dark-mode step12 (#eeeeee)", () => {
    expect(THEME.text.toLowerCase()).toBe("#eeeeee");
  });

  it("textMuted is OpenCode dark-mode step11 (#808080)", () => {
    expect(THEME.textMuted.toLowerCase()).toBe("#808080");
  });

  it("spinner color matches primary (orange)", () => {
    expect(THEME.spinner.toLowerCase()).toBe(THEME.primary.toLowerCase());
  });

  it("peach alias matches primary (OpenCode orange)", () => {
    expect(THEME.peach.toLowerCase()).toBe(THEME.primary.toLowerCase());
  });

  it("surfaceDark equals backgroundElement (both step3)", () => {
    expect(THEME.surfaceDark.toLowerCase()).toBe("#1e1e1e");
  });

  it("info matches OpenCode dark cyan (#56b6c2)", () => {
    expect(THEME.info.toLowerCase()).toBe("#56b6c2");
  });

  it("error matches OpenCode dark red (#e06c75)", () => {
    expect(THEME.error.toLowerCase()).toBe("#e06c75");
  });

  it("success matches OpenCode dark green (#7fd88f)", () => {
    expect(THEME.success.toLowerCase()).toBe("#7fd88f");
  });

  it("accent matches OpenCode dark accent purple (#9d7cd8)", () => {
    expect(THEME.accent.toLowerCase()).toBe("#9d7cd8");
  });
});

describe("loadOpencodeTheme", () => {
  it("resolves the bundled opencode.json to OpenCode dark-mode colors", async () => {
    const theme = await loadOpencodeTheme();
    expect(theme.primary.toLowerCase()).toBe("#fab283");
    expect(theme.warning.toLowerCase()).toBe("#f5a742");
    expect(theme.background.toLowerCase()).toBe("#0a0a0a");
    expect(theme.text.toLowerCase()).toBe("#eeeeee");
  });

  it("falls back to in-code THEME when opencode.json cannot be read", async () => {
    const theme = await loadOpencodeTheme({ path: "/nonexistent/opencode.json" });
    expect(theme.primary.toLowerCase()).toBe("#fab283");
    expect(theme.background.toLowerCase()).toBe("#0a0a0a");
  });
});
