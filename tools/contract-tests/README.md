# Forge Contract Tests

Static contract test harness for the Forge skill library.

## Run

```bash
cd tools/contract-tests
cargo test              # run all tests
cargo run               # run harness against the repo and print diagnostics
cargo run -- --json     # emit diagnostics as JSON
```

## Design

See `docs/designs/forge-loop-contract-test-harness.md`.

The harness is divided into two layers:

1. **Layer 1 — Static contract tests** (fast, deterministic, no LLM)
   - Verifies that `LOOP.md`, `SKILL.md`, `HANDOFFS.md`, loop-state files,
     and `project.constraints.yaml` exist and are consistent.
2. **Layer 2 — Simulated execution** (fast, deterministic, no LLM)
   - Walks the canonical handoff graph from each entry point.
   - Confirms that `loop:` budgets are defined and positive.
   - Confirms that every non-terminal state can reach a terminal or
     `halted-*` state.

Both layers are structural. Behavioral testing of agent decisions requires an
LLM and is intentionally kept outside this harness.

## Failure Report

Every failing test names a specific file/line to fix. Work through diagnostics systematically.
