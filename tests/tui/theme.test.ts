import { describe, expect, it } from "bun:test";
import { THEME, AGENT_COLORS } from "../../src/tui/theme";

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

  it("has Catppuccin Mocha extended colors", () => {
    expect(THEME.peach).toBeDefined();
    expect(THEME.mauve).toBeDefined();
    expect(THEME.teal).toBeDefined();
    expect(THEME.pink).toBeDefined();
    expect(THEME.surface0).toBeDefined();
    expect(THEME.surface1).toBeDefined();
    expect(THEME.overlay0).toBeDefined();
  });
});
