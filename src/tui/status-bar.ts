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

/**
 * Immutable state for the status bar. All pure rendering functions take
 * this shape (or a superset) as input — no `this` reference needed.
 */
export interface StatusBarState {
  agent: string;
  model: string;
  provider: string;
  thinking: string;
  tokens: number;
  maxTokens: number;
  mode: string;
  /** Live context tracking — when non-null, overrides `tokens`/`maxTokens`/percent. */
  liveTokens?: number | null;
  liveContextWindow?: number | null;
  livePercent?: number | null;
}

/** Format a raw token count as a display string: `12000` → `12k`. Pure. */
export function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${Math.floor(tokens / 1000)}k` : `${tokens}`;
}

/** Format a max-tokens value: `1000000` → `1M`, `100000` → `100000`. Pure. */
export function formatMaxTokens(max: number): string {
  return max >= 1000000 ? `${max / 1000000}M` : `${max}`;
}

/** Compute the usage percentage string with 1 decimal. Pure. */
export function formatPercent(tokens: number, max: number): string {
  if (max <= 0) return "0.0";
  return (tokens / max * 100).toFixed(1);
}

/** Whether the status bar is configured (has agent/model/provider set). Pure. */
function isConfigured(state: StatusBarState): boolean {
  return Boolean(state.agent || state.model || state.provider);
}

/** Effective token count — live value overrides static when set. Pure. */
function effectiveTokens(state: StatusBarState): number {
  return state.liveTokens ?? state.tokens;
}

/** Effective max tokens — live value overrides static when set. Pure. */
function effectiveMaxTokens(state: StatusBarState): number {
  return state.liveContextWindow ?? state.maxTokens;
}

/** Effective percentage string — live value overrides computed when set. Pure. */
function effectivePercent(state: StatusBarState): string {
  if (state.livePercent !== null && state.livePercent !== undefined) {
    return state.livePercent.toFixed(1);
  }
  return formatPercent(effectiveTokens(state), effectiveMaxTokens(state));
}

/**
 * Left-aligned styled chunks: `agent · model · provider · thinking`.
 * - agent: bold + primary (orange)
 * - model: text (white)
 * - provider: textMuted (gray)
 * - thinking: bold + warning (saturated orange)
 * Separators are muted.
 * Pure — takes state, returns chunks.
 */
export function buildLeftChunks(state: StatusBarState): StyleChunk[] {
  if (!isConfigured(state)) {
    const modeLabel = state.mode ? ` (${state.mode})` : "";
    return [
      { text: `Not configured${modeLabel} \u2014 run /forge-new to start`, fg: THEME.textMuted },
    ];
  }
  const sep = " \u00b7 ";
  return [
    { text: state.agent, fg: THEME.primary, bold: true },
    { text: sep, fg: THEME.textMuted },
    { text: state.model, fg: THEME.text },
    { text: ` ${state.provider}`, fg: THEME.textMuted },
    { text: sep, fg: THEME.textMuted },
    { text: state.thinking, fg: THEME.warning, bold: true },
  ];
}

/**
 * Right-aligned styled chunks: `tokens/max (pct%) · mode` — all muted/dim.
 * Pure — takes state, returns chunks.
 */
export function buildRightChunks(state: StatusBarState): StyleChunk[] {
  if (!isConfigured(state)) return [];
  const tokens = effectiveTokens(state);
  const max = effectiveMaxTokens(state);
  const pct = effectivePercent(state);
  const tokensFormatted = formatTokens(tokens);
  const maxFormatted = formatMaxTokens(max);
  return [
    { text: `${tokensFormatted}/${maxFormatted} (${pct}%) \u00b7 ${state.mode}`, fg: THEME.textMuted, dim: true },
  ];
}

/**
 * Plain-text rendering (legacy / debugging). Pure — takes state, returns string.
 */
export function buildPlainText(state: StatusBarState): string {
  if (!isConfigured(state)) {
    const modeLabel = state.mode ? ` (${state.mode})` : "";
    return `Not configured${modeLabel} \u2014 run /forge-new to start`;
  }
  const tokens = effectiveTokens(state);
  const max = effectiveMaxTokens(state);
  const pct = effectivePercent(state);
  const tokensFormatted = formatTokens(tokens);
  const maxFormatted = formatMaxTokens(max);
  return `${state.agent} \u00b7 ${state.model} ${state.provider} \u00b7 ${state.thinking} \u00b7 ${tokensFormatted}/${maxFormatted} (${pct}%) \u00b7 ${state.mode}`;
}

/**
 * Stateful status bar — a thin mutable wrapper around `StatusBarState`
 * that delegates all rendering to the pure functions above.
 */
export class StatusBar implements StatusBarState {
  agent = "";
  model = "";
  provider = "";
  thinking = "";
  tokens = 0;
  maxTokens = 0;
  mode = "";
  liveTokens: number | null = null;
  liveContextWindow: number | null = null;
  livePercent: number | null = null;

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

  /** Plain-text rendering (legacy / debugging). */
  getPlainText(): string {
    return buildPlainText(this);
  }

  /** Left-aligned styled chunks. */
  getLeftChunks(): StyleChunk[] {
    return buildLeftChunks(this);
  }

  /** Right-aligned styled chunks. */
  getRightChunks(): StyleChunk[] {
    return buildRightChunks(this);
  }
}
