import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * OpenCode-aligned theme palette.
 *
 * Colors mirror the OpenCode "opencode.json" theme (dark mode, resolved from
 * the `darkStep*` defs); see `templates/themes/opencode.json` for the source
 * of truth. `loadOpencodeTheme()` reads that file at runtime and returns the
 * fully resolved dark-mode palette. The constants below are an in-code mirror
 * used both as the compile-time default and as the fallback when the JSON file
 * is unavailable (e.g. tests, sandboxed environments).
 */
export const THEME = {
  // Slightly darker step shades than OpenCode's defaults for a "smooth black"
  // feel — background #080808, panel #0f0f0f, element #161616 — keeping subtle
  // differentiation between areas but darker overall.
  background:        "#080808", // darker than darkStep1 (#0a0a0a)
  backgroundPanel:   "#0f0f0f", // darker than darkStep2 (#141414)
  backgroundElement: "#161616", // darker than darkStep3 (#1e1e1e)
  surface0:         "#282828", // darkStep4 (unchanged)
  surface1:         "#323232", // darkStep5 (unchanged)
  surfaceDark:      "#161616", // matches backgroundElement
  surfaceTool:      "#080808", // matches background
  overlay0:         "#808080", // darkStep11
  border:           "#484848", // darkStep7
  borderActive:     "#606060", // darkStep8
  borderSubtle:     "#3c3c3c", // darkStep6

  // OpenCode semantic colors (dark)
  primary:   "#fab283", // OpenCode primary  (warm peach) — user/accent
  secondary: "#5c9cf5", // OpenCode secondary (blue)
  accent:    "#9d7cd8", // OpenCode accent (purple)
  error:     "#e06c75", // OpenCode darkRed
  warning:   "#f5a742", // OpenCode darkOrange
  success:   "#7fd88f", // OpenCode darkGreen
  info:      "#56b6c2", // OpenCode darkCyan

  // Text shades
  text:      "#eeeeee", // darkStep12
  textMuted: "#808080", // darkStep11

  // Backwards-compat aliases
  peach:    "#fab283", // alias for primary (chat-view, input-bar)
  mauve:    "#9d7cd8", // alias for accent
  teal:     "#56b6c2", // alias for info
  pink:     "#e06c75", // alias for error (kept for legacy)

  // Spinner uses primary orange
  spinner: "#fab283",

  // Thinking text color (muted gray)
  thinking: "#808080",
} as const;

export const AGENT_COLORS: Record<string, string> = {
  "po-agent":         "#fab283", // primary orange — Product Owner is the lead
  "architect-agent":  "#9d7cd8", // accent purple
  "ux-agent":         "#56b6c2", // info cyan
  "developer-agent":  "#7fd88f", // success green
  "qa-agent":         "#f5a742", // warning orange
  "devops-agent":     "#5c9cf5", // secondary blue
  "guardian-agent":   "#e06c75", // error red — secops
};

/** Resolved OpenCode theme palette (subset returned by `loadOpencodeTheme`). */
export interface OpencodeTheme {
  primary:        string;
  secondary:      string;
  accent:         string;
  error:          string;
  warning:        string;
  success:        string;
  info:           string;
  text:           string;
  textMuted:      string;
  background:     string;
  backgroundPanel: string;
  backgroundElement: string;
  border:         string;
  borderActive:   string;
  [key: string]:  string;
}

interface OpencodeJson {
  defs?: Record<string, string>;
  theme: Record<string, string | { dark: string; light: string }>;
}

/**
 * Load and resolve the bundled OpenCode theme file
 * (`templates/themes/opencode.json`) into a dark-mode palette. Falls back to
 * the in-code `THEME` constants when the file cannot be read (e.g. when the
 * caller is in a sandboxed test environment with no templates dir on disk).
 *
 * Color refs like `"darkStep9"` are resolved via the JSON's `defs` table.
 */
export async function loadOpencodeTheme(opts: { path?: string } = {}): Promise<OpencodeTheme> {
  const themePath = opts.path ?? resolveDefaultThemePath();
  let json: OpencodeJson;
  try {
    const raw = readFileSync(themePath, "utf-8");
    json = JSON.parse(raw) as OpencodeJson;
  } catch {
    return THEME;
  }
  const defs = json.defs ?? {};
  function resolveColor(c: string | { dark: string; light: string }, chain: string[] = []): string {
    if (typeof c !== "string") {
      return resolveColor(c.dark, chain);
    }
    if (c.startsWith("#")) return c.toLowerCase();
    if (chain.includes(c)) {
      // Circular ref — bail to THEME.
      return THEME.primary;
    }
    const next = defs[c] ?? (json.theme[c] as string | { dark: string; light: string } | undefined) as unknown;
    if (next === undefined) return THEME.primary;
    return resolveColor(next as string | { dark: string; light: string }, [...chain, c]);
  }
  const out: OpencodeTheme = {
    primary:        resolveColor((json.theme.primary        as { dark: string; light: string }).dark),
    secondary:      resolveColor((json.theme.secondary      as { dark: string; light: string }).dark),
    accent:         resolveColor((json.theme.accent         as { dark: string; light: string }).dark),
    error:          resolveColor((json.theme.error          as { dark: string; light: string }).dark),
    warning:        resolveColor((json.theme.warning        as { dark: string; light: string }).dark),
    success:        resolveColor((json.theme.success        as { dark: string; light: string }).dark),
    info:           resolveColor((json.theme.info           as { dark: string; light: string }).dark),
    text:           resolveColor((json.theme.text           as { dark: string; light: string }).dark),
    textMuted:      resolveColor((json.theme.textMuted      as { dark: string; light: string }).dark),
    background:     resolveColor((json.theme.background     as { dark: string; light: string }).dark),
    backgroundPanel: resolveColor((json.theme.backgroundPanel as { dark: string; light: string }).dark),
    backgroundElement: resolveColor((json.theme.backgroundElement as { dark: string; light: string }).dark),
    border:         resolveColor((json.theme.border         as { dark: string; light: string }).dark),
    borderActive:   resolveColor((json.theme.borderActive   as { dark: string; light: string }).dark),
  };
  return out;
}

function resolveDefaultThemePath(): string {
  // src/tui/theme.ts → ../../templates/themes/opencode.json
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, "..", "..", "templates", "themes", "opencode.json");
  } catch {
    return join(process.cwd(), "templates", "themes", "opencode.json");
  }
}
