# writing-acceptance-tests — Loop

The L2-GUIDED outer-Acceptance-Test writing loop. Writes executable
Acceptance Tests from acceptance criteria. These tests define done from
the user's perspective and are the first executable artifact for a
story. They use only the UI or other customer-visible surfaces. No
backdoors, no database checks, no direct API assertions.

## Entry Conditions

- A story is in `in-dev` (per-AC writing) OR Iteration 0
  (dummy harness test writing by qa-agent).
- The AC exists and is UI-testable.
- `CONTEXT.md` and `project.constraints.yaml` are readable.
- `loop-guardian` pre-flight has cleared.

## Loop State Schema

Per-AC state held in the test scaffold directory and the story
snapshot:

- `current_ac` — `AC-[N]` being authored.
- `ats_written` — list of `[test-file]` paths produced.
- `ats_red_confirmed` — list of `[test-file]` paths for which RED has
  been observed and recorded.
- `ac_returned_to_analysis` — list of ACs found to be un-testable and
  sent back to `in-analysis`.

## Single Iteration Step

1. Read the next AC from the story in Linear or from the Iteration 0
   dummy plan.
2. Translate the AC into a Given / When / Then test name and steps.
3. Write the executable Acceptance Test (Playwright or equivalent UI
   driver).
4. Run the test against the test environment; observe and record
   whether it is RED (it must be — no implementation yet).
5. Commit the test file.
6. Post to Linear: `"Outer Acceptance Test for AC-[N] written and
   confirmed RED."`
7. Loop back to Step 1 for the next AC; exit when all ACs are covered.

## Proof of Progress

- One Acceptance Test was written and committed.
- The test was run and RED was observed (and recorded in the loop
  state).
- A Linear comment records the AC + the RED confirmation.

## State Transition Rule

- ACs that are UI-testable → outer AT file moves from `absent` to
  `exists-and-red`; the AC remains part of the story in `in-dev` and
  flows into `running-atdd-sessions`.
- ACs that are NOT UI-testable → AC is returned to `in-analysis`; the
  story returns to `in-analysis` for `writing-stories` to rewrite the
  AC. This loop does not advance Linear state for invalid ACs.
- Per-AC writing during `in-dev` does not change Linear state; only the
  test artifact moves.

## Halt Conditions

- An AC is not testable through the UI alone → halt the iteration for
  that AC; return story to `in-analysis`.
- A test depends on internal state (DB, logs, internal Redux, API
  response codes directly) → halt; rewrite as UI-observable.
- The outer AT is not RED (already passes) → halt; post to Linear for
  human review; the AC may already be done or miswritten.
- A `loop-guardian` `halted-*` report → stop; do not commit the test.

## Handoff Target

- Outer AT written + RED → `running-atdd-sessions` (developer-agent)
  to drive the implementation.
- AC is not UI-testable → `writing-stories` (po-agent) Gate 1 to
  rewrite; story returns to `in-analysis`.
- Iteration 0 dummy test → `validating-test-harness` (qa-agent) to
  confirm the harness runs end-to-end.
