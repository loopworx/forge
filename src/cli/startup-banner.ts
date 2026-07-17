const FORGE_VERSION = "Forge v0.3.0";

interface BannerState {
  mode: string;
  inception: { currentPhase: number; phaseSessionId: string | null };
}

interface Phase {
  phase: number;
  name: string;
  agent: string;
}

export function buildStartupBanner(state: BannerState, phases: Phase[]): string {
  const lines: string[] = [];
  const width = 52;

  const top = "\u2554" + "\u2550".repeat(width) + "\u2557";
  const bottom = "\u255a" + "\u2550".repeat(width) + "\u255d";
  const side = "\u2502";

  const pad = (text: string) => `${side}  ${text.padEnd(width - 2)}${side}`;
  const empty = () => pad("");

  lines.push(top);
  lines.push(pad(FORGE_VERSION));
  lines.push(empty());

  if (state.mode === "inception") {
    lines.push(pad("Mode: Inception"));
    const phase = phases[state.inception.currentPhase];
    if (phase) {
      lines.push(pad(`Phase ${state.inception.currentPhase + 1}/${phases.length}: ${phase.name}`));
      lines.push(pad(`Agent: ${phase.agent}`));
    }
    lines.push(empty());
    if (state.inception.phaseSessionId) {
      lines.push(pad("Phase in progress."));
      lines.push(pad("Type /forge-next to advance to the next phase."));
    } else {
      lines.push(pad("Type /forge-new to start the inception phase."));
    }
  } else {
    lines.push(pad("Mode: Development"));
    lines.push(empty());
    lines.push(pad("Monitoring Linear for new stories..."));
  }

  lines.push(empty());
  lines.push(pad("Type /help to see all available commands."));
  lines.push(bottom);

  return lines.join("\n");
}
