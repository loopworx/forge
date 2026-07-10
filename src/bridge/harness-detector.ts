type Harness = "pi.dev" | "claude-code" | "opencode" | "unknown";

export function detectHarness(): Harness {
  const envHarness = process.env.FORGE_HARNESS;
  if (envHarness) return envHarness as Harness;
  return "unknown";
}
