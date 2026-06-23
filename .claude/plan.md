# Plan: Replace Evals with Deterministic Simulated Execution

## Goal
Remove the `evals/` directory and implement a deterministic Layer 2 simulated-execution validator that exercises the handoff graph and loop-state transitions without an LLM.

## Background
- The existing `evals/` are behavioral prompts checked by humans (not automated).
- The design spec explicitly says "No LLM in the harness" and defers true behavioral Layer 2 tests.
- Therefore we cannot faithfully replicate the evals inside the harness. We replace them with deterministic state-machine simulation.

## Steps

1. **Delete eval assets**
   - Remove `/Users/canavar/projects/forge/evals/` directory.
   - Remove the line in `/Users/canavar/projects/forge/README.md` that says "Write evals before writing skill body content".

2. **Strip eval references from the contract fixture**
   - Remove all `eval_name` entries from `tools/contract-tests/fixtures/loop-contract.yaml`.
   - Remove all `eval_name` entries from `tools/contract-tests/tests/fixtures/canonical-loop-contract.yaml`.
   - Keep `eval_name: Option<String>` in `types::FixtureLoop` for backward compatibility, but leave it unused.

3. **Remove the `eval_completeness` validator**
   - Delete `tools/contract-tests/src/validators/eval_completeness.rs`.
   - Remove its module and call from `src/validators/mod.rs`.
   - Remove related tests in `tests/validator_tests.rs`.
   - Remove references in `tests/integration.rs`.

4. **Implement deterministic simulation engine**
   - Create `tools/contract-tests/src/simulation/mod.rs`.
   - Expose a function `simulate_session(repo: &Repo, start_state: &str) -> SimulationResult`.
   - Walk the handoff graph from a given entry state using BFS/DFS:
     - Verify each visited transition target is an existing skill with `HANDOFFS.md`.
     - Verify terminal states are terminal and reachable states can eventually halt.
   - Read `project.constraints.yaml` loop budgets (max_iterations_per_subslice, max_no_progress_retries, max_story_loop_minutes, max_story_loop_cost_usd) and validate they are present and non-zero.
   - Return a list of `SimulationStep` records and any invariants violated.

5. **Add `simulation` validator**
   - Create `tools/contract-tests/src/validators/simulation.rs`.
   - For each fixture entry point and each loop skill, run a simulated session.
   - Emit diagnostics with prefix `SIM-` for:
     - `SIM-001` entry point cannot reach any terminal/halt state
     - `SIM-002` transition targets a skill not in the repo
     - `SIM-003` loop budget field missing or invalid in `project.constraints.yaml`
     - `SIM-004` transition references a non-canonical state

6. **Register the new validator**
   - Add `pub mod simulation;` to `src/validators/mod.rs`.
   - Call `simulation::validate(repo)` in `validators::run_all` after `handoff_completeness`.
   - Add a diagnostic-code entry for `SIM-*` in the design spec (optional).

7. **Update tests**
   - Add simulation tests in `tests/validator_tests.rs`:
     - happy path: perfect repo simulates cleanly
     - error path: broken transition to missing skill
     - error path: budget field missing
   - Update `tests/integration.rs` to include `simulation::validate` in the synthetic perfect-repo assertion.
   - Update `tests/common/mod.rs` perfect_skill_library if needed to satisfy simulation.

8. **Update READMEs**
   - Update `tools/contract-tests/README.md` to remove eval references and describe simulation.
   - Update `README.md` main repo to remove the eval-writing instruction.

9. **Verify**
   - Run `cd tools/contract-tests && cargo test` → all pass.
   - Run `cd tools/contract-tests && cargo run -- --json` → `[]`.
   - Optionally run `cargo llvm-cov --workspace --summary-only` to confirm coverage stays high.

## Files to touch
- `evals/` (delete)
- `README.md`
- `tools/contract-tests/fixtures/loop-contract.yaml`
- `tools/contract-tests/tests/fixtures/canonical-loop-contract.yaml`
- `tools/contract-tests/src/simulation/mod.rs` (new)
- `tools/contract-tests/src/validators/simulation.rs` (new)
- `tools/contract-tests/src/validators/mod.rs`
- `tools/contract-tests/src/validators/eval_completeness.rs` (delete)
- `tools/contract-tests/tests/validator_tests.rs`
- `tools/contract-tests/tests/integration.rs`
- `tools/contract-tests/tests/common/mod.rs` (maybe)
- `tools/contract-tests/README.md`

## Approach choice trade-off
True behavioral evals require an LLM participant, violating the harness's "no LLM" principle and making CI non-deterministic. The chosen approach models skills as a state machine and simulates graph walks, which is deterministic, fast, and catches structural deadlock/budget issues—the same class of defects that would make the behavioral evals fail in practice.
