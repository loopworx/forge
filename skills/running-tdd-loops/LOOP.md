# running-tdd-loops — Loop

The L1-RIGID inner TDD loop within an ATDD session. Runs
RED → GREEN → REFACTOR for both the FE component loop and the BE CDC
contract loop for a single sub-slice. Called by
`running-atdd-sessions` — do not call directly.

Before each iteration of this loop, `guarding-loops` pre-flight is
REQUIRED.

## Entry Conditions

- A sub-slice within an AC of a story in `in-dev` is being worked on
  (caller is `running-atdd-sessions`).
- For FE loop: the smallest UI component change is identified.
- For BE loop: the API contract (endpoint, request, response) for the
  sub-slice is identified.
- `guarding-loops` pre-flight has cleared.

## Loop State Schema

Per-story loop-state file at `stories/[STORY-ID].loop.md`:

- `current_loop` — `delivery`.
- `current_ac`, `current_subslice` — pointers into the AC/sub-slice
  being iterated.
- `loop_phase` — `fe-red` | `fe-green` | `fe-refactor` | `be-red` |
  `be-green` | `be-refactor` | `done`.
- `fe_status`, `be_status` — `pending` | `in-progress` | `done` for
  the current sub-slice.
- `iteration_counter` — incremented per TDD cycle (RED / GREEN /
  REFACTOR).
- `stall_counter`, `last_proof_result`, `guardian_check` — inherited
  from the parent loop state.

## Single Iteration Step

1. Run `guarding-loops` pre-flight (L1-RIGID prerequisite — do not skip).
2. Identify which TDD phase to execute next (`loop_phase`):
   - `fe-red` (or `be-red`): write the failing test → run it → see RED.
   - `fe-green` (or `be-green`): write the minimum code to make it
     pass → run it → see GREEN.
   - `fe-refactor` (or `be-refactor`): improve the code without changing
     behaviour → run the test → still GREEN.
3. Record the phase outcome on the loop-state file (timestamps,
   counters).
4. If a new behaviour surfaces during refactor → STOP; add a new
   sub-slice to the story snapshot (status `pending`); return control
   to `running-atdd-sessions` to schedule the new sub-slice.
5. Loop back to Step 2 with the next phase, or advance `loop_phase`:
   - After `fe-refactor` GREEN → `loop_phase` becomes `be-red`.
   - After `be-refactor` GREEN → `loop_phase` becomes `done`.
6. When `loop_phase: done` → return control to
   `running-atdd-sessions`.

## Proof of Progress

- Each TDD phase was actually executed and its outcome (RED/GREEN) was
  observed and recorded on the loop-state file.
- `iteration_counter` was incremented for each cycle.
- The test added during `*-red` exists and remains passing through the
  `*-refactor` cycle.

## State Transition Rule

transition in-dev → in-dev
  trigger FE component loop complete (RED→GREEN→REFACTOR)
  handoff running-atdd-sessions to developer-agent

transition in-dev → in-dev
  trigger BE CDC loop complete (RED→GREEN→REFACTOR)
  handoff running-atdd-sessions to developer-agent

transition in-dev → in-dev
  trigger new behavior discovered during refactor
  handoff running-atdd-sessions to developer-agent

## Halt Conditions

- The test cannot be made RED — code already implements the behaviour →
  halt; the sub-slice was already done in a prior session; return to
  `running-atdd-sessions` to verify.
- The minimum code path requires an architecture decision → halt; return
  to `running-atdd-sessions` to fire `deciding-architecture`.
- Refactor surfaces new behaviour → halt the refactor; add a new
  sub-slice; return control.
- `guarding-loops` reports `halted-iteration-budget` or
  `halted-wall-clock` → stop; do not modify code or tests.
- A test becomes flaky across runs → halt; root-cause the flakiness
  before continuing.

## Handoff Target

- `loop_phase: done` → return control to `running-atdd-sessions`. This
  loop never hands off to a different pipeline skill.
- New behaviour found during refactor → return control to
  `running-atdd-sessions` with the new sub-slice recorded in the
  snapshot.
- Architecture decision needed → return control to
  `running-atdd-sessions` to fire `deciding-architecture`.
