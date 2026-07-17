import { THEME } from "./theme";

/**
 * A single styled text chunk. Mirrors `TextChunk` from @opentui/core enough
 * to be useful for tests + conversion to StyledText at the renderable layer.
 * `fg` follows the OpenCode theme palette.
 */
export interface StyleChunk {
  text: string;
  fg?: string;
  bold?: boolean;
  dim?: boolean;
}

export class StatusBar {
  private agent = "";
  private model = "";
  private provider = "";
  private thinking = "";
  private tokens = 0;
  private maxTokens = 0;
  private mode = "";
  // Live context tracking — set by polling `session.getContextUsage()`.
  // When setContext() has been called, these override the values passed in
  // setInfo() so the % reflects the SDK's authoritative measurement.
  private liveTokens: number | null = null;
  private liveContextWindow: number | null = null;
  private livePercent: number | null = null;

  setInfo(
    agent: string,
    model: string,
    provider: string,
    thinking: string,
    tokens: number,
    maxTokens: number,
    mode: string,
  ): void {
    this.agent = agent;
    this.model = model;
    this.provider = provider;
    this.thinking = thinking;
    this.tokens = tokens;
    this.maxTokens = maxTokens;
    this.mode = mode;
  }

  /**
   * Update context usage from the SDK's `getContextUsage()` measurement.
   * When called with non-null values, these override the static token count
   * passed to setInfo() so the % is the SDK's authoritative figure.
   */
  setContext(tokens: number, contextWindow: number, percent: number): void {
    this.liveTokens = tokens;
    this.liveContextWindow = contextWindow;
    this.livePercent = percent;
  }

  private effectiveTokens(): number {
    return this.liveTokens ?? this.tokens;
  }

  private effectiveMaxTokens(): number {
    return this.liveContextWindow ?? this.maxTokens;
  }

  private effectivePercent(): string {
    if (this.livePercent !== null) return this.livePercent.toFixed(1);
    const max = this.effectiveMaxTokens();
    if (max <= 0) return "0.0";
    return (this.effectiveTokens() / max * 100).toFixed(1);
  }

  /**
   * Plain-text rendering (legacy / debugging). Use getLeftChunks() and
   * getRightChunks() for the styled per-segment layout used by the TUI.
   */
  getPlainText(): string {
    if (!this.agent && !this.model && !this.provider) {
      const modeLabel = this.mode ? ` (${this.mode})` : "";
      return `Not configured${modeLabel} \u2014 run /forge-new to start`;
    }
    const tokens = this.effectiveTokens();
    const max = this.effectiveMaxTokens();
    const pct = this.effectivePercent();
    const tokensFormatted = tokens >= 1000 ? `${Math.floor(tokens / 1000)}k` : `${tokens}`;
    const maxFormatted = max >= 1000000 ? `${max / 1000000}M` : `${max}`;
    return `${this.agent} \u00b7 ${this.model} ${this.provider} \u00b7 ${this.thinking} \u00b7 ${tokensFormatted}/${maxFormatted} (${pct}%) \u00b7 ${this.mode}`;
  }

  /**
   * Left-aligned styled chunks: `agent · model · provider · thinking`.
   * - agent: bold + primary (orange)
   * - model: text (white)
   * - provider: textMuted (gray)
   * - thinking: bold + warning (saturated orange)
   * Separators are muted.
   */
  getLeftChunks(): StyleChunk[] {
    if (!this.agent && !this.model && !this.provider) {
      const modeLabel = this.mode ? ` (${this.mode})` : "";
      return [
        { text: `Not configured${modeLabel} \u2014 run /forge-new to start`, fg: THEME.textMuted },
      ];
    }
    const sep = " \u00b7 ";
    return [
      { text: this.agent, fg: THEME.primary, bold: true },
      { text: sep, fg: THEME.textMuted },
      { text: this.model, fg: THEME.text },
      { text: ` ${this.provider}`, fg: THEME.textMuted },
      { text: sep, fg: THEME.textMuted },
      { text: this.thinking, fg: THEME.warning, bold: true },
    ];
  }

  /**
   * Right-aligned styled chunks: `tokens/max (pct%) · mode` — all muted/dim.
   */
  getRightChunks(): StyleChunk[] {
    if (!this.agent && !this.model && !this.provider) {
      return [];
    }
    const tokens = this.effectiveTokens();
    const max = this.effectiveMaxTokens();
    const pct = this.effectivePercent();
    const tokensFormatted = tokens >= 1000 ? `${Math.floor(tokens / 1000)}k` : `${tokens}`;
    const maxFormatted = max >= 1000000 ? `${max / 1000000}M` : `${max}`;
    return [
      { text: `${tokensFormatted}/${maxFormatted} (${pct}%) \u00b7 ${this.mode}`, fg: THEME.textMuted, dim: true },
    ];
  }
}
